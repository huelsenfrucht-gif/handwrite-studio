import * as pdfjs from 'pdfjs-dist';
import workerURL from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { uid, type Template } from './model';

pdfjs.GlobalWorkerOptions.workerSrc = workerURL;

// A4 at ~190 dpi: sharp when zoomed in, small enough to keep the app fluid.
const WIDTH = 1588, HEIGHT = 2246, MAX_PAGES = 40;

function toPage(source: CanvasImageSource, w: number, h: number) {
  const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
  const context = canvas.getContext('2d')!; context.fillStyle = 'white'; context.fillRect(0, 0, WIDTH, HEIGHT);
  const scale = Math.min(WIDTH / w, HEIGHT / h), dw = w * scale, dh = h * scale;
  context.drawImage(source, (WIDTH - dw) / 2, (HEIGHT - dh) / 2, dw, dh);
  return canvas.toDataURL('image/jpeg', .85);
}

/** Turns an image or a PDF (e.g. a worksheet) into A4 page backgrounds. */
export async function loadTemplate(file: File): Promise<Template> {
  if (file.size > 60 * 1024 * 1024) throw new Error('Die Vorlage ist größer als 60 MB.');
  const name = file.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'Eigene Vorlage', pages: string[] = [];
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > MAX_PAGES) throw new Error(`Die Vorlage hat mehr als ${MAX_PAGES} Seiten. Bitte teile sie vorher auf.`);
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n), base = page.getViewport({ scale: 1 }), viewport = page.getViewport({ scale: Math.min(WIDTH / base.width, HEIGHT / base.height) });
        const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
        pages.push(toPage(canvas, canvas.width, canvas.height)); page.cleanup();
      }
    } finally { await task.destroy(); }
  } else if (file.type.startsWith('image/')) {
    const bitmap = await createImageBitmap(file);
    try { pages.push(toPage(bitmap, bitmap.width, bitmap.height)); } finally { bitmap.close(); }
  } else throw new Error('Bitte ein Bild (PNG, JPG …) oder ein PDF als Vorlage wählen.');
  if (!pages.length) throw new Error('Die Vorlage enthält keine Seiten.');
  return { id: uid(), name, pages, created: new Date().toISOString() };
}
