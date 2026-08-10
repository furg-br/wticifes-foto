import { expect, test } from "@playwright/test";

test("a página do espaço apresenta upload direto", async ({ page }) => {
  const cspErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Content Security Policy")) {
      cspErrors.push(message.text());
    }
  });
  await page.route("**/api/wticifes-2026/estatisticas", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        total_personalizations: 321,
        unique_participants: 198,
        today_personalizations: 87,
        showcase_photos: 42,
        updated_at: "2026-08-03T12:00:00.000Z",
      }),
    });
  });

  await page.goto("/wticifes-2026");
  const slogan = page.getByRole("heading", { name: "Eu fui, tchê!" });
  await expect(slogan).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "WTICIFES 2026 em números" })).toBeVisible();
  await expect(page.getByText("321", { exact: true })).toBeVisible();
  await expect(page.getByText("198", { exact: true })).toBeVisible();
  await expect(page.getByText("87", { exact: true })).toBeVisible();
  await expect(page.getByText("42", { exact: true })).toBeVisible();
  expect(cspErrors).toEqual([]);
});

test("admin falha fechado sem OAuth completo", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Painel indisponível" })).toBeVisible();
  await expect(page.getByText(/autenticação administrativa não está configurada/i)).toBeVisible();
});

test("vitrine tem fallback e controle de tela cheia", async ({ page }) => {
  await page.goto("/wticifes-2026/vitrine");
  await expect(page.getByRole("button", { name: "Tela cheia" })).toBeVisible();
  await expect(page.getByAltText("WTICIFES 2026", { exact: true })).toBeVisible();
  const qrLink = page.getByRole("link", { name: "Abrir a página para criar sua foto" });
  await expect(qrLink).toBeVisible();
  const qrStripe = await qrLink.evaluate((element) =>
    window.getComputedStyle(element, "::before").backgroundImage,
  );
  const greenPosition = qrStripe.indexOf("rgb(103, 145, 87)");
  const redPosition = qrStripe.indexOf("rgb(201, 2, 22)");
  const yellowPosition = qrStripe.indexOf("rgb(255, 179, 3)");
  expect(greenPosition).toBeGreaterThanOrEqual(0);
  expect(redPosition).toBeGreaterThan(greenPosition);
  expect(yellowPosition).toBeGreaterThan(redPosition);
  expect(new URL((await qrLink.getAttribute("href")) ?? "", page.url()).pathname).toBe("/wticifes-2026");
  await expect(page.getByAltText("QR Code para criar sua foto de WTICIFES 2026")).toBeVisible();
});

test("vitrine distribui fotos aprovadas em mosaico masonry", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.route("**/test-showcase-*.svg", async (route) => {
    const index = Number(route.request().url().match(/test-showcase-(\d+)\.svg/)?.[1] ?? 0);
    const dimensions = [
      { width: 800, height: 1200 },
      { width: 900, height: 900 },
      { width: 1200, height: 760 },
    ][index % 3] ?? { width: 900, height: 900 };
    await route.fulfill({
      contentType: "image/svg+xml",
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.width}" height="${dimensions.height}"><rect width="100%" height="100%" fill="#679157"/></svg>`,
    });
  });
  await page.route("**/api/wticifes-2026/vitrine/feed", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        images: Array.from({ length: 12 }, (_, index) => ({
          url: `/test-showcase-${index}.svg`,
          expires_at: "2099-01-01T00:00:00.000Z",
        })),
      }),
    });
  });

  await page.goto("/wticifes-2026/vitrine");
  const mosaic = page.getByRole("list", { name: "Fotos aprovadas de WTICIFES 2026" });
  await expect(mosaic).toBeVisible();
  await expect(mosaic.getByRole("listitem")).toHaveCount(13);
  await expect(mosaic).toHaveCSS("column-count", "5");
  const photos = mosaic.locator(".showcase-photo");
  await expect(photos).toHaveCount(12);
  await photos.evaluateAll((images) => Promise.all(images.map((image) => (image as HTMLImageElement).decode())));
  const firstPhoto = photos.first();
  await expect(firstPhoto).toHaveCSS("max-height", "486px");
  await expect(firstPhoto).toHaveCSS("object-fit", "contain");
  const photosInsideViewport = await photos.evaluateAll((images) => images.filter((image) => {
    const bounds = image.getBoundingClientRect();
    return bounds.top < window.innerHeight && bounds.bottom > 0;
  }).length);
  expect(photosInsideViewport).toBeGreaterThanOrEqual(11);

  const qrCard = page.getByRole("link", { name: "Abrir a página para criar sua foto" });
  await expect(qrCard).toBeVisible();
  await expect(qrCard.locator("xpath=ancestor::figure")).toHaveClass(/showcase-qr-tile/);
});
