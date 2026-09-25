import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const iconsetDirectory = process.argv[2] ?? 'build/Buzzed.iconset';
const outputPath = process.argv[3] ?? 'build/Buzzed.icns';

const representations = [
  ['icp4', 'icon_16x16.png'],
  ['icp5', 'icon_32x32.png'],
  ['icp6', 'icon_32x32@2x.png'],
  ['ic07', 'icon_128x128.png'],
  ['ic08', 'icon_256x256.png'],
  ['ic09', 'icon_512x512.png'],
  ['ic10', 'icon_512x512@2x.png'],
];

function sizedChunk(type, data) {
  const header = Buffer.alloc(8);
  header.write(type, 0, 4, 'ascii');
  header.writeUInt32BE(data.length + header.length, 4);
  return Buffer.concat([header, data]);
}

const chunks = representations.map(([type, filename]) =>
  sizedChunk(type, readFileSync(path.join(iconsetDirectory, filename))),
);
const body = Buffer.concat(chunks);
const header = Buffer.alloc(8);
header.write('icns', 0, 4, 'ascii');
header.writeUInt32BE(body.length + header.length, 4);

writeFileSync(outputPath, Buffer.concat([header, body]));
