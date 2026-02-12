import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const onePixelPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7ZlHkAAAAASUVORK5CYII=';
const icoPlaceholder = Buffer.from([0x00, 0x00, 0x01, 0x00]);

const assets = [
  { path: 'apps/mobile/assets/icon.png', content: Buffer.from(onePixelPngBase64, 'base64') },
  { path: 'apps/mobile/assets/splash.png', content: Buffer.from(onePixelPngBase64, 'base64') },
  { path: 'apps/mobile/assets/adaptive-icon.png', content: Buffer.from(onePixelPngBase64, 'base64') },
  { path: 'apps/desktop/icons/32x32.png', content: Buffer.from(onePixelPngBase64, 'base64') },
  { path: 'apps/desktop/icons/128x128.png', content: Buffer.from(onePixelPngBase64, 'base64') },
  { path: 'apps/desktop/icons/icon.ico', content: icoPlaceholder }
];

for (const asset of assets) {
  if (existsSync(asset.path)) continue;
  mkdirSync(dirname(asset.path), { recursive: true });
  writeFileSync(asset.path, asset.content);
  console.log(`generated ${asset.path}`);
}
