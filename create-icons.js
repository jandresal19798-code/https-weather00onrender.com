import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas } from 'canvas';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');

function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#4285f4');
  gradient.addColorStop(1, '#1a73e8');
  
  ctx.fillStyle = gradient;
  roundRect(ctx, 0, 0, size, size, size * 0.25);
  ctx.fill();
  
  ctx.fillStyle = '#FFD93D';
  const sunSize = size * 0.25;
  ctx.beginPath();
  ctx.arc(size * 0.4, size * 0.4, sunSize, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.moveTo(size * 0.38, size * 0.65);
  ctx.quadraticCurveTo(size * 0.42, size * 0.55, size * 0.46, size * 0.65);
  ctx.quadraticCurveTo(size * 0.52, size * 0.75, size * 0.42, size * 0.82);
  ctx.quadraticCurveTo(size * 0.32, size * 0.75, size * 0.38, size * 0.65);
  ctx.fill();
  
  return canvas.toBuffer('image/png');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function generateIcons() {
  console.log('Generando iconos PNG...');
  
  const icon192 = createIcon(192);
  fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192);
  console.log('✓ icon-192.png creado');
  
  const icon512 = createIcon(512);
  fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512);
  console.log('✓ icon-512.png creado');
  
  console.log('Iconos generados exitosamente!');
}

generateIcons().catch(console.error);
