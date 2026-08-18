// People Intelligence — pessoas relacionadas a uma empresa e a proveniência
// dessa relação. Regras puras: sem HTTP, sem storage, sem Supabase.
//
// MODELO (D4, decidido 2026-08-18): HÍBRIDO.
//   - `places.qsa` continua sendo o SNAPSHOT BRUTO da fonte (verdade da
//     BrasilAPI, já coberto pelo expurgo LGPD de 90 dias);
//   - `people` + `company_people` materializam a RELAÇÃO NORMALIZADA derivada.
// Reprocessar a classificação não reconsulta a fonte, e a fonte bruta continua
// auditável. As duas representações têm o mesmo horizonte de retenção.
//
// PRIVACIDADE: uma Person aqui é só um NOME e o papel que ela exerce numa
// empresa. Nenhum identificador fiscal, nenhum dado etário, nenhum contato
// pessoal — ver a política de minimização em business-registry.ts (QsaMember).

import type { QsaMember } from "./business-registry.ts";

/**
 * Chave de identidade de uma pessoa. Sem CPF (descartado por política), o
 * nome normalizado é o único identificador disponível — e é um identificador
 * FRACO: homônimos existem. Por isso a identidade carrega método e confiança
 * próprios, separados da confiança da RELAÇÃO (que, vinda do QSA, é alta).
 *
 * Difere de `normalizeCompanyName` de propósito: aquele remove sufixos
 * societários (ltda/me/epp), o que destruiria sobrenomes.
 */
export function normalizePersonName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Como a identidade da pessoa foi resolvida. Hoje só há uma via. */
export const PERSON_IDENTITY_METHODS = ["name_exact"] as const;
export type PersonIdentityMethod = (typeof PERSON_IDENTITY_METHODS)[number];

/**
 * Confiança da IDENTIDADE quando ela vem só de nome normalizado. Deliberadamente
 * < 1: dentro de uma organização, dois "João Silva" viram a mesma Person. É uma
 * troca consciente (o brief §24 pede base para o PersonResolver, não matching
 * complexo agora) e a UI precisa poder dizer isso ao usuário.
 */
export const NAME_ONLY_IDENTITY_CONFIDENCE = 0.6;

export interface Person {
  id: string;
  organizationId: string;
  fullName: string;
  normalizedName: string;
  identityMethod: PersonIdentityMethod;
  identityConfidence: number;
}

/** Fonte de uma relação pessoa↔empresa. Hoje só o QSA do registro público. */
export const PERSON_RELATION_SOURCES = ["qsa"] as const;
export type PersonRelationSource = (typeof PERSON_RELATION_SOURCES)[number];

export interface CompanyPersonRelation {
  organizationId: string;
  placeId: string;
  personId: string;
  /** Qualificação textual da fonte (ex.: "49-Sócio-Administrador"). */
  role: string | null;
  /** Código RFB da qualificação — estável, base da classificação. */
  roleCode: string | null;
  memberType: QsaMember["memberType"];
  source: PersonRelationSource;
  sourceProvider: string;
  /** Confiança de que a RELAÇÃO existe (≠ confiança da identidade). */
  confidence: number;
  startedAt: string | null;
  endedAt: string | null;
  isCurrent: boolean;
  legalRepresentativeName: string | null;
  legalRepresentativeRole: string | null;
}

/**
 * Confiança da RELAÇÃO vinda do QSA. O quadro societário é registro público
 * oficial: se a fonte diz que a pessoa é sócia, ela é sócia. 1.0 é honesto.
 */
export const QSA_RELATION_CONFIDENCE = 1;

/** Uma pessoa + sua relação, prontas para persistência (ainda sem ids). */
export interface ResolvedPerson {
  fullName: string;
  normalizedName: string;
  identityMethod: PersonIdentityMethod;
  identityConfidence: number;
  relation: Omit<CompanyPersonRelation, "organizationId" | "placeId" | "personId">;
}

/**
 * QSA normalizado → pessoas + relações resolvidas.
 *
 * Regras:
 *   - integrante sem nome utilizável é descartado (não descreve ninguém);
 *   - integrante PJ (`memberType: 'company'`) É mantido: a relação societária
 *     é real e precisa aparecer. Quem decide, nesse caso, é o representante
 *     legal — preservado na relação, nunca inventado;
 *   - homônimos DENTRO do mesmo QSA colapsam na mesma pessoa, ficando a
 *     primeira relação (a fonte não distingue os dois);
 *   - `isCurrent` é true: o QSA da BrasilAPI descreve o quadro VIGENTE. Uma
 *     saída de sociedade some da lista, não vem marcada — por isso `endedAt`
 *     é sempre null aqui, e não zero-inventado.
 */
export function resolvePeopleFromQsa(qsa: QsaMember[] | null | undefined): ResolvedPerson[] {
  if (!qsa?.length) return [];
  const byKey = new Map<string, ResolvedPerson>();
  for (const member of qsa) {
    const normalizedName = normalizePersonName(member.name);
    if (!normalizedName) continue;
    if (byKey.has(normalizedName)) continue;
    byKey.set(normalizedName, {
      fullName: member.name.trim(),
      normalizedName,
      identityMethod: "name_exact",
      identityConfidence: NAME_ONLY_IDENTITY_CONFIDENCE,
      relation: {
        role: member.qualification,
        roleCode: member.qualificationCode,
        memberType: member.memberType,
        source: "qsa",
        sourceProvider: "business_registry",
        confidence: QSA_RELATION_CONFIDENCE,
        startedAt: member.since,
        endedAt: null,
        isCurrent: true,
        legalRepresentativeName: member.legalRepresentativeName,
        legalRepresentativeRole: member.legalRepresentativeQualification,
      },
    });
  }
  return [...byKey.values()];
}

/**
 * Contrato para futuras fontes de pessoas (site, redes profissionais, dados
 * comerciais). NÃO implementar scraping aqui — quando existir uma fonte legal
 * e tecnicamente adequada, ela implementa esta interface e alimenta a mesma
 * tabela `company_people`, com seu próprio `source` e sua própria confiança.
 */
export interface PersonResolver {
  readonly source: PersonRelationSource;
  resolve(input: { placeId: string; taxId?: string | null }): Promise<ResolvedPerson[]>;
}
