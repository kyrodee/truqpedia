export type BillingPlanId = "balcao" | "loja" | "operacao";

export type BillingPlan = {
  id: BillingPlanId;
  name: string;
  price: string;
  priceDescription: string;
  description: string;
  featured?: boolean;
  features: string[];
  checkoutLabel: string;
};

export const billingPlans: BillingPlan[] = [
  {
    id: "balcao",
    name: "Balcão",
    price: "R$ 49",
    priceDescription: "por usuário/mês",
    description:
      "Para atendimento diário, triagem de aplicação e respostas mais seguras ao cliente.",
    features: [
      "Chat técnico com histórico",
      "Busca automática quando fizer sentido",
      "Mensagens para WhatsApp e orçamento",
    ],
    checkoutLabel: "Começar no Balcão",
  },
  {
    id: "loja",
    name: "Loja",
    price: "R$ 149",
    priceDescription: "por loja/mês",
    featured: true,
    description:
      "Para organizar clientes, frotas, orçamentos e documentos técnicos em equipe.",
    features: [
      "Projetos por cliente, frota ou catálogo",
      "Documentos editáveis e exportáveis",
      "Fluxos para anúncio, equivalência e compra",
    ],
    checkoutLabel: "Assinar Loja",
  },
  {
    id: "operacao",
    name: "Operação",
    price: "Sob consulta",
    priceDescription: "para equipes maiores",
    description:
      "Para distribuidoras, redes e operações com base técnica própria e integrações.",
    features: [
      "Equipe e permissões avançadas",
      "Base técnica própria",
      "Integrações e implantação assistida",
    ],
    checkoutLabel: "Falar sobre Operação",
  },
];

export function getBillingPlan(planId: string | undefined | null) {
  return billingPlans.find((plan) => plan.id === planId) ?? billingPlans[1];
}

