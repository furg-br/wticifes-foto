import Image from "next/image";
import Link from "next/link";
import { PhotoPersonalizer } from "./photo-personalizer";

export default function Home() {
  return (
    <main>
      <section className="hero" aria-labelledby="titulo">
        <Image
          className="logo"
          src="/wticifes2026-logo.png"
          width={1536}
          height={469}
          priority
          alt="WTICIFES Rio Grande do Sul 2026"
        />
        <h1 id="titulo">
          <span>Eu</span> <strong>fui,</strong> <em>tchê!</em>
        </h1>
        <p className="intro">
          Envie uma fotografia diretamente por esta página. O serviço preserva a foto inteira
          e acrescenta a identidade do evento em uma faixa separada.
        </p>
        <PhotoPersonalizer />
        <nav aria-label="Informações legais">
          <Link href="/vitrine">Vitrine pública</Link>
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/termos">Termos de uso</Link>
          <Link href="/openapi.json">OpenAPI</Link>
        </nav>
      </section>
    </main>
  );
}
