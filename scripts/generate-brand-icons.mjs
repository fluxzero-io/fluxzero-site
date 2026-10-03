import { readFile, writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { fluxzeroBrand } from '../src/config/brand.mjs';

// All platform icons derive from the same light-mode mark, without the wordmark.
const source = await readFile(`public${fluxzeroBrand.markLight}`, 'utf8');
const output = `public${fluxzeroBrand.faviconSvg.slice(0, fluxzeroBrand.faviconSvg.lastIndexOf('/'))}`;
await mkdir(output, { recursive: true });
const inner = source.slice(source.indexOf('<defs>'), source.lastIndexOf('</svg>'));
function svg(scale = .225, background = '') {
    const x = (64 - 241.27 * scale) / 2;
    const y = (64 - 263.49 * scale) / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${background ? `<rect width="64" height="64" fill="${background}"/>` : ''}<g transform="translate(${x} ${y}) scale(${scale})">${inner}</g></svg>`;
}
const favicon = svg();
await writeFile(`${output}/favicon.svg`, favicon);
const png = async (name, size, artwork = favicon) => {
    await sharp(Buffer.from(artwork)).resize(size, size).png().toFile(`${output}/${name}`);
};
for (const size of [16, 32, 48]) await png(`favicon-${size}x${size}.png`, size);
await png('apple-touch-icon.png', 180, svg(.18, '#f4f4f5'));
await png('android-chrome-192x192.png', 192);
await png('android-chrome-512x512.png', 512);
// Entire mark fits inside the central 80%-diameter safe circle.
await png('android-chrome-maskable-512x512.png', 512, svg(.17, '#f4f4f5'));
await png('mstile-150x150.png', 150, svg(.18, '#f4f4f5'));

// Traditional uncompressed ICO entries also support older Windows icon readers.
const entries = [];
for (const size of [16, 32, 48]) {
    const rgba = await sharp(`${output}/favicon-${size}x${size}.png`).ensureAlpha().raw().toBuffer();
    const maskStride = Math.ceil(size / 32) * 4;
    const dib = Buffer.alloc(40 + size * size * 4 + maskStride * size);
    dib.writeUInt32LE(40, 0); dib.writeInt32LE(size, 4); dib.writeInt32LE(size * 2, 8);
    dib.writeUInt16LE(1, 12); dib.writeUInt16LE(32, 14); dib.writeUInt32LE(size * size * 4, 20);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const sourceIndex = (y * size + x) * 4;
        const dest = 40 + ((size - y - 1) * size + x) * 4;
        dib[dest] = rgba[sourceIndex + 2]; dib[dest + 1] = rgba[sourceIndex + 1];
        dib[dest + 2] = rgba[sourceIndex]; dib[dest + 3] = rgba[sourceIndex + 3];
        if (!rgba[sourceIndex + 3]) dib[40 + size * size * 4 + (size - y - 1) * maskStride + (x >> 3)] |= 0x80 >> (x % 8);
    }
    entries.push({ size, dib });
}
const header = Buffer.alloc(6 + entries.length * 16);
header.writeUInt16LE(1, 2); header.writeUInt16LE(entries.length, 4);
let offset = header.length;
entries.forEach(({size, dib}, index) => {
    const i = 6 + index * 16;
    header[i] = size; header[i + 1] = size; header.writeUInt16LE(1, i + 4); header.writeUInt16LE(32, i + 6);
    header.writeUInt32LE(dib.length, i + 8); header.writeUInt32LE(offset, i + 12); offset += dib.length;
});
await writeFile(`${output}/favicon.ico`, Buffer.concat([header, ...entries.map(e => e.dib)]));
const mono = favicon.replace(/<defs>[\s\S]*?<\/defs>/, '').replace(/fill="url\([^)]+\)"/g, 'fill="#000"');
await writeFile(`${output}/safari-pinned-tab.svg`, mono);
await writeFile(`${output}/site.webmanifest`, JSON.stringify({
    name: 'Fluxzero', short_name: 'Fluxzero', start_url: '/', scope: '/', display: 'standalone',
    icons: [
        { src: 'android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'android-chrome-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ], theme_color: '#05070B', background_color: '#f4f4f5',
}, null, 2) + '\n');
await writeFile(`${output}/browserconfig.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<browserconfig><msapplication><tile><square150x150logo src="${output.slice(6)}/mstile-150x150.png"/><TileColor>#f4f4f5</TileColor></tile></msapplication></browserconfig>\n`);
// Fallbacks for browsers that request conventional root paths.
for (const name of ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png']) {
    await writeFile(`public/${name}`, await readFile(`${output}/${name}`));
}
console.log(`Generated browser and device icons in ${output}`);
