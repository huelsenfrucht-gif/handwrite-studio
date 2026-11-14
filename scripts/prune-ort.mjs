import {readdir,unlink} from 'node:fs/promises';

const directory='dist/assets';
for(const name of await readdir(directory)){
 if(/^ort-wasm-simd-threaded\.jsep-.*\.wasm$/.test(name)){
  await unlink(`${directory}/${name}`);
  console.log(`Removed unused WebGPU runtime: ${name}`);
 }
}
