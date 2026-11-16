import { demoGlyphs } from './demo';
import { textMargins, textLines, type Drawing, type Note, type Profile, type PlacedGlyph, type Glyph, type RasterInk, type Stroke } from './model';
import { composeWord, profileStyle } from './contextual';
import { connect, endpoints } from './joins';
export function random(seed: number) { let a=seed|0; return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;}; }
export const missingGlyph: Glyph = {source:'demo',advance:58,strokes:[[{x:5,y:12},{x:46,y:12},{x:46,y:79},{x:5,y:79},{x:5,y:12}],[{x:12,y:22},{x:39,y:69}]]};
type LayoutCore={glyphs:PlacedGlyph[];pages:number;missing:string[];fallback:string[];originalWords:number;contextualWords:number;rasterWords:number};
// Layout only depends on text, settings and profiles. Caching it keeps typing,
// selecting and drawing free of lag even for long documents.
const layoutCache=new WeakMap<Profile[],Map<string,LayoutCore>>();
// Within a word, the writer's own letters are joined with a short pen stroke
// whenever exit and entry lie close together, so words read as one movement.
function joinStroke(prev:Glyph,cur:Glyph,gap=0):Stroke|undefined{
 if(prev.source!=='pen'||cur.source!=='pen')return;
 const exit=endpoints(prev.strokes,'exit').reduce<ReturnType<typeof endpoints>[number]|undefined>((best,e)=>!best||e.point.x>best.point.x?e:best,undefined);
 const entry=endpoints(cur.strokes,'entry').reduce<ReturnType<typeof endpoints>[number]|undefined>((best,e)=>!best||e.point.x<best.point.x?e:best,undefined);
 if(!exit||!entry||exit.point.x<prev.advance*.6||entry.point.x>cur.advance*.4)return;
 if(exit.point.y<28||exit.point.y>92||entry.point.y<28||entry.point.y>92)return;
 const start={...exit,point:{...exit.point,x:exit.point.x-prev.advance-gap}},distance=Math.hypot(entry.point.x-start.point.x,entry.point.y-start.point.y);
 if(distance<1.5||distance>26+gap)return;
 return connect(start,entry,0);
}
function layoutCore(note: Note, profiles: Profile[]):LayoutCore {
 const s=note.settings,profile=profiles.find(p=>p.id===s.profileId),rand=random(s.seed),size=s.size/100,style=profile?profileStyle(profile):null,rows=textLines(s);
 const glyphs:PlacedGlyph[]=[], missing=new Set<string>(), fallback=new Set<string>();
 const {left,right}=textMargins(s),lh=s.lineHeight,spacing=(s.letterSpacing||0)/100;
 const last=Math.max(rows.first+lh,rows.last-(s.linesBottom||0)*lh),top=Math.min(last-lh,rows.first-80*size+(s.linesTop||0)*lh),firstTop=Math.min(last-lh,top+(s.linesFirstPage||0)*lh);
 let x=left,y=firstTop,page=0,index=0,originalWords=0,contextualWords=0,rasterWords=0,indent=left,lineStart=true,bullet=false;
 const line=()=>{x=indent;y+=lh;if(y+80*size>last){page++;y=top;}};
 // "* ", "- " or "• " at the start of a line is a list item: write a real
 // handwritten dot and indent wrapped lines under the text, not the dot.
 const text=note.renderedText.normalize('NFC').replace(/\r/g,'').replace(/^([ \t]*)[*\-•·▪◦](?=[ \t])/gm,'$1•');
 const tokens=text.match(/[\p{L}\p{N}\p{M}]+|\s+|[^\p{L}\p{N}\s]/gu)||[];
 for(const token of tokens) {
   if(/^\s+$/.test(token)){for(const c of token){index++;if(c==='\n'){indent=left;lineStart=true;line();}else x+=(c==='\t'?s.wordSpacing*4:s.wordSpacing)*size;}if(bullet){indent=x;bullet=false;}continue;}
   if(lineStart){bullet=token==='•';lineStart=false;}
   const chars=Array.from(token),word=profile?composeWord(token,profile,rand):null;
   if(chars.length>1&&word?.kind==='original')originalWords++;if(chars.length>1&&word?.kind==='contextual')contextualWords++;if(word?.glyphs.some(g=>g.raster))rasterWords++;
   const sources=chars.map((c,i)=>word?.glyphs[i]||(demoGlyphs[c]||[missingGlyph])[0]);
   const width=sources.reduce((n,g)=>n+g.advance*size,0);
   if(x>indent&&x+width>right)line();
   const v=s.variation/100,scale=size*(1+(rand()-.5)*.06*v),angle=(rand()-.5)*.035*v,wordY=(rand()-.5)*(style?.baselineSpread||3)*v;
   const cos=Math.cos(angle),sin=Math.sin(angle);let wordOffset=0;
   for(let i=0;i<chars.length;i++) {
     const char=chars[i],id=String(index++),glyph=sources[i],advance=glyph.advance*scale;
     let wrapped=false;if(x>indent&&x+advance>right){line();wordOffset=0;wrapped=true;}
     const letterY=glyph.source==='pen'?0:(rand()-.5)*3*v;
     const join=i>0&&!wrapped?joinStroke(sources[i-1],glyph,sources[i-1].advance*spacing):undefined,local=join?[...glyph.strokes,join]:glyph.strokes;
     const baseline=y+80*size+wordY+letterY;
     const strokes=local.map(stroke=>stroke.map(p=>({x:x+(p.x*cos-(p.y-80)*sin+wordOffset*(cos-1))*scale,y:baseline+((p.y-80)*cos+(p.x+wordOffset)*sin)*scale,p:p.p})));
     const isFallback=s.profileId!=='demo'&&glyph.source==='demo'&&char!=='•';
     const unsupported=glyph===missingGlyph||(!demoGlyphs[char]&&!profile?.glyphs[char]?.length&&glyph.source==='demo'&&!profile?.words?.some(w=>w.text.includes(char)));
     if(isFallback)fallback.add(char);if(unsupported)missing.add(char);
     const raster=glyph.raster?{...glyph.raster,x:x+glyph.raster.x*scale,y:y+80*size+(glyph.raster.y-80)*scale+wordY,width:glyph.raster.width*scale,height:glyph.raster.height*scale}:undefined;
     glyphs.push({id,char,page,strokes,x,y,width:raster?.width||advance,height:raster?.height||s.size*1.2,fallback:isFallback,unsupported,raster,hiddenByRaster:glyph.hiddenByRaster});
     x+=advance*(1+spacing);wordOffset+=glyph.advance*(1+spacing);
   }
 }
 return {glyphs,pages:page+1,missing:[...missing],fallback:[...fallback],originalWords,contextualWords,rasterWords};
}
export function layout(note: Note, profiles: Profile[]) {
 let cache=layoutCache.get(profiles);if(!cache){cache=new Map();layoutCache.set(profiles,cache);}
 const key=JSON.stringify(note.settings)+'\u0000'+note.renderedText;let core=cache.get(key);
 if(!core){core=layoutCore(note,profiles);/* a long document can take hundreds of MB per layout: keep only a few */if(cache.size>=3)cache.delete(cache.keys().next().value!);cache.set(key,core);}
 const lastInk=[...note.annotations,...(note.drawings||[])].reduce((n,a)=>Math.max(n,a.page),0);
 const templatePages=note.settings.paper==='custom'?note.settings.templatePages||0:0;
 return {...core,pages:Math.max(core.pages,lastInk+1,templatePages)};
}
export function resolvedDrawingInk(d:Drawing):{points:Stroke;color:string}[]{
 if(d.deleted)return [];
 return d.strokes.flatMap((stroke,index)=>d.hiddenStrokes?.includes(index)?[]:[{points:stroke.map(point=>({...point,x:d.x+point.x*d.scale,y:d.y+point.y*d.scale})),color:d.strokeColors?.[index]||d.color}]);
}
export function resolvedDrawing(d:Drawing): Stroke[] {return resolvedDrawingInk(d).map(ink=>ink.points);}
export function resolvedStrokes(g:PlacedGlyph,note:Note): {strokes:Stroke[];color:string} {
 const edit=note.edits[g.id];return {strokes:edit?.deleted?[]:g.strokes.filter((_,i)=>!edit?.hiddenStrokes?.includes(i)).map(s=>s.map(p=>({...p,x:p.x+(edit?.dx||0),y:p.y+(edit?.dy||0)}))),color:edit?.color||note.settings.color};
}
export function resolvedRaster(g:PlacedGlyph,note:Note):RasterInk|undefined{const edit=note.edits[g.id];return !g.raster||edit?.deleted?undefined:{...g.raster,x:g.raster.x+(edit?.dx||0),y:g.raster.y+(edit?.dy||0)};}
