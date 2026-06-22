import { SYSTEM_PROMPT } from "@/lib/constants";
import type { ChatIntentId, IntentClassification } from "@/lib/types";

const intentPromptTemplates: Partial<Record<ChatIntentId, string>> = {
  application_check: `Template de validacao de aplicacao:
- Entregue uma conclusao possivel agora, sem prometer compatibilidade.
- Separe fatos confirmados, indicios e dados faltantes.
- Quando houver codigo, chassi, motor, ano, eixo ou posicao, use esses dados para priorizar o checklist.
- Termine com o proximo passo de confirmacao mais curto e pratico.`,
  cross_reference: `Template de cruzamento de codigo:
- Trate codigo exato como a entidade principal da resposta.
- Diferencie equivalencia encontrada, aplicacao provavel e mera mencao em catalogo.
- Se nao houver fonte confiavel, diga isso antes de sugerir alternativas.
- Nao transforme similaridade textual em compatibilidade confirmada.`,
  marketplace_copy: `Template de anuncio tecnico:
- Entregue texto pronto para colar.
- Nao invente estado, origem, garantia, prazo, retirada, entrega, teste feito nem compatibilidade confirmada.
- Use "a confirmar" quando faltar dado comercial ou tecnico.
- Prefira titulo, descricao, aplicacao/compatibilidade, confirmar antes da compra e palavras-chave.`,
  purchase_checklist: `Template de apoio de compra:
- Organize criterio de decisao, perguntas para fornecedor e sinais de alerta.
- Priorize risco de devolucao, garantia, prazo, marca aceita e prova de aplicacao.
- Entregue uma mensagem curta de WhatsApp quando couber.`,
  diagnosis: `Template de diagnostico tecnico:
- Liste hipoteses provaveis por prioridade.
- Inclua testes simples e seguros antes de desmontagem.
- Em freio, direcao, suspensao, pneu, eixo ou motor, destaque quando nao e seguro rodar.
- Nao substitua mecanico, catalogo oficial ou fabricante quando houver risco alto.`,
  technical_explanation: `Template de explicacao tecnica:
- Explique direto, com exemplo de oficina/balcao.
- Mostre como conferir na pratica.
- Liste erros comuns apenas se forem uteis para a decisao.`,
  document_analysis: `Template de analise de documento:
- Diga o que o arquivo realmente mostra.
- Separe achados do documento, lacunas e acao recomendada.
- Cite nome do arquivo, pagina, aba ou linha quando a fonte trouxer esses metadados.`,
  general_support: `Template de suporte geral:
- Responda primeiro o que da para fazer agora.
- Se faltar contexto, faca poucas perguntas objetivas.
- Evite formato tecnico quando a conversa for simples.`,
};

export function buildSystemPrompt(intent?: IntentClassification) {
  const template = intent?.id ? intentPromptTemplates[intent.id] : undefined;

  if (!template) {
    return SYSTEM_PROMPT;
  }

  return `${SYSTEM_PROMPT}\n\n${template}`;
}

export function getIntentPromptTemplate(intentId: ChatIntentId) {
  return intentPromptTemplates[intentId] ?? "";
}
