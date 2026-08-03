import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Prospeca" },
      {
        name: "description",
        content:
          "Como a Prospeca trata dados pessoais, conforme a LGPD: coleta, uso, retenção e seus direitos.",
      },
      { property: "og:title", content: "Política de Privacidade — Prospeca" },
    ],
    links: [{ rel: "canonical", href: "/privacidade" }],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-bold mb-6">Política de Privacidade — Prospeca</h1>
      <p className="text-sm text-muted-foreground mb-8">Última atualização: Julho de 2026</p>

      <div className="prose prose-sm max-w-none space-y-4 text-muted-foreground">
        {/* TODO(founder): a LGPD exige identificar o controlador (razão social,
        CNPJ, endereço) — não fabricar estes dados. Preencher aqui e no rodapé
        de contato (seção 11) assim que a empresa estiver formalizada. */}
        <h2 className="text-base font-semibold text-foreground">1. Introdução</h2>
        <p>
          Esta Política de Privacidade descreve como a Prospeca (&ldquo;nós&rdquo;,
          &ldquo;nosso&rdquo;) coleta, usa, armazena e compartilha dados pessoais, em conformidade
          com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
        </p>

        <h2 className="text-base font-semibold text-foreground">2. Dados que Coletamos</h2>
        <p>
          <strong>Dados fornecidos por você:</strong> nome, e-mail, telefone (opcional), nome da
          empresa e informações de perfil durante o cadastro.
        </p>
        <p>
          <strong>Dados coletados automaticamente:</strong> endereço IP, tipo de navegador, páginas
          acessadas, tempo de uso e interações com a Plataforma para fins de segurança, análise e
          melhoria do produto.
        </p>
        <p>
          <strong>Dados de terceiros:</strong> informações públicas de empresas (nome, endereço,
          telefone, website, redes sociais) obtidas via Google Places API e enriquecimento
          automatizado.
        </p>

        <h2 className="text-base font-semibold text-foreground">3. Finalidade do Tratamento</h2>
        <p>Utilizamos seus dados para:</p>
        <ul>
          <li>Fornecer e operar a Plataforma;</li>
          <li>Personalizar sua experiência;</li>
          <li>Enviar comunicações relacionadas ao serviço;</li>
          <li>Melhorar a Plataforma com base em uso e feedback;</li>
          <li>Cumprir obrigações legais.</li>
        </ul>

        <h2 className="text-base font-semibold text-foreground">4. Base Legal</h2>
        <p>O tratamento de dados é realizado com base em:</p>
        <ul>
          <li>
            <strong>Execução de contrato:</strong> para fornecer o serviço contratado;
          </li>
          <li>
            <strong>Consentimento:</strong> para comunicações de marketing e cookies não essenciais;
          </li>
          <li>
            <strong>Legítimo interesse:</strong> para análise de uso e prevenção a fraudes.
          </li>
        </ul>

        <h2 className="text-base font-semibold text-foreground">5. Retenção e Exclusão de Dados</h2>
        <p>
          Seus dados pessoais são mantidos enquanto sua conta estiver ativa. Você pode solicitar a
          exclusão a qualquer momento através das configurações da conta. Dados de terceiros não
          convertidos em leads são automaticamente expurgados após 90 dias.
        </p>

        <h2 className="text-base font-semibold text-foreground">6. Seus Direitos (LGPD)</h2>
        <p>Você tem direito a:</p>
        <ul>
          <li>Confirmar a existência de tratamento de seus dados;</li>
          <li>Acessar seus dados;</li>
          <li>Corrigir dados incompletos ou desatualizados;</li>
          <li>Solicitar a exclusão de dados desnecessários ou tratados em desconformidade;</li>
          <li>Revogar consentimento, quando aplicável;</li>
          <li>Solicitar a portabilidade de seus dados.</li>
        </ul>
        <p>
          Para exercer seus direitos, entre em contato pelo e-mail abaixo. Responderemos em até 15
          dias.
        </p>

        <h2 className="text-base font-semibold text-foreground">
          7. Compartilhamento com Terceiros
        </h2>
        <p>Compartilhamos dados apenas quando necessário para operar a Plataforma:</p>
        <ul>
          <li>
            <strong>Supabase:</strong> infraestrutura de banco de dados e autenticação;
          </li>
          <li>
            <strong>Google Places API:</strong> busca de informações públicas de empresas.
          </li>
        </ul>
        <p>Não vendemos, alugamos ou compartilhamos dados pessoais para fins de marketing.</p>

        <h2 className="text-base font-semibold text-foreground">7.1 Pagamentos</h2>
        <p>
          Quando o processamento de pagamentos for habilitado, dados de cobrança (nome, e-mail,
          dados do cartão ou PIX) serão processados diretamente pelo provedor de pagamentos
          escolhido, que nunca compartilha o número completo do cartão conosco.
        </p>

        <h2 className="text-base font-semibold text-foreground">8. Segurança</h2>
        <p>
          Adotamos medidas técnicas e organizacionais para proteger seus dados: criptografia em
          trânsito (TLS) e em repouso, isolamento lógico entre organizações (Row Level Security),
          rate limiting e auditoria de acessos.
        </p>

        <h2 className="text-base font-semibold text-foreground">9. Cookies</h2>
        <p>
          Utilizamos cookies essenciais para autenticação e funcionamento da Plataforma. Não
          utilizamos cookies de rastreamento ou publicidade.
        </p>

        <h2 className="text-base font-semibold text-foreground">10. Alterações</h2>
        <p>
          Esta política pode ser atualizada. Alterações significativas serão comunicadas por e-mail
          com antecedência de 15 dias.
        </p>

        <h2 className="text-base font-semibold text-foreground">11. Contato do Encarregado</h2>
        <p>
          Para questões sobre privacidade ou para exercer seus direitos, contate nosso Encarregado
          de Dados (DPO):
        </p>
        <p>
          E-mail:{" "}
          <a href="mailto:privacidade@prospeca.com.br" className="text-primary underline">
            privacidade@prospeca.com.br
          </a>
        </p>
      </div>
    </div>
  );
}
