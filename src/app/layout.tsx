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
  title: "Personalize sua foto",
  description: "Serviço para personalizar fotografias de eventos com segurança.",
  icons: {
    icon: [{ url: "/wticifes2026-favicon.png", type: "image/png" }],
    shortcut: ["/wticifes2026-favicon.png"],
  },
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
