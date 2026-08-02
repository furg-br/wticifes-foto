import type { Metadata } from "next";
import { Lato } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  style: ["normal", "italic"],
  variable: "--font-lato",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Eu fui, tchê! — WTICIFES 2026",
  description:
    "Aplicação oficial do WTICIFES 2026 para personalizar sua fotografia com segurança.",
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();

  return (
    <html lang="pt-BR">
      <body className={lato.variable}>{children}</body>
    </html>
  );
}
