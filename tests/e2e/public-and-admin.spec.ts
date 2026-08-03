import { expect, test } from "@playwright/test";

test("a aplicação standalone apresenta upload direto", async ({ page }) => {
  const cspErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Content Security Policy")) {
      cspErrors.push(message.text());
    }
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Eu fui, tchê!" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Crie sua foto" })).toBeVisible();
  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
  await fileInput.setInputFiles({
    name: "foto.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });
  await expect(page.getByRole("button", { name: "Personalizar foto" })).toBeEnabled();
  await expect(page.getByText("Experiência oficial", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Sem IA generativa", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Sem recorte da foto", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Metadados removidos", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Blob privado e temporário", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Envie uma fotografia diretamente por esta página/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "OpenAPI" })).toHaveCount(0);
  await expect(page.getByText(/GPT Action|ChatGPT/i)).toHaveCount(0);
  expect(cspErrors).toEqual([]);
});

test("admin falha fechado sem OAuth completo", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Painel indisponível" })).toBeVisible();
  await expect(page.getByText(/acesso permanece bloqueado/i)).toBeVisible();
});

test("vitrine tem fallback e controle de tela cheia", async ({ page }) => {
  await page.goto("/vitrine");
  await expect(page.getByRole("button", { name: "Tela cheia" })).toBeVisible();
  await expect(page.getByAltText("WTICIFES Rio Grande do Sul 2026")).toBeVisible();
  const qrLink = page.getByRole("link", { name: "Abrir a página para criar sua foto" });
  await expect(qrLink).toBeVisible();
  expect(new URL((await qrLink.getAttribute("href")) ?? "", page.url()).pathname).toBe("/");
  await expect(page.getByAltText("QR Code para criar sua foto do WTICIFES 2026")).toBeVisible();
});

test("vitrine distribui fotos aprovadas em mosaico masonry", async ({ page }) => {
  await page.route("**/api/vitrine/feed", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        images: Array.from({ length: 6 }, (_, index) => ({
          url: `/wticifes2026-logo.png?masonry=${index}`,
          expires_at: "2099-01-01T00:00:00.000Z",
        })),
      }),
    });
  });

  await page.goto("/vitrine");
  const mosaic = page.getByRole("list", { name: "Fotos aprovadas do WTICIFES 2026" });
  await expect(mosaic).toBeVisible();
  await expect(mosaic.getByRole("listitem")).toHaveCount(7);
  await expect(mosaic).toHaveCSS("column-count", "4");

  const qrCard = page.getByRole("link", { name: "Abrir a página para criar sua foto" });
  await expect(qrCard).toBeVisible();
  await expect(qrCard.locator("xpath=ancestor::figure")).toHaveClass(/showcase-qr-tile/);
});
