import {expect,it} from 'vitest';
import {decodeCTC} from '../src/import/ctc';
it('preserves repeated letters separated by blanks and word-space alignment',()=>{
 const alphabet='ab ',ids=[1,1,0,1,3,3,2,0],data=ids.flatMap(id=>Array.from({length:4},(_,c)=>c===id?8:-8));
 const result=decodeCTC(data,ids.length,4,alphabet);expect(result.text).toBe('aa b');expect(result.characters[0].start).toBe(0);expect(result.characters[0].end).toBe(2);expect(result.characters[1].start).toBe(3);expect(result.characters[2].end).toBe(6);expect(result.characters.every(c=>c.confidence>.99)).toBe(true);
});
it('rejects mismatched output rather than teaching incorrectly labelled ink',()=>{expect(()=>decodeCTC([1,2],1,3,'ab')).toThrow();});
import {segmentPage} from '../src/import/segment';
function page(w:number,h:number,rects:number[][]){const pixels=new Uint8ClampedArray(w*h*4).fill(255);for(const [x,y,rw,rh] of rects)for(let yy=y;yy<y+rh;yy++)for(let xx=x;xx<x+rw;xx++){const i=(yy*w+xx)*4;pixels[i]=pixels[i+1]=pixels[i+2]=20;}return pixels;}
it('finds separate text lines and ignores dense horizontal ruling',()=>{const data=page(400,200,[[25,25,90,12],[140,25,80,12],[25,80,100,15],[155,80,70,15],[0,120,400,1]]);const lines=segmentPage(data,400,200);expect(lines).toHaveLength(2);expect(lines[0].y).toBeLessThan(25);expect(lines[1].y).toBeGreaterThan(60);});
it('splits long lines before sending them to the limited-width recognizer',()=>{const data=page(1200,100,[[10,30,180,20],[230,30,180,20],[450,30,180,20],[670,30,180,20],[890,30,180,20]]);const lines=segmentPage(data,1200,100);expect(lines.length).toBeGreaterThan(1);expect(lines.every(l=>l.width/l.height<=16)).toBe(true);});
it('does not turn an empty page into a learned sample',()=>{expect(segmentPage(page(200,200,[]),200,200)).toEqual([]);});
