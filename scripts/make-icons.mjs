// Renders app/tray icons from the Levl SVGs.
import sharp from 'sharp';

const jobs = [
  ['assets/levl.svg', 'build/icon.png', 256],
  ['assets/levl.svg', 'assets/levl-64.png', 64],
  ['assets/tray.svg', 'assets/tray.png', 16],
  ['assets/tray.svg', 'assets/tray@2x.png', 32],
];
for (const [src, out, size] of jobs) {
  await sharp(src, { density: 600 }).resize(size, size).png().toFile(out);
  console.log('wrote', out);
}
