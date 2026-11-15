import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// BASE_PATH lets the same build run at the domain root or in a sub-folder
// (GitHub Pages serves this project under /handwrite-studio/).
export default defineConfig({ base: process.env.BASE_PATH || '/', plugins: [react(), tailwindcss()], server: { host: '127.0.0.1' } });
