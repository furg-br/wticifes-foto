import { createHash, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const OFFICIAL_URL =
  "https://wticifes.com.br/2026/wp-content/uploads/sites/4/2026/02/wticifes2026_logo-1536x469.png";
const LOCAL_FILE = fileURLToPath(new URL("../public/wticifes2026-logo.png", import.meta.url));

function sha256(data) {
  return createHash("sha256").update(data).digest();
}

const local = await readFile(LOCAL_FILE);
const response = await fetch(OFFICIAL_URL, {
  redirect: "follow",
  cache: "no-store",
  signal: AbortSignal.timeout(20_000),
  headers: { Accept: "image/png", "Accept-Encoding": "identity" },
});

if (!response.ok) {
  throw new Error(`Falha ao baixar o logo oficial: HTTP ${response.status}.`);
}

const remote = Buffer.from(await response.arrayBuffer());
const localHash = sha256(local);
const remoteHash = sha256(remote);

console.log(`Logo local:  ${localHash.toString("hex")} (${local.byteLength} bytes)`);
console.log(`Logo remoto: ${remoteHash.toString("hex")} (${remote.byteLength} bytes)`);

if (local.byteLength !== remote.byteLength || !timingSafeEqual(localHash, remoteHash)) {
  throw new Error("O logo local não contém exatamente os mesmos bytes do arquivo oficial.");
}

console.log("Logo verificado: os arquivos são idênticos.");
