import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { AppError } from "./app-error";
import { OFFICIAL_LOGO_SHA256, OFFICIAL_PHRASE_SHA256 } from "./brand";
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
  mode: "overlay";
  backdrop: Box;
  logo: Box;
  phrase: Box;
}

export interface PersonalizedImage {
  data: Buffer;
  width: number;
  height: number;
  photoWidth: number;
  photoHeight: number;
  layout: CompositionLayout["mode"];
}

let logoPromise: Promise<Buffer> | undefined;
let phrasePromise: Promise<Buffer> | undefined;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

export function calculateLayout(photoWidth: number, photoHeight: number): CompositionLayout {
  const margin = Math.max(
    6,
    Math.min(clamp(photoWidth * 0.025, 8, 56), Math.floor(photoWidth * 0.08)),
  );
  const backdropPadding = Math.max(4, Math.round(margin * 0.55));
  const desiredHeight = clamp(Math.min(photoWidth * 0.28, photoHeight * 0.28), 48, 560);
  const contentHeight = Math.max(24, Math.min(desiredHeight, photoHeight - margin * 2));
  const backdropHeight = Math.min(photoHeight, contentHeight + backdropPadding * 2);
  const backdropTop = Math.max(0, photoHeight - margin - backdropHeight);
  const contentTop = backdropTop + backdropPadding;
  const gap = margin;
  const innerWidth = photoWidth - margin * 2;
  const availableWidth = innerWidth - gap;
  const logoWidth = Math.round(availableWidth * 0.48);
  const backdropInset = Math.max(0, Math.round(margin * 0.45));

  return {
    mode: "overlay",
    backdrop: {
      left: backdropInset,
      top: backdropTop,
      width: photoWidth - backdropInset * 2,
      height: backdropHeight,
    },
    logo: {
      left: margin,
      top: contentTop,
      width: logoWidth,
      height: contentHeight,
    },
    phrase: {
      left: margin + logoWidth + gap,
      top: contentTop,
      width: availableWidth - logoWidth,
      height: contentHeight,
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

async function loadApprovedPhrase(): Promise<Buffer> {
  phrasePromise ??= readFile(
    path.join(process.cwd(), "public", "wticifes2026-phrase-brush.png"),
  ).then((data) => {
    const hash = createHash("sha256").update(data).digest("hex");
    if (hash !== OFFICIAL_PHRASE_SHA256) {
      throw new AppError(
        "INVALID_PHRASE_ASSET",
        500,
        "O lettering aprovado está inválido.",
      );
    }
    return data;
  });
  return phrasePromise;
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
  const phrase = await loadApprovedPhrase();
  const rendered = await sharp(phrase)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
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

function centeredPosition(box: Box, width: number, height: number) {
  return {
    left: box.left + Math.max(0, Math.floor((box.width - width) / 2)),
    top: box.top + Math.max(0, Math.floor((box.height - height) / 2)),
  };
}

function renderTranslucentBackdrop(box: Box): Buffer {
  const radius = Math.max(8, Math.round(box.height * 0.16));
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${box.width}" height="${box.height}" viewBox="0 0 ${box.width} ${box.height}"><rect x="1" y="1" width="${Math.max(1, box.width - 2)}" height="${Math.max(1, box.height - 2)}" rx="${radius}" fill="#ffffff" fill-opacity="0.68" stroke="#ffffff" stroke-opacity="0.38" stroke-width="2"/></svg>`,
    "utf8",
  );
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
  const logoPosition = centeredPosition(layout.logo, logo.width, logo.height);
  const phrasePosition = centeredPosition(layout.phrase, phrase.width, phrase.height);
  const backdrop = renderTranslucentBackdrop(layout.backdrop);
  const height = photoHeight;

  let output: Buffer;
  try {
    output = await sharp(photo.data)
      .composite([
        { input: backdrop, left: layout.backdrop.left, top: layout.backdrop.top },
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
    output = resized.data;
    finalWidth = resized.info.width;
    finalHeight = resized.info.height;
    finalPhotoHeight = resized.info.height;
  }

  return {
    data: output,
    width: finalWidth,
    height: finalHeight,
    photoWidth: finalWidth,
    photoHeight: finalPhotoHeight,
    layout: layout.mode,
  };
}
