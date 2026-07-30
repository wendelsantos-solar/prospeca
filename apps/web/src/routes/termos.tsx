import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  component: TermsOfUsePage,
});

function TermsOfUsePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-bold mb-6">Termos de Uso — Radar Local</h1>
      <p className="text-sm text-muted-foreground mb-8">Última atualização: Julho de 2026</p>

      <div className="prose prose-sm max-w-none space-y-4 text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">1. Aceitação dos Termos</h2>
        <p>
          Ao acessar e usar o Radar Local (&ldquo;Plataforma&rdquo;), você concorda com estes Termos
          de Uso. Se você não concordar, não utilize a Plataforma.
        </p>

        <h2 className="text-base font-semibold text-foreground">2. Descrição do Serviço</h2>
        <p>
          O Radar Local é uma plataforma de inteligência comercial e prospecção local que permite
          pesquisar empresas por nicho e localização, analisar oportunidades e organizar leads.
        </p>

        <h2 className="text-base font-semibold text-foreground">3. Cadastro e Conta</h2>
        <p>
          Para usar a Plataforma, você deve criar uma conta com informações verdadeiras. Você é
          responsável por manter a confidencialidade de sua senha e por todas as atividades em sua
          conta.
        </p>

        <h2 className="text-base font-semibold text-foreground">4. Planos e Pagamentos</h2>
        <p>
          A Plataforma oferece planos gratuitos e pagos. As características e limites de cada plano
          estão descritos na página de preços. Para planos pagos, o valor é cobrado mensalmente ou
          anualmente conforme selecionado.
        </p>

        <h2 className="text-base font-semibold text-foreground">5. Uso Aceitável</h2>
        <p>Ao usar a Plataforma, você concorda em:</p>
        <ul>
          <li>Não violar leis aplicáveis, incluindo a LGPD.</li>
          <li>Não usar a Plataforma para spam, assédio ou atividades ilegais.</li>
          <li>Não tentar acessar dados de outros usuários ou organizações.</li>
          <li>Não fazer engenharia reversa, scraping não autorizado ou sobrecarga do sistema.</li>
        </ul>

        <h2 className="text-base font-semibold text-foreground">6. Dados de Terceiros</h2>
        <p>
          Os dados de empresas exibidos na Plataforma são obtidos de fontes públicas (Google Places)
          e enriquecidos automaticamente. O Radar Local não garante a precisão ou atualização desses
          dados. Você é responsável pelo uso que faz dessas informações, incluindo a conformidade
          com a LGPD ao contatar os titulares dos dados.
        </p>

        <h2 className="text-base font-semibold text-foreground">7. Privacidade</h2>
        <p>
          O tratamento de dados pessoais é regido pela nossa Política de Privacidade, disponível em{" "}
          <a href="/privacidade" className="text-primary underline">
            /privacidade
          </a>
          .
        </p>

        <h2 className="text-base font-semibold text-foreground">
          8. Limitação de Responsabilidade
        </h2>
        <p>
          A Plataforma é fornecida &ldquo;como está&rdquo;. O Radar Local não se responsabiliza por
          decisões comerciais tomadas com base nos dados exibidos, indisponibilidade temporária ou
          perda de dados por motivos fora de nosso controle.
        </p>

        <h2 className="text-base font-semibold text-foreground">9. Cancelamento</h2>
        <p>
          Você pode cancelar sua conta a qualquer momento através das configurações. Em caso de
          plano pago, o cancelamento vale para o ciclo seguinte — não há reembolso proporcional do
          ciclo atual.
        </p>

        <h2 className="text-base font-semibold text-foreground">10. Alterações</h2>
        <p>
          Estes Termos podem ser atualizados periodicamente. Alterações significativas serão
          comunicadas por e-mail com antecedência mínima de 15 dias.
        </p>

        <h2 className="text-base font-semibold text-foreground">11. Contato</h2>
        <p>
          Dúvidas sobre estes Termos? Entre em contato:{" "}
          <a href="mailto:suporte@radarlocal.com.br" className="text-primary underline">
            suporte@radarlocal.com.br
          </a>
        </p>
      </div>
    </div>
  );
}
