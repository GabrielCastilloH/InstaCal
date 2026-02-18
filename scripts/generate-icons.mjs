import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const src = 'src/assets/logo-small.svg';
const outputDir = 'public/icons';

// Create icons directory if it doesn't exist
if (!existsSync(outputDir)) {
  await mkdir(outputDir, { recursive: true });
}

// Generate PNG icons at different sizes
for (const size of [16, 48, 128]) {
  await sharp(src)
    .resize(size, size)
    .png()
    .toFile(`${outputDir}/logo-${size}.png`);
  console.log(`Generated ${outputDir}/logo-${size}.png`);
}

console.log('Icon generation complete!');
