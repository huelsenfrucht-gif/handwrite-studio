import {readFile,writeFile} from 'node:fs/promises';

const [, , input, output]=process.argv;
if(!input||!output)throw new Error('Usage: node scripts/build-lexicon-bloom.mjs <words> <output>');

const bits=1<<23;
const bytes=new Uint8Array(bits>>3);
const clean=word=>word.normalize('NFC').toLocaleLowerCase('de-DE');
const accepted=/^[a-zäöüß]{2,30}$/;
const hashes=word=>{
 let a=2166136261,b=0x7f4a7c15;
 for(let i=0;i<word.length;i++){const code=word.charCodeAt(i);a=Math.imul(a^code,16777619);b=Math.imul(b^code,2246822519);}
 return[a>>>0,(b|1)>>>0];
};
const set=word=>{const[a,b]=hashes(word);for(let i=0;i<7;i++){const bit=(a+Math.imul(i,b)+i*i)&(bits-1);bytes[bit>>3]|=1<<(bit&7);}};

const words=(await readFile(input,'utf8')).split(/\r?\n/);
let count=0;
for(const raw of words){const word=clean(raw.trim());if(accepted.test(word)){set(word);count++;}}
await writeFile(output,bytes);
console.log(`Wrote ${count} German word forms to ${output} (${bytes.byteLength} bytes).`);
