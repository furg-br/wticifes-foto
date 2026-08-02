import Link from "next/link";

export const metadata = { title: "Privacidade — WTICIFES 2026" };

export default function Privacidade() {
  return (
    <main className="legal">
      <article>
        <h1>Privacidade</h1>
        <p>Última atualização: 2 de agosto de 2026.</p>
        <h2>Dados tratados</h2>
        <p>
          A aplicação recebe uma fotografia e dados técnicos mínimos para segurança. Não exige nome,
          e-mail ou cadastro. Se futuramente for informado um token de inscrição, guardamos apenas um
          HMAC irreversível para aplicar limites; endereços de rede também são pseudonimizados antes do uso.
        </p>
        <h2>Personalização privada</h2>
        <p>
          A foto de entrada passa por um espaço privado transitório da Vercel para superar o limite de
          upload das Functions e é apagada assim que o servidor a lê, antes da composição. Uploads
          abandonados são eliminados automaticamente. Sharp aplica orientação, limites e a identidade
          visual estática aprovada; nenhuma fotografia é enviada a um serviço de inteligência artificial.
          EXIF, GPS e outros metadados são removidos.
        </p>
        <h2>Consentimento e revisão</h2>
        <p>
          Criar e baixar a arte não autoriza publicação. A vitrine só recebe a imagem após a marcação
          explícita da autorização e, ainda assim, uma pessoa da equipe precisa aprová-la. Conteúdo
          rejeitado não é exibido. Não há moderação automática ativa nem envio da foto a serviços externos
          de moderação.
        </p>
        <h2>Exibição pública</h2>
        <p>
          Imagens aprovadas podem aparecer publicamente na página da vitrine e em televisões, projetores
          ou outras telas do WTICIFES 2026. A vitrine não mostra nome, legenda, token ou identificador do
          participante.
        </p>
        <h2>Retenção e revogação</h2>
        <p>
          Resultados privados são mantidos por até 24 horas; itens pendentes, por até 72 horas; rejeitados
          e removidos são apagados imediatamente ou no próximo ciclo de limpeza; aprovados expiram em até
          30 dias. Esses prazos podem ser reduzidos pela organização. O botão “Revogar e apagar” usa um
          token exclusivo que não é guardado em texto puro no servidor. A pessoa pode copiar esse código
          e usá-lo depois nesta página; também é possível pedir a remoção pelos canais oficiais.
        </p>
        <h2>Infraestrutura</h2>
        <p>
          Vercel processa a aplicação e o Blob privado, Neon fornece o banco Postgres de metadados e
          Upstash fornece Redis para limites e idempotência. Os registros operacionais não incluem a foto,
          tokens completos, endereço IP em texto puro nem URLs privadas completas.
        </p>
        <h2>Contato</h2>
        <p>
          Para revogação, exclusão ou dúvidas de privacidade, utilize o canal oficial publicado em
          <a href="https://wticifes.com.br/"> wticifes.com.br</a> e informe o identificador da imagem;
          nunca envie o token em canal público.
        </p>
        <Link href="/">Voltar</Link>
      </article>
    </main>
  );
}
