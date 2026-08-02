import Link from "next/link";

export const metadata = { title: "Termos de uso — WTICIFES 2026" };

export default function Termos() {
  return (
    <main className="legal">
      <article>
        <h1>Termos de uso</h1>
        <p>Última atualização: 2 de agosto de 2026.</p>
        <p>
          Use o serviço somente com fotografias que você tem autorização para enviar e
          compartilhar. Não envie conteúdo ilegal, abusivo ou que viole direitos de
          terceiros.
        </p>
        <p>
          O serviço apenas redimensiona a fotografia quando necessário e adiciona a
          identidade oficial sobre uma tarja branca translúcida. A imagem resultante é disponibilizada temporariamente e pode
          deixar de estar acessível após o prazo de retenção.
        </p>
        <p>
          Uso automatizado, tentativas de contornar limites, assédio, conteúdo impróprio e o envio de
          arquivos maliciosos são proibidos. A equipe pode rejeitar, remover e bloquear novos envios.
        </p>
        <Link href="/">Voltar</Link>
      </article>
    </main>
  );
}
