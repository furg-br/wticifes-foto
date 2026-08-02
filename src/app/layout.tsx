import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eu fui, tchê! — WTICIFES 2026",
  description:
    "Aplicação oficial do WTICIFES 2026 para personalizar sua fotografia com segurança.",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
