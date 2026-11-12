import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist/vendor',{recursive:true});
await copyFile('node_modules/jspdf/dist/jspdf.umd.min.js','dist/vendor/jspdf.umd.min.js');
console.log('PDF fallback copied to dist/vendor/jspdf.umd.min.js');
