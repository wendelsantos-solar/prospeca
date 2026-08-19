// Decision Maker Detection — quem, entre as pessoas ligadas a uma empresa,
// provavelmente decide uma compra.
//
// V1 é DETERMINÍSTICA (brief §26): tabela de papéis + regras explícitas. Sem
// LLM, sem heurística oculta, sem número mágico. Toda pontuação sai com o
// motivo em texto, porque o usuário precisa saber POR QUE alguém foi apontado
// como decisor antes de gastar uma ligação com essa pessoa.
//
// DUAS DIMENSÕES SEPARADAS (brief §28):
//   • Decision Maker Score — "esta pessoa decide?" (papel, vigência, natureza);
//   • Data Confidence      — "eu confio neste dado?" (força da fonte).
// Um sócio-administrador achado num QSA oficial é score ALTO e confiança ALTA;
// um "gerente" achado numa fonte fraca seria score médio e confiança baixa.
// Misturar as duas produz um número que não responde nem uma pergunta nem a
// outra.

import type { CompanyPersonRelation } from "./person.ts";

export const DECISION_ROLE_BANDS = ["high", "medium", "low", "unknown"] as const;
export type DecisionRoleBand = (typeof DECISION_ROLE_BANDS)[number];

/**
 * Tabela de papéis — o ÚNICO lugar a ajustar quando um cargo novo aparecer
 * (brief §26: "a lista deve ser centralizada e facilmente ajustável").
 *
 * Casada contra a qualificação NORMALIZADA (minúscula, sem acento), porque a
 * Receita escreve "Sócio-Administrador", "SOCIO ADMINISTRADOR" e
 * "49-Sócio-Administrador" para a mesma coisa.
 *
 * A ordem importa: a primeira regra que casar vence, então os papéis mais
 * específicos vêm antes dos genéricos ("socio administrador" antes de "socio").
 */
export interface DecisionRoleRule {
  band: DecisionRoleBand;
  /** Trecho procurado na qualificação normalizada. */
  match: string;
  /** Motivo legível, mostrado ao usuário. */
  reason: string;
}

export const DECISION_ROLE_RULES: readonly DecisionRoleRule[] = [
  // HIGH — quem administra, dirige ou é dono.
  { band: "high", match: "socio administrador", reason: "Sócio administrador" },
  { band: "high", match: "socio gerente", reason: "Sócio-gerente" },
  { band: "high", match: "administrador", reason: "Administrador" },
  { band: "high", match: "presidente", reason: "Presidente" },
  { band: "high", match: "diretor", reason: "Diretor" },
  { band: "high", match: "proprietario", reason: "Proprietário" },
  { band: "high", match: "titular", reason: "Titular da empresa" },
  { band: "high", match: "empresario", reason: "Empresário individual" },
  { band: "high", match: "fundador", reason: "Fundador" },
  { band: "high", match: "founder", reason: "Fundador" },
  { band: "high", match: "ceo", reason: "CEO" },
  { band: "high", match: "socio", reason: "Sócio" },
  // MEDIUM — influencia, normalmente não assina sozinho.
  { band: "medium", match: "gerente", reason: "Gerente" },
  { band: "medium", match: "coordenador", reason: "Coordenador" },
  { band: "medium", match: "responsavel", reason: "Responsável" },
  { band: "medium", match: "procurador", reason: "Procurador" },
  { band: "medium", match: "conselheiro", reason: "Conselheiro" },
  // LOW — executa, não decide compra.
  { band: "low", match: "assistente", reason: "Assistente" },
  { band: "low", match: "analista", reason: "Analista" },
  { band: "low", match: "estagiario", reason: "Estagiário" },
  { band: "low", match: "auxiliar", reason: "Auxiliar" },
] as const;

/** Minúscula, sem acento, sem pontuação — a forma que a tabela casa. */
export function normalizeRole(role: string | null | undefined): string {
  if (!role) return "";
  return role
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface RoleClassification {
  band: DecisionRoleBand;
  /** Motivo do enquadramento, ou null quando não foi possível classificar. */
  reason: string | null;
}

/**
 * Qualificação → banda de decisão. Determinístico e sem efeito colateral.
 *
 * Qualificação ausente ou desconhecida devolve `unknown` — NUNCA `low`.
 * "Não sei o cargo" e "sei que o cargo é irrelevante" são coisas diferentes, e
 * tratar a primeira como a segunda esconderia decisores de verdade.
 */
export function classifyDecisionRole(role: string | null | undefined): RoleClassification {
  const normalized = normalizeRole(role);
  if (!normalized) return { band: "unknown", reason: null };
  for (const rule of DECISION_ROLE_RULES) {
    if (normalized.includes(rule.match)) return { band: rule.band, reason: rule.reason };
  }
  return { band: "unknown", reason: null };
}

// ── Score ───────────────────────────────────────────────────────────────────

/** Bumpar a cada mudança de fórmula: mudar os pesos muda a ORDEM de abordagem. */
export const DECISION_MAKER_SCORE_VERSION = "v1.0.0";

/** Pontuação base por banda. */
const BAND_BASE: Record<DecisionRoleBand, number> = {
  high: 70,
  medium: 40,
  low: 5,
  // Sem cargo conhecido a pessoa não é descartada nem promovida: fica no meio
  // baixo, esperando uma fonte que diga o papel.
  unknown: 20,
};

export const DECISION_SCORE_WEIGHTS = {
  /** Relação confirmada por registro público oficial. */
  officialSource: 15,
  /** Pessoa física (uma PJ sócia não é, ela mesma, uma pessoa decisora). */
  naturalPerson: 10,
  /** Vínculo com pelo menos este tempo indica permanência, não passagem. */
  tenureYears: 3,
  tenure: 5,
  /** Relação que não é mais vigente. */
  notCurrent: -40,
} as const;

export interface DecisionMakerScore {
  version: string;
  /** 0..100 — "quão provável é que esta pessoa decida". */
  score: number;
  band: DecisionRoleBand;
  /** Motivos legíveis, na ordem em que pesaram. Nunca vazio. */
  reasons: string[];
  /**
   * Confiança NO DADO (≠ score). É a força da fonte que afirma a relação, não
   * a probabilidade de a pessoa decidir.
   */
  dataConfidence: number;
}

export interface DecisionMakerInput {
  role: CompanyPersonRelation["role"];
  memberType: CompanyPersonRelation["memberType"];
  isCurrent: boolean;
  confidence: CompanyPersonRelation["confidence"];
  source: CompanyPersonRelation["source"];
  startedAt: CompanyPersonRelation["startedAt"];
  legalRepresentativeName?: string | null;
}

const DAY_MS = 86_400_000;

function yearsSince(date: string | null | undefined, now: Date): number | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const years = (now.getTime() - d.getTime()) / (365.25 * DAY_MS);
  return years >= 0 ? years : null;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Score explicável de decisor. Toda parcela que soma ou subtrai deixa um
 * motivo — não existe ponto sem justificativa visível (brief §27).
 */
export function calculateDecisionMakerScore(
  input: DecisionMakerInput,
  now: Date = new Date(),
): DecisionMakerScore {
  const classification = classifyDecisionRole(input.role);
  const reasons: string[] = [];
  let score = BAND_BASE[classification.band];

  reasons.push(classification.reason ?? "Cargo não informado pela fonte");

  if (input.source === "qsa") {
    score += DECISION_SCORE_WEIGHTS.officialSource;
    reasons.push("Relação confirmada pelo quadro societário (QSA)");
  }

  if (input.memberType === "person") {
    score += DECISION_SCORE_WEIGHTS.naturalPerson;
  } else if (input.memberType === "company") {
    // Uma holding sócia não atende o telefone. Quem exerce o papel é o
    // representante legal — dizer isso é mais útil que pontuar a PJ.
    reasons.push(
      input.legalRepresentativeName
        ? `Sócio pessoa jurídica — quem responde é ${input.legalRepresentativeName}`
        : "Sócio pessoa jurídica — sem representante legal informado",
    );
  }

  const tenure = yearsSince(input.startedAt, now);
  if (tenure != null && tenure >= DECISION_SCORE_WEIGHTS.tenureYears) {
    score += DECISION_SCORE_WEIGHTS.tenure;
    reasons.push(`Na sociedade há ${Math.floor(tenure)} anos`);
  }

  if (!input.isCurrent) {
    score += DECISION_SCORE_WEIGHTS.notCurrent;
    reasons.push("Relação não consta mais no quadro vigente");
  }

  return {
    version: DECISION_MAKER_SCORE_VERSION,
    score: clamp(score),
    band: classification.band,
    reasons,
    // A confiança acompanha a FONTE da relação. A confiança da IDENTIDADE
    // (mesmo nome = mesma pessoa?) é outra dimensão e vive em `people`.
    dataConfidence: input.confidence,
  };
}

/**
 * Quem abordar primeiro, entre as pessoas conhecidas de uma empresa.
 *
 * Só devolve alguém que a fonte diz ser VIGENTE e que a classificação coloca
 * em `high` ou `medium`. Um "analista" no topo de uma lista curta não é o
 * decisor — é o único nome que apareceu, e apontá-lo como decisor faria o
 * vendedor gastar a primeira abordagem com quem não decide. Nesse caso a
 * resposta honesta é null: "não sei quem decide".
 */
export function pickPrimaryDecisionMaker<
  T extends {
    name: string;
    score: number;
    dataConfidence: number;
    band: DecisionRoleBand;
    isCurrent: boolean;
  },
>(people: readonly T[]): T | null {
  const eligible = people.filter((p) => p.isCurrent && (p.band === "high" || p.band === "medium"));
  if (eligible.length === 0) return null;
  return [...eligible].sort(compareDecisionMakers)[0];
}

/** Ordena decisores para abordagem: score desc, depois confiança, depois nome. */
export function compareDecisionMakers(
  a: { score: number; dataConfidence: number; name: string },
  b: { score: number; dataConfidence: number; name: string },
): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.dataConfidence !== a.dataConfidence) return b.dataConfidence - a.dataConfidence;
  return a.name.localeCompare(b.name, "pt-BR");
}
