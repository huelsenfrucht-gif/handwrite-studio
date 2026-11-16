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
/**
 * Text as it is pasted from anywhere (AI chats, websites, PDFs, notes): keeps every line break,
 * empty line, indent, list and table, but removes the formatting characters that are not meant
 * to be written by hand (**bold**, # headings, `code`, > quotes, [links](…), invisible characters).
 */
export function cleanText(text: string) {
  return text.normalize('NFC').replace(/\r\n?|[\u2028\u2029\u0085]/g, '\n').replace(/[\u00a0\u202f\u2007]/g, ' ').replace(/[\u200b-\u200d\u2060\ufeff]/g, '')
    .split('\n').map(line => {
      if (/^\s*```/.test(line)) return null;
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) return ''; // horizontal rule
      return line
        .replace(/^(\s{0,3})#{1,6}\s+/, '$1').replace(/\s+#+\s*$/, '')
        .replace(/^(\s*)>\s?/, '$1')
        .replace(/^(\s*)\+(?=\s)/, '$1-')
        .replace(/\*\*(\S(?:.*?\S)?)\*\*/g, '$1').replace(/__(\S(?:.*?\S)?)__/g, '$1')
        .replace(/(^|[^\p{L}\p{N}*])\*(?!\s)([^*\n]*?[^\s*])\*(?![\p{L}\p{N}*])/gu, '$1$2')
        .replace(/(^|[^\p{L}\p{N}_])_(?!\s)([^_\n]*?[^\s_])_(?![\p{L}\p{N}_])/gu, '$1$2')
        .replace(/`([^`\n]+)`/g, '$1')
        .replace(/!?\[([^\]\n]+)\]\([^)\n]*\)/g, '$1')
        .replace(/\\([\\`*_{}[\]()#+\-.!|>])/g, '$1');
    }).filter((line): line is string => line !== null).join('\n');
}
/** Table rows written as "| a | b |"; a row of dashes ("|---|---|") only separates the header. */
const TABLE_ROW=/^[ \t]*\|.*\|[ \t]*$/,TABLE_RULE=/^[ \t|:\-]+$/;
export const tableCells=(row:string)=>row.trim().slice(1,-1).split('|').map(c=>c.trim());
/** A slightly uneven pen line, so table rules look drawn by hand and export as ink. */
function handLine(x1:number,y1:number,x2:number,y2:number,rand:()=>number):Stroke{
 const length=Math.hypot(x2-x1,y2-y1),n=Math.max(2,Math.round(length/24)),nx=-(y2-y1)/(length||1),ny=(x2-x1)/(length||1),points:Stroke=[];
 for(let i=0;i<=n;i++){const t=i/n,w=i===0||i===n?0:(rand()-.5)*.9;points.push({x:x1+(x2-x1)*t+nx*w,y:y1+(y2-y1)*t+ny*w,p:.5});}
 return points;
}
function layoutCore(note: Note, profiles: Profile[]):LayoutCore {
 const s=note.settings,profile=profiles.find(p=>p.id===s.profileId),rand=random(s.seed),style=profile?profileStyle(profile):null,rows=textLines(s);
 const glyphs:PlacedGlyph[]=[], missing=new Set<string>(), fallback=new Set<string>();
 const margins=textMargins(s),spacing=(s.letterSpacing||0)/100;
 let size=s.size/100,lh=s.lineHeight,paging=true;
 const last=Math.max(rows.first+lh,rows.last-(s.linesBottom||0)*lh),top=Math.min(last-lh,rows.first-80*size+(s.linesTop||0)*lh),firstTop=Math.min(last-lh,top+(s.linesFirstPage||0)*lh);
 let left=margins.left,right=margins.right,x=left,y=firstTop,page=0,index=0,originalWords=0,contextualWords=0,rasterWords=0,indent=left,lineStart=true,bullet=false;
 const line=()=>{x=indent;y+=lh;if(paging&&y+80*size>last){page++;y=top;}};
 const ink=(strokes:Stroke[])=>{const pts=strokes.flat(),minX=Math.min(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y));glyphs.push({id:String(index++),char:'',page,strokes,x:minX,y:minY,width:Math.max(1,Math.max(...pts.map(p=>p.x))-minX),height:Math.max(1,Math.max(...pts.map(p=>p.y))-minY),fallback:false,unsupported:false});};
 /** Writes running text between left and right, wrapping words and starting new lines/pages. */
 const flow=(text:string)=>{
  // "* ", "- " or "• " at the start of a line is a list item: write a real
  // handwritten dot and indent wrapped lines under the text, not the dot.
  let numbered=0;
  const tokens=cleanText(text).replace(/^([ \t]*)[*\-•·▪◦](?=[ \t])/gm,'$1•').match(/[\p{L}\p{N}\p{M}]+|\s+|[^\p{L}\p{N}\s]/gu)||[];
  for(const token of tokens) {
   if(/^\s+$/.test(token)){for(const c of token){index++;if(c==='\n'){indent=left;lineStart=true;numbered=0;line();}else x+=(c==='\t'?s.wordSpacing*4:s.wordSpacing)*size;}
    // Wrapped lines stay under the text: after a list dot or number ("1." "a)"), and for indented lines.
    if(bullet||numbered===2||lineStart){indent=x;bullet=false;numbered=0;}continue;}
   if(lineStart){bullet=token==='•';numbered=/^(\d{1,3}|\p{L})$/u.test(token)?1:0;lineStart=false;}
   else if(numbered===1)numbered=token==='.'||token===')'?2:0;
   else numbered=0;
   const chars=Array.from(token),word=profile?composeWord(token,profile,rand):null;
   if(chars.length>1&&word?.kind==='original')originalWords++;if(chars.length>1&&word?.kind==='contextual')contextualWords++;if(word?.glyphs.some(g=>g.raster))rasterWords++;
   const sources=chars.map((c,i)=>word?.glyphs[i]||(demoGlyphs[c]||[missingGlyph])[0]);
   const width=sources.reduce((n,g)=>n+g.advance*size,0);
   if(x>indent&&x+width>right)line();
   const v=1,scale=size*(1+(rand()-.5)*.06*v),angle=(rand()-.5)*.035*v,wordY=(rand()-.5)*(style?.baselineSpread||3)*v;
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
 };
 /** Writes text into a box without changing the running position (cells, worksheet fields). */
 const boxed=(text:string,l:number,r:number,startY:number,onPage:number)=>{
  const saved={left,right,x,y,page,indent,lineStart,bullet,paging};
  left=indent=x=l;right=r;y=startY;page=onPage;lineStart=true;bullet=false;paging=false;
  const from=glyphs.length;flow(text);const lines=Math.round((y-startY)/lh)+1;
  ({left,right,x,y,page,indent,lineStart,bullet,paging}=saved);
  return {from,lines};
 };
 const naturalWidth=(text:string)=>{const keep=index,{from}=boxed(text,0,1e7,0,0),w=glyphs.slice(from).reduce((m,g)=>Math.max(m,g.x+g.width),0);glyphs.length=from;index=keep;return w;};
 /** A table: column widths from the content, text wrapped inside cells, rules drawn by hand. */
 const table=(lines:string[])=>{
  const body=lines.filter(l=>!TABLE_RULE.test(l)).map(tableCells),cols=Math.max(...body.map(r=>r.length));
  if(!body.length)return;
  const pad=Math.max(6,s.wordSpacing*size*.6),avail=right-left;
  // Words vary a little in size each time they are written: leave some room so a cell does not wrap by surprise.
  const natural=Array.from({length:cols},(_,c)=>Math.max(...body.map(r=>r[c]?naturalWidth(r[c])*1.1+4:0))+pad*2);
  const total=natural.reduce((a,b)=>a+b,0),floor=avail/cols*.45;
  let widths=total<=avail?natural:natural.map(w=>Math.max(floor,w*avail/total));
  const sum=widths.reduce((a,b)=>a+b,0);if(sum>avail)widths=widths.map(w=>w*avail/sum);
  const edges=widths.reduce<number[]>((e,w)=>[...e,e.at(-1)!+w],[left]);
  if(x>indent)line();
  for(let r=0;r<body.length;r++){
   for(let attempt=0;attempt<2;attempt++){
    const from=glyphs.length,keep=index;let used=1;
    for(let c=0;c<cols;c++){const cell=body[r][c];if(cell)used=Math.max(used,boxed(cell,edges[c]+pad,edges[c+1]-pad,y,page).lines);}
    const baseline=y+80*size,topRule=baseline-lh*.72,bottomRule=baseline+(used-1)*lh+lh*.28;
    if(attempt===0&&paging&&y+(used-1)*lh+80*size>last&&y>top){glyphs.length=from;index=keep;page++;y=top;continue;}
    ink([handLine(edges[0],topRule,edges[cols],topRule,rand)]);
    for(const e of edges)ink([handLine(e,topRule,e,bottomRule,rand)]);
    if(r===body.length-1||y+used*lh+80*size>last)ink([handLine(edges[0],bottomRule,edges[cols],bottomRule,rand)]);
    y+=(used-1)*lh;x=indent;line();break;
   }
  }
 };
 // Plain paragraphs flow; blocks of "| … |" lines become tables. On a worksheet the text goes into the fields instead.
 const worksheet=s.paper==='custom'&&(note.fields||[]).some(f=>f.role!=='header');
 const blocks=worksheet?[]:cleanText(note.renderedText).split('\n');
 for(let i=0;i<blocks.length;){
  if(TABLE_ROW.test(blocks[i])){const start=i;while(i<blocks.length&&TABLE_ROW.test(blocks[i]))i++;table(blocks.slice(start,i));index++;continue;}
  const start=i;while(i<blocks.length&&!TABLE_ROW.test(blocks[i]))i++;
  const text=blocks.slice(start,i).join('\n')+(i<blocks.length?'\n':'');flow(text);
 }
 // Worksheet answers: each field's text is written into its box, as large as the box allows
 // (never larger than the document's font size), centred for one line, top-aligned for more.
 (note.fields||[]).forEach((field,n)=>{
  if(!field.text.trim())return;
  const base=index,keepSize=size,keepLh=lh,pad=Math.min(10,Math.max(3,field.width*.03));index=10000000+n*100000;
  if(field.rows&&field.rows>1){
   // Ruled answer area: one line of text on each printed line.
   const row=field.height/field.rows;size=Math.min(s.size,row/1.15)/100;lh=row;
   boxed(field.text,field.x+pad,field.x+field.width-pad,field.y+row-Math.max(2,row*.14)-80*size,field.page);
   size=keepSize;lh=keepLh;index=base;return;
  }
  let f=Math.min(s.size,field.height/1.15);
  for(let k=0;k<16;k++){
   size=f/100;lh=f*1.25;
   const baseline=field.y+(field.height-.96*f)/2+76*size,{from,lines}=boxed(field.text,field.x+pad,field.x+field.width-pad,baseline-80*size,field.page);
   const height=(lines-1)*lh+.96*f;
   if(lines===1)break;
   if(height<=field.height-6||f<=6){const shift=field.y+3+76*size-baseline;for(const g of glyphs.slice(from)){g.y+=shift;g.strokes=g.strokes.map(st=>st.map(p=>({...p,y:p.y+shift})));if(g.raster)g.raster={...g.raster,y:g.raster.y+shift};}break;}
   glyphs.length=from;f*=.9;
  }
  size=keepSize;lh=keepLh;index=base;
 });
 return {glyphs,pages:page+1,missing:[...missing],fallback:[...fallback],originalWords,contextualWords,rasterWords};
}
export function layout(note: Note, profiles: Profile[]) {
 let cache=layoutCache.get(profiles);if(!cache){cache=new Map();layoutCache.set(profiles,cache);}
 const key=JSON.stringify(note.settings)+'\u0000'+note.renderedText+'\u0000'+JSON.stringify(note.fields||[]);let core=cache.get(key);
 if(!core){core=layoutCore(note,profiles);/* a long document can take hundreds of MB per layout: keep only a few */if(cache.size>=3)cache.delete(cache.keys().next().value!);cache.set(key,core);}
 const lastInk=[...note.annotations,...(note.drawings||[]),...(note.fields||[])].reduce((n,a)=>Math.max(n,a.page),0);
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
