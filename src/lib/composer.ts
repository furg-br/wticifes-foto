import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { AppError } from "./app-error";
import { BRAND, OFFICIAL_LOGO_SHA256 } from "./brand";
import { INPUT_LIMITS, OUTPUT } from "./constants";

sharp.cache({ files: 0, items: 32, memory: 64 });
sharp.concurrency(1);

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CompositionLayout {
  mode: "horizontal" | "stacked";
  bandHeight: number;
  logo: Box;
  phrase: Box;
}

export interface PersonalizedImage {
  data: Buffer;
  width: number;
  height: number;
  photoWidth: number;
  photoHeight: number;
  bandHeight: number;
  layout: CompositionLayout["mode"];
}

const fontPath = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "public",
  "fonts",
  "Lato-Black.ttf",
);
const FONT_SHA256 = "808c62839c62dbce7de689af7603666fc7f8b81e0df537d8a5212c87580d4337";

let logoPromise: Promise<Buffer> | undefined;
let fontPromise: Promise<void> | undefined;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

export function calculateLayout(photoWidth: number, photoHeight: number): CompositionLayout {
  const aspectRatio = photoWidth / photoHeight;
  const horizontal = aspectRatio >= 1.25 && photoWidth >= 800;
  const margin = Math.max(8, Math.min(clamp(photoWidth * 0.045, 12, 88), Math.floor(photoWidth * 0.1)));

  if (horizontal) {
    const bandHeight = clamp(photoWidth * 0.18, 220, 420);
    const innerWidth = photoWidth - margin * 2;
    const logoWidth = Math.round(innerWidth * 0.43);
    return {
      mode: "horizontal",
      bandHeight,
      logo: {
        left: margin,
        top: margin,
        width: logoWidth,
        height: bandHeight - margin * 2,
      },
      phrase: {
        left: margin + logoWidth + margin,
        top: margin,
        width: innerWidth - logoWidth - margin,
        height: bandHeight - margin * 2,
      },
    };
  }

  const bandHeight = clamp(photoWidth * 0.44, 180, 620);
  const innerWidth = photoWidth - margin * 2;
  const logoHeight = Math.round((bandHeight - margin * 3) * 0.48);
  return {
    mode: "stacked",
    bandHeight,
    logo: {
      left: margin,
      top: margin,
      width: innerWidth,
      height: logoHeight,
    },
    phrase: {
      left: margin,
      top: margin * 2 + logoHeight,
      width: innerWidth,
      height: bandHeight - logoHeight - margin * 3,
    },
  };
}

async function loadOfficialLogo(): Promise<Buffer> {
  logoPromise ??= readFile(
    path.join(process.cwd(), "public", "wticifes2026-logo.png"),
  ).then((data) => {
    const hash = createHash("sha256").update(data).digest("hex");
    if (hash !== OFFICIAL_LOGO_SHA256) {
      throw new AppError(
        "INVALID_BRAND_ASSET",
        500,
        "O ativo oficial de marca está inválido.",
      );
    }
    return data;
  });
  return logoPromise;
}

async function verifyFont(): Promise<void> {
  fontPromise ??= readFile(fontPath).then((data) => {
    const hash = createHash("sha256").update(data).digest("hex");
    if (hash !== FONT_SHA256) {
      throw new AppError("INVALID_FONT_ASSET", 500, "O arquivo local da fonte Lato está inválido.");
    }
  });
  return fontPromise;
}

function detectFormat(data: Buffer): "jpeg" | "png" | "webp" | undefined {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpeg";
  if (
    data.length >= 8 &&
    data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "png";
  }
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return undefined;
}

function mimeMatchesFormat(mimeType: string, format: string): boolean {
  if (format === "jpeg") return mimeType === "image/jpeg" || mimeType === "image/jpg";
  return mimeType === `image/${format}`;
}

async function normalizePhoto(data: Buffer, mimeType: string) {
  const detected = detectFormat(data);
  if (!detected || !mimeMatchesFormat(mimeType, detected)) {
    throw new AppError("INVALID_IMAGE", 415, "O arquivo enviado não é uma fotografia JPG, PNG ou WebP válida.");
  }

  try {
    const metadata = await sharp(data, {
      failOn: "error",
      limitInputPixels: INPUT_LIMITS.inputPixels,
      sequentialRead: true,
      animated: false,
    }).metadata();

    if (
      metadata.format !== detected ||
      !metadata.width ||
      !metadata.height ||
      metadata.width < INPUT_LIMITS.minimumDimension ||
      metadata.height < INPUT_LIMITS.minimumDimension ||
      (metadata.pages ?? 1) !== 1
    ) {
      throw new AppError(
        "INVALID_IMAGE",
        415,
        `A fotografia deve ter ao menos ${INPUT_LIMITS.minimumDimension} pixels em cada dimensão e um único quadro.`,
      );
    }

    return await sharp(data, {
      failOn: "error",
      limitInputPixels: INPUT_LIMITS.inputPixels,
      sequentialRead: true,
      animated: false,
    })
      .autoOrient()
      .resize({
        width: INPUT_LIMITS.outputWidth,
        height: INPUT_LIMITS.outputHeight,
        fit: "inside",
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3,
      })
      .flatten({ background: "#FFFFFF" })
      .toColourspace("srgb")
      .png({ compressionLevel: 6, adaptiveFiltering: false })
      .toBuffer({ resolveWithObject: true });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("INVALID_IMAGE", 415, "Não foi possível decodificar a fotografia.", {
      cause: error,
    });
  }
}

async function renderLogo(box: Box): Promise<{ data: Buffer; width: number; height: number }> {
  const logo = await loadOfficialLogo();
  const rendered = await sharp(logo)
    .resize({
      width: box.width,
      height: box.height,
      fit: "inside",
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 6, adaptiveFiltering: false })
    .toBuffer({ resolveWithObject: true });
  return { data: rendered.data, width: rendered.info.width, height: rendered.info.height };
}

async function renderPhrase(box: Box): Promise<{ data: Buffer; width: number; height: number }> {
  await verifyFont();
  const markup = [
    `<span foreground="${BRAND.red}">Eu</span>`,
    `<span foreground="${BRAND.yellow}">fui,</span>`,
    `<span foreground="${BRAND.green}">tchê!</span>`,
  ].join(" ");

  const rendered = await sharp({
    text: {
      text: markup,
      font: "Lato Black",
      fontfile: fontPath,
      width: Math.max(1, box.width),
      height: Math.max(1, box.height),
      align: "centre",
      rgba: true,
      wrap: "none",
    },
  })
    .png({ compressionLevel: 6, adaptiveFiltering: false })
    .toBuffer({ resolveWithObject: true });

  return { data: rendered.data, width: rendered.info.width, height: rendered.info.height };
}

function centeredPosition(box: Box, width: number, height: number, photoHeight: number) {
  return {
    left: box.left + Math.max(0, Math.floor((box.width - width) / 2)),
    top: photoHeight + box.top + Math.max(0, Math.floor((box.height - height) / 2)),
  };
}

export async function personalizePhoto(data: Buffer, mimeType: string): Promise<PersonalizedImage> {
  const photo = await normalizePhoto(data, mimeType);
  const photoWidth = photo.info.width;
  const photoHeight = photo.info.height;
  const layout = calculateLayout(photoWidth, photoHeight);
  const [logo, phrase] = await Promise.all([
    renderLogo(layout.logo).catch((cause: unknown) => {
      if (cause instanceof AppError) throw cause;
      throw new AppError("LOGO_RENDER_FAILED", 500, "Não foi possível renderizar o logo.", { cause });
    }),
    renderPhrase(layout.phrase).catch((cause: unknown) => {
      if (cause instanceof AppError) throw cause;
      throw new AppError("PHRASE_RENDER_FAILED", 500, "Não foi possível renderizar a frase.", { cause });
    }),
  ]);
  const logoPosition = centeredPosition(layout.logo, logo.width, logo.height, photoHeight);
  const phrasePosition = centeredPosition(layout.phrase, phrase.width, phrase.height, photoHeight);
  const height = photoHeight + layout.bandHeight;

  let output: Buffer;
  try {
    output = await sharp({
      create: {
        width: photoWidth,
        height,
        channels: 3,
        background: BRAND.bandBackground,
      },
    })
      .composite([
        { input: photo.data, left: 0, top: 0 },
        { input: logo.data, ...logoPosition },
        { input: phrase.data, ...phrasePosition },
      ])
      .toColourspace("srgb")
      .withIccProfile("srgb")
      .jpeg({
        quality: OUTPUT.jpegQuality,
        chromaSubsampling: "4:4:4",
        optimiseCoding: false,
        optimiseScans: false,
        trellisQuantisation: false,
        overshootDeringing: false,
      })
      .toBuffer();
  } catch (cause) {
    throw new AppError("COMPOSITION_FAILED", 500, "Não foi possível compor a imagem.", { cause });
  }

  let finalWidth = photoWidth;
  let finalHeight = height;
  let finalPhotoHeight = photoHeight;
  let finalBandHeight = layout.bandHeight;
  while (output.byteLength > OUTPUT.functionSafeBytes && finalWidth > 640) {
    const scale = Math.max(
      0.72,
      Math.min(0.92, Math.sqrt(OUTPUT.functionSafeBytes / output.byteLength) * 0.96),
    );
    const targetWidth = Math.max(640, Math.floor(finalWidth * scale));
    const resized = await sharp(output)
        .resize({ width: targetWidth, withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
        .toColourspace("srgb")
        .withIccProfile("srgb")
        .jpeg({
          quality: OUTPUT.jpegQuality,
          chromaSubsampling: "4:4:4",
          optimiseCoding: false,
          optimiseScans: false,
          trellisQuantisation: false,
          overshootDeringing: false,
        })
        .toBuffer({ resolveWithObject: true })
        .catch((cause: unknown) => {
          throw new AppError("OUTPUT_RESIZE_FAILED", 500, "Não foi possível ajustar a saída JPEG.", { cause });
        });
    const appliedScale = resized.info.width / finalWidth;
    output = resized.data;
    finalWidth = resized.info.width;
    finalHeight = resized.info.height;
    finalPhotoHeight = Math.round(finalPhotoHeight * appliedScale);
    finalBandHeight = finalHeight - finalPhotoHeight;
  }

  return {
    data: output,
    width: finalWidth,
    height: finalHeight,
    photoWidth: finalWidth,
    photoHeight: finalPhotoHeight,
    bandHeight: finalBandHeight,
    layout: layout.mode,
  };
}
