import { demoGlyphs } from './demo';
import { PAGE, type Drawing, type Note, type Profile, type PlacedGlyph, type Glyph, type RasterInk, type Stroke } from './model';
import { composeWord, profileStyle } from './contextual';
export function random(seed: number) { let a=seed|0; return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;}; }
export const missingGlyph: Glyph = {source:'demo',advance:58,strokes:[[{x:5,y:12},{x:46,y:12},{x:46,y:79},{x:5,y:79},{x:5,y:12}],[{x:12,y:22},{x:39,y:69}]]};
export function layout(note: Note, profiles: Profile[]) {
 const s=note.settings, profile=profiles.find(p=>p.id===s.profileId), rand=random(s.seed), size=s.size/100,style=profile?profileStyle(profile):null;
 const glyphs:PlacedGlyph[]=[], missing=new Set<string>(), fallback=new Set<string>();
 let x=PAGE.margin,y=PAGE.margin,page=0,index=0,originalWords=0,contextualWords=0,rasterWords=0;
 const line=()=>{x=PAGE.margin;y+=s.lineHeight;if(y+s.size*1.2>PAGE.height-PAGE.margin){page++;y=PAGE.margin;}};
 const tokens=note.renderedText.normalize('NFC').replace(/\r/g,'').match(/[\p{L}\p{N}]+|\s+|[^\p{L}\p{N}\s]/gu)||[];
 for(const token of tokens) {
   if(/^\s+$/.test(token)){for(const c of token){index++;if(c==='\n')line();else x+=(c==='\t'?140:style?.spacing?Math.max(25,style.spacing*.65):35)*size;}continue;}
   const chars=Array.from(token),word=profile?composeWord(token,profile,rand):null;
   if(chars.length>1&&word?.kind==='original')originalWords++;if(chars.length>1&&word?.kind==='contextual')contextualWords++;if(word?.glyphs.some(g=>g.raster))rasterWords++;
   const sources=chars.map((c,i)=>word?.glyphs[i]||(demoGlyphs[c]||[missingGlyph])[0]);
   const width=sources.reduce((n,g)=>n+g.advance*size,0);
   if(x>PAGE.margin&&x+width>PAGE.width-PAGE.margin)line();
   const v=s.variation/100,scale=size*(1+(rand()-.5)*.06*v),angle=(rand()-.5)*.035*v,wordY=(rand()-.5)*(style?.baselineSpread||3)*v;
   const wordStart=x,cos=Math.cos(angle),sin=Math.sin(angle);let wordOffset=0;
   for(let i=0;i<chars.length;i++) {
     const char=chars[i],id=String(index++),glyph=sources[i],advance=glyph.advance*scale;
     if(x>PAGE.margin&&x+advance>PAGE.width-PAGE.margin)line();
     const connected=!!profile?.words?.length;
     const letterY=connected?0:(rand()-.5)*3*v;
     const strokes=glyph.strokes.map(stroke=>stroke.map(p=>({x:x+(p.x*cos-(p.y-80)*sin+wordOffset*(cos-1))*scale,y:y+((p.y-80)*cos+(p.x+(x>=wordStart?wordOffset:0))*sin+80)*scale+wordY+letterY,p:p.p})));
     const isFallback=s.profileId!=='demo'&&glyph.source==='demo';
     const learnedInWord=profile?.words?.some(w=>w.text.includes(char));
     const unsupported=!demoGlyphs[char]&&!profile?.glyphs[char]?.length&&!learnedInWord;
     if(isFallback)fallback.add(char);if(unsupported)missing.add(char);
     const raster=glyph.raster?{...glyph.raster,x:x+glyph.raster.x*scale,y:y+(glyph.raster.y-80)*scale+80*scale+wordY,width:glyph.raster.width*scale,height:glyph.raster.height*scale}:undefined;
     glyphs.push({id,char,page,strokes,x,y,width:raster?.width||advance,height:raster?.height||s.size*1.2,fallback:isFallback,unsupported,raster,hiddenByRaster:glyph.hiddenByRaster});
     x+=advance;wordOffset+=glyph.advance;
   }
 }
 const lastInk=[...note.annotations,...(note.drawings||[])].reduce((n,a)=>Math.max(n,a.page),0);
 return {glyphs,pages:Math.max(page+1,lastInk+1),missing:[...missing],fallback:[...fallback],originalWords,contextualWords,rasterWords};
}
export function resolvedDrawing(d:Drawing): Stroke[] {
 if(d.deleted)return [];
 return d.strokes.filter((_,i)=>!d.hiddenStrokes?.includes(i)).map(s=>s.map(p=>({...p,x:d.x+p.x*d.scale,y:d.y+p.y*d.scale})));
}
export function resolvedStrokes(g:PlacedGlyph,note:Note): {strokes:Stroke[];color:string} {
 const edit=note.edits[g.id];return {strokes:edit?.deleted?[]:g.strokes.filter((_,i)=>!edit?.hiddenStrokes?.includes(i)).map(s=>s.map(p=>({...p,x:p.x+(edit?.dx||0),y:p.y+(edit?.dy||0)}))),color:edit?.color||note.settings.color};
}
export function resolvedRaster(g:PlacedGlyph,note:Note):RasterInk|undefined{const edit=note.edits[g.id];return !g.raster||edit?.deleted?undefined:{...g.raster,x:g.raster.x+(edit?.dx||0),y:g.raster.y+(edit?.dy||0)};}
