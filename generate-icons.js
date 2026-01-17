import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');

const icons = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-192-maskable.png', size: 192 },
  { name: 'icon-512-maskable.png', size: 512 }
];

function createPNGIcon(size, maskable = false) {
  const canvas = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, size, 0x00, 0x00, 0x00, size,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x45, 0x78, 0x74, 0x53, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);
  
  return canvas;
}

async function generateIcons() {
  console.log('Generando iconos PNG para PWA...');
  
  for (const icon of icons) {
    const iconPath = path.join(publicDir, icon.name);
    const pngData = createPNGIcon(icon.size, icon.name.includes('maskable'));
    fs.writeFileSync(iconPath, pngData);
    console.log(`Creado: ${icon.name}`);
  }
  
  console.log('Iconos generados exitosamente!');
}

generateIcons().catch(console.error);
