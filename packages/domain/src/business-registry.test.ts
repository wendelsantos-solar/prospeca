import { describe, expect, it, test } from "bun:test";
import {
  normalizeCnpj,
  isValidCnpj,
  registrationStatusFromSituacao,
  companyStatusFromRegistration,
  yearsInBusiness,
  isEstablishedByAge,
  ESTABLISHED_YEARS_MIN,
  type BusinessRegistryProvider,
} from "./business-registry.ts";

describe("normalizeCnpj", () => {
  it("strips formatting", () => {
    expect(normalizeCnpj("12.345.678/0001-95")).toBe("12345678000195");
    expect(normalizeCnpj("  12345678000195 ")).toBe("12345678000195");
  });
  it("returns empty for empty input", () => {
    expect(normalizeCnpj("")).toBe("");
    expect(normalizeCnpj("abc")).toBe("");
  });
});

describe("isValidCnpj", () => {
  it("accepts a valid CNPJ", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
  });
  it("rejects wrong length", () => {
    expect(isValidCnpj("12345")).toBe(false);
    expect(isValidCnpj("")).toBe(false);
  });
  it("rejects all-same digits", () => {
    expect(isValidCnpj("00.000.000/0000-00")).toBe(false);
  });
  it("rejects a corrupted check digit", () => {
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
  });
});

describe("registrationStatusFromSituacao", () => {
  it("maps known situações case-insensitively", () => {
    expect(registrationStatusFromSituacao("ATIVA")).toBe("active");
    expect(registrationStatusFromSituacao("ativa")).toBe("active");
    expect(registrationStatusFromSituacao("SUSPENSA")).toBe("suspended");
    expect(registrationStatusFromSituacao("BAIXADA")).toBe("inactive");
    expect(registrationStatusFromSituacao("INAPTA")).toBe("inactive");
    expect(registrationStatusFromSituacao("NULA")).toBe("inactive");
  });
  it("maps NUMERIC RFB codes (BrasilAPI sends numbers — smoke V3 fix)", () => {
    expect(registrationStatusFromSituacao(2)).toBe("active");
    expect(registrationStatusFromSituacao(3)).toBe("suspended");
    expect(registrationStatusFromSituacao(1)).toBe("inactive");
    expect(registrationStatusFromSituacao(4)).toBe("inactive");
    expect(registrationStatusFromSituacao(8)).toBe("inactive");
    expect(registrationStatusFromSituacao(99)).toBe("unknown");
  });
  it("maps unknown to unknown", () => {
    expect(registrationStatusFromSituacao("X")).toBe("unknown");
    expect(registrationStatusFromSituacao(null)).toBe("unknown");
  });
});

describe("companyStatusFromRegistration", () => {
  it("maps active/suspended to operational, inactive to closed", () => {
    expect(companyStatusFromRegistration("active")).toBe("operational");
    expect(companyStatusFromRegistration("suspended")).toBe("operational");
    expect(companyStatusFromRegistration("inactive")).toBe("closed");
    expect(companyStatusFromRegistration("unknown")).toBe("unknown");
  });
});

describe("BusinessRegistryProvider contract — resiliência (Fase 5)", () => {
  const CNPJ = "11.222.333/0001-81";

  it("null = registry has NO record — a normal answer, never an error/cascade", async () => {
    // lookup-cnpj answers {found:false} for this and stamps the source
    // 'enriched' with the 90d TTL — absence of CNPJ ≠ company failure.
    const provider: BusinessRegistryProvider = {
      lookupByCnpj: async () => null,
    };
    const result = await provider.lookupByCnpj(CNPJ);
    expect(result).toBeNull();
  });

  it("throw = source DOWN — caller marks the source failed, company stays usable", async () => {
    // lookup-cnpj catches this, stamps business_registry 'failed' (re-checkable,
    // no TTL lock) and answers 200 {found:false, reason:'provider_unavailable'} —
    // the company profile/score are untouched.
    const provider: BusinessRegistryProvider = {
      lookupByCnpj: async () => {
        throw new Error("ETIMEDOUT: registry timeout");
      },
    };
    let caught: unknown = null;
    try {
      await provider.lookupByCnpj(CNPJ);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("ETIMEDOUT");
  });

  it("invalid CNPJ is rejected BEFORE any provider call", () => {
    expect(isValidCnpj(normalizeCnpj("00.000.000/0000-00"))).toBe(false);
    expect(isValidCnpj(normalizeCnpj("12345"))).toBe(false);
  });
});

describe("company age (V3-D)", () => {
  test("yearsInBusiness from a real founded date", () => {
    const now = new Date("2026-08-15T00:00:00Z");
    expect(yearsInBusiness("2016-01-01", now)).toBe(10);
    expect(yearsInBusiness("2024-01-01", now)).toBe(2);
  });

  test("absent/invalid date → null (never fabricate an age)", () => {
    expect(yearsInBusiness(null)).toBeNull();
    expect(yearsInBusiness(undefined)).toBeNull();
    expect(yearsInBusiness("not-a-date")).toBeNull();
  });

  test("future date → null (not negative years)", () => {
    expect(yearsInBusiness("2030-01-01", new Date("2026-08-15T00:00:00Z"))).toBeNull();
  });

  test("isEstablishedByAge threshold (≥ ESTABLISHED_YEARS_MIN)", () => {
    const now = new Date("2026-08-15T00:00:00Z");
    expect(ESTABLISHED_YEARS_MIN).toBe(5);
    expect(isEstablishedByAge("2010-01-01", now)).toBe(true);
    expect(isEstablishedByAge("2024-01-01", now)).toBe(false);
    expect(isEstablishedByAge(null, now)).toBe(false);
  });
});

// ── Mapeamento BrasilAPI (Fase 3) ───────────────────────────────────────────
//
// Regressão do P0: o adapter lia `nome`/`qual`, chaves que a BrasilAPI NÃO
// devolve. Consequência em produção: todo sócio virava name:"" e era filtrado,
// `places.qsa` gravava sempre [] e a seção "Decisores" da UI mostrava
// "Não informado" para toda empresa. Estes testes travam o contrato real,
// verificado contra a API em 2026-08-18.

import {
  composeStreetAddress,
  establishmentTypeFromIdentifier,
  mapBrasilApiCnpj,
  mapBrasilApiQsaMember,
  qsaMemberTypeFromIdentifier,
  type BrasilApiCnpjPayload,
} from "./business-registry.ts";

const FETCHED_AT = "2026-08-18T12:00:00.000Z";

/** Shape REAL da BrasilAPI (chaves conferidas contra a resposta HTTP 200). */
const realPayload = (): BrasilApiCnpjPayload => ({
  razao_social: "PADARIA CENTRAL LTDA",
  nome_fantasia: "Padaria Central",
  cnae_fiscal: 4721102,
  cnae_fiscal_descricao: "Padaria e confeitaria com predominância de revenda",
  cnaes_secundarios: [{ codigo: 5611203, descricao: "Lanchonetes" }],
  situacao_cadastral: 2,
  descricao_situacao_cadastral: "ATIVA",
  municipio: "FLORIANOPOLIS",
  uf: "SC",
  cep: "88010000",
  logradouro: "RUA FELIPE SCHMIDT",
  numero: "100",
  complemento: "SALA 4",
  bairro: "CENTRO",
  identificador_matriz_filial: 1,
  data_inicio_atividade: "2015-03-10",
  porte: "DEMAIS",
  natureza_juridica: "206-2 - Sociedade Empresária Limitada",
  capital_social: 50000,
  opcao_pelo_simples: true,
  data_opcao_pelo_simples: "2015-04-01",
  opcao_pelo_mei: false,
  qsa: [
    {
      nome_socio: "MARIA SOUZA",
      qualificacao_socio: "49-Sócio-Administrador",
      codigo_qualificacao_socio: 49,
      data_entrada_sociedade: "2015-03-10",
      identificador_de_socio: 2,
      nome_representante_legal: "",
      qualificacao_representante_legal: "Não informada",
      // PII presente na resposta real — não pode atravessar o mapper.
      cnpj_cpf_do_socio: "***123456**",
      cpf_representante_legal: "***000000**",
      faixa_etaria: "Entre 41 a 50 anos",
      codigo_faixa_etaria: 4,
    },
  ],
});

test("QSA: mapeia nome_socio/qualificacao_socio (regressão do P0)", () => {
  const reg = mapBrasilApiCnpj("66777395000141", realPayload(), FETCHED_AT);
  expect(reg.qsa).not.toBeNull();
  expect(reg.qsa!.length).toBe(1);
  expect(reg.qsa![0].name).toBe("MARIA SOUZA");
  expect(reg.qsa![0].qualification).toBe("49-Sócio-Administrador");
  expect(reg.qsa![0].qualificationCode).toBe("49");
  expect(reg.qsa![0].since).toBe("2015-03-10");
  expect(reg.qsa![0].memberType).toBe("person");
});

test("QSA: as chaves antigas nome/qual NÃO produzem sócio", () => {
  // Prova que o bug era real: com o shape que o código antigo esperava, a
  // fonte não entrega nome nenhum.
  const wrongShape = {
    qsa: [{ nome: "JOAO", qual: "Administrador" }],
  } as unknown as BrasilApiCnpjPayload;
  const reg = mapBrasilApiCnpj("66777395000141", wrongShape, FETCHED_AT);
  expect(reg.qsa).toEqual([]);
});

test("QSA: PII (CPF, faixa etária) nunca atravessa o mapper", () => {
  const reg = mapBrasilApiCnpj("66777395000141", realPayload(), FETCHED_AT);
  const serialized = JSON.stringify(reg);
  expect(serialized).not.toContain("123456");
  expect(serialized).not.toContain("faixa");
  expect(serialized).not.toContain("41 a 50");
  expect(Object.keys(reg.qsa![0]).sort()).toEqual([
    "legalRepresentativeName",
    "legalRepresentativeQualification",
    "memberType",
    "name",
    "qualification",
    "qualificationCode",
    "since",
  ]);
});

test("QSA: ausente = null (não sei) e vazio = [] (fonte diz que não há)", () => {
  expect(mapBrasilApiCnpj("1", {}, FETCHED_AT).qsa).toBeNull();
  expect(mapBrasilApiCnpj("1", { qsa: [] }, FETCHED_AT).qsa).toEqual([]);
});

test("QSA: linha sem nome é descartada", () => {
  expect(mapBrasilApiQsaMember({ qualificacao_socio: "Administrador" })).toBeNull();
  expect(mapBrasilApiQsaMember({ nome_socio: "   " })).toBeNull();
});

test("identificador_de_socio → memberType", () => {
  expect(qsaMemberTypeFromIdentifier(1)).toBe("company");
  expect(qsaMemberTypeFromIdentifier("2")).toBe("person");
  expect(qsaMemberTypeFromIdentifier(3)).toBe("foreign");
  expect(qsaMemberTypeFromIdentifier(null)).toBe("unknown");
});

test("identificador_matriz_filial → establishmentType", () => {
  expect(establishmentTypeFromIdentifier(1)).toBe("headquarters");
  expect(establishmentTypeFromIdentifier("2")).toBe("branch");
  expect(establishmentTypeFromIdentifier(undefined)).toBe("unknown");
});

test("endereço oficial compõe só o que a fonte respondeu", () => {
  expect(composeStreetAddress("RUA A", "100", "SALA 4")).toBe("RUA A, 100 - SALA 4");
  expect(composeStreetAddress("RUA A", "100", null)).toBe("RUA A, 100");
  expect(composeStreetAddress("RUA A", null, null)).toBe("RUA A");
  expect(composeStreetAddress(null, null, null)).toBeNull();
});

test("payload real → DTO canônico completo", () => {
  const reg = mapBrasilApiCnpj("66777395000141", realPayload(), FETCHED_AT);
  expect(reg.taxId).toBe("66777395000141");
  expect(reg.legalName).toBe("PADARIA CENTRAL LTDA");
  expect(reg.tradeName).toBe("Padaria Central");
  expect(reg.primaryCnae).toBe("4721102");
  expect(reg.secondaryCnaes).toEqual(["5611203"]);
  expect(reg.status).toBe("active");
  expect(reg.streetAddress).toBe("RUA FELIPE SCHMIDT, 100 - SALA 4");
  expect(reg.district).toBe("CENTRO");
  expect(reg.establishmentType).toBe("headquarters");
  expect(reg.capitalSocial).toBe(50000);
  expect(reg.simplesNacional).toBe(true);
  expect(reg.fetchedAt).toBe(FETCHED_AT);
});

// ── Descoberta de CNPJ no site (Fase 10) ────────────────────────────────────

import { extractCnpjCandidates, websiteCnpjConfidence } from "./business-registry.ts";

// CNPJs com checksum VÁLIDO, usados só como fixture.
const VALID_A = "66777395000141";
const VALID_B = "11222333000181";

test("acha CNPJ formatado no rodapé", () => {
  const html = `<footer>CNPJ: 66.777.395/0001-41 — Todos os direitos reservados</footer>`;
  expect(extractCnpjCandidates(html)).toEqual([VALID_A]);
});

test("acha CNPJ sem formatação", () => {
  expect(extractCnpjCandidates(`<p>CNPJ ${VALID_A}</p>`)).toEqual([VALID_A]);
});

test("aceita formatação mista", () => {
  expect(extractCnpjCandidates("66.777.395/000141")).toEqual([VALID_A]);
});

test("rejeita 14 dígitos com checksum inválido", () => {
  // Um telefone concatenado, um id de produto — nada disso é CNPJ.
  expect(extractCnpjCandidates("<p>12345678901234</p>")).toEqual([]);
  expect(extractCnpjCandidates("<p>00.000.000/0000-00</p>")).toEqual([]);
});

test("não casa pedaço de número maior", () => {
  expect(extractCnpjCandidates(`<p>9${VALID_A}9</p>`)).toEqual([]);
});

test("descarta CNPJ da AGÊNCIA que fez o site", () => {
  // Armadilha real de rodapé brasileiro: gravar isso mostraria a empresa errada.
  const html = `<footer>Desenvolvido por Agência Foo — CNPJ 66.777.395/0001-41</footer>`;
  expect(extractCnpjCandidates(html)).toEqual([]);
});

test("mantém o CNPJ da empresa e descarta o da agência no mesmo rodapé", () => {
  const html = `
    <footer>
      Padaria Central — CNPJ ${VALID_A}
      <span>Site desenvolvido por Bar Agência - CNPJ ${VALID_B}</span>
    </footer>`;
  expect(extractCnpjCandidates(html)).toEqual([VALID_A]);
});

test("marcador de autoria casa com e sem acento", () => {
  expect(extractCnpjCandidates(`agência responsável, CNPJ ${VALID_A}`)).toEqual([]);
  expect(extractCnpjCandidates(`agencia responsavel, CNPJ ${VALID_A}`)).toEqual([]);
});

test("preserva ordem de aparição e não repete", () => {
  const html = `${VALID_B} ... ${VALID_A} ... ${VALID_B}`;
  expect(extractCnpjCandidates(html)).toEqual([VALID_B, VALID_A]);
});

test("HTML vazio ou sem CNPJ devolve lista vazia", () => {
  expect(extractCnpjCandidates("")).toEqual([]);
  expect(extractCnpjCandidates("<p>sem numero aqui</p>")).toEqual([]);
});

test("confiança cai quando o site lista mais de um CNPJ", () => {
  expect(websiteCnpjConfidence(1)).toBeGreaterThan(websiteCnpjConfidence(2));
  expect(websiteCnpjConfidence(1)).toBeLessThan(1); // nunca é fato, é candidato
});
