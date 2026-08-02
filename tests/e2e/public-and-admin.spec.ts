import { expect, test } from "@playwright/test";

test("a aplicação standalone apresenta upload direto", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Eu fui, tchê!" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Crie sua foto" })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
  await expect(page.getByText("Experiência oficial", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Sem IA generativa", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Sem recorte da foto", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Metadados removidos", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Blob privado e temporário", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Envie uma fotografia diretamente por esta página/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "OpenAPI" })).toHaveCount(0);
  await expect(page.getByText(/GPT Action|ChatGPT/i)).toHaveCount(0);
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
});
