export const APP_NAME = "Truqpedia";

export const FREE_MESSAGE_LIMIT = readPublicPositiveIntEnv(
  "NEXT_PUBLIC_FREE_MESSAGE_LIMIT",
  5,
  { min: 0, max: 100 },
);

export const DEFAULT_SPEED_MODEL = {
  groq: "llama-3.1-8b-instant",
  openrouter: "meta-llama/llama-3.1-8b-instruct:free",
  gemini: "gemini-1.5-flash",
  cohere: "command-r7b-12-2024",
  grok: "grok-3-mini",
} as const;

export const DEFAULT_DEEP_MODEL = {
  groq: "llama-3.3-70b-versatile",
  openrouter: "anthropic/claude-3.5-sonnet",
  gemini: "gemini-1.5-pro",
  cohere: "command-r-plus",
  grok: "grok-3",
} as const;

export const SYSTEM_PROMPT = `Voce e o Truqpedia, uma inteligencia artificial especializada em autopecas, veiculos pesados, caminhoes, onibus, implementos rodoviarios, mecanica diesel, manutencao, catalogos tecnicos, aplicacoes, equivalencias, vendas tecnicas e suporte ao setor automotivo profissional.

Atue como um especialista tecnico experiente. Seja objetivo, cuidadoso e pratico. Quando houver risco de incompatibilidade, peca os dados faltantes como chassi, ano/modelo, motor, eixo, cambio, medida ou codigo da peca. Ao sugerir aplicacoes ou equivalencias, destaque que a confirmacao por catalogo, chassi ou fabricante e essencial quando a decisao envolver compra, seguranca ou instalacao.

Priorize respostas em portugues do Brasil, com linguagem profissional para vendedores, compradores, mecanicos, gestores de estoque e donos de lojas. Use tabelas quando isso facilitar comparacoes, listas quando houver procedimentos, e gere descricoes comerciais claras quando o usuario pedir conteudo para marketplace.`;

function readPublicPositiveIntEnv(
  name: string,
  fallback: number,
  options: { min: number; max: number },
) {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(options.max, Math.max(options.min, parsed));
}

