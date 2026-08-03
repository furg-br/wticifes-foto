import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultAsset = path.join(root, "public", "wticifes2026-phrase-brush.png");
const inputPath = path.resolve(process.argv[2] ?? defaultAsset);
const outputPath = path.resolve(process.argv[3] ?? inputPath);

const COLORS = {
  green: [103, 145, 87],
  red: [201, 2, 22],
  yellow: [255, 179, 3],
};

function saturation(r, g, b) {
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  return maximum === 0 ? 0 : (maximum - minimum) / maximum;
}

function targetForX(x, width) {
  const position = x / width;
  if (position < 0.325) return COLORS.green;
  if (position < 0.575) return COLORS.red;
  return COLORS.yellow;
}

const source = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const pixels = Buffer.from(source.data);
const { width, height } = source.info;
const redMask = new Uint8Array(width * height);

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const offset = (y * width + x) * 4;
    const alpha = pixels[offset + 3];
    if (alpha < 16) continue;
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    if (saturation(red, green, blue) < 0.12) continue;

    const target = targetForX(x, width);
    pixels[offset] = target[0];
    pixels[offset + 1] = target[1];
    pixels[offset + 2] = target[2];
    if (target === COLORS.red && alpha >= 48) redMask[y * width + x] = 1;
  }
}

// Fecha somente micropontos internos do preenchimento vermelho. O raio curto
// preserva os vazios intencionais e as bordas de pincel, mas impede pontilhados
// pretos causados por pequenos pixels transparentes no lettering de origem.
const radius = 2;
const dilated = new Uint8Array(redMask.length);
for (let y = radius; y < height - radius; y += 1) {
  for (let x = radius; x < width - radius; x += 1) {
    let found = false;
    for (let dy = -radius; dy <= radius && !found; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (redMask[(y + dy) * width + x + dx]) {
          found = true;
          break;
        }
      }
    }
    if (found) dilated[y * width + x] = 1;
  }
}

const closed = new Uint8Array(redMask.length);
for (let y = radius; y < height - radius; y += 1) {
  for (let x = radius; x < width - radius; x += 1) {
    let complete = true;
    for (let dy = -radius; dy <= radius && complete; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (!dilated[(y + dy) * width + x + dx]) {
          complete = false;
          break;
        }
      }
    }
    if (complete) closed[y * width + x] = 1;
  }
}

for (let y = radius; y < height - radius; y += 1) {
  for (let x = radius; x < width - radius; x += 1) {
    const index = y * width + x;
    if (!closed[index] || redMask[index]) continue;
    const offset = index * 4;
    pixels[offset] = COLORS.red[0];
    pixels[offset + 1] = COLORS.red[1];
    pixels[offset + 2] = COLORS.red[2];
    pixels[offset + 3] = 255;
  }
}

await sharp(pixels, { raw: { width, height, channels: 4 } })
  .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
  .toFile(outputPath);

console.log(`Lettering recolorido em ${outputPath}`);
