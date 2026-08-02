import { fileURLToPath } from "node:url";
import sharp from "sharp";

const logo = fileURLToPath(new URL("../public/wticifes2026-logo.png", import.meta.url));
const { data } = await sharp(logo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const histogram = new Map();

for (let offset = 0; offset < data.length; offset += 4) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const alpha = data[offset + 3];
  if (alpha < 250 || Math.max(red, green, blue) - Math.min(red, green, blue) < 40) continue;
  const key = `${red},${green},${blue}`;
  histogram.set(key, (histogram.get(key) ?? 0) + 1);
}

const dominant = [...histogram.entries()]
  .sort((left, right) => right[1] - left[1])
  .slice(0, 3)
  .map(([rgb, pixels]) => {
    const channels = rgb.split(",").map(Number);
    const hex = `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
    return { rgb, hex, pixels };
  });

console.table(dominant);
