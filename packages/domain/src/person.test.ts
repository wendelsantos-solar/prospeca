import { expect, test } from "bun:test";
import {
  NAME_ONLY_IDENTITY_CONFIDENCE,
  QSA_RELATION_CONFIDENCE,
  normalizePersonName,
  resolvePeopleFromQsa,
} from "./person.ts";
import type { QsaMember } from "./business-registry.ts";

const member = (o: Partial<QsaMember>): QsaMember => ({
  name: "MARIA SOUZA",
  qualification: "49-Sócio-Administrador",
  qualificationCode: "49",
  since: "2015-03-10",
  memberType: "person",
  legalRepresentativeName: null,
  legalRepresentativeQualification: null,
  ...o,
});

test("normalizePersonName remove acento, caixa e pontuação", () => {
  expect(normalizePersonName("José da Silva Júnior")).toBe("jose da silva junior");
  expect(normalizePersonName("  ANA   PAULA  ")).toBe("ana paula");
  expect(normalizePersonName("O'BRIEN, JOHN")).toBe("o brien john");
});

test("normalizePersonName NÃO remove sufixos societários (≠ normalizeCompanyName)", () => {
  // 'me' e 'sa' são pedaços legítimos de nome de pessoa; o normalizador de
  // empresa os apagaria.
  expect(normalizePersonName("ME SA")).toBe("me sa");
});

test("nome que normaliza para vazio é descartado", () => {
  expect(normalizePersonName("!!!")).toBe("");
  expect(resolvePeopleFromQsa([member({ name: "!!!" })])).toEqual([]);
});

test("QSA ausente/vazio resolve para lista vazia", () => {
  expect(resolvePeopleFromQsa(null)).toEqual([]);
  expect(resolvePeopleFromQsa([])).toEqual([]);
});

test("sócio pessoa física vira Person + relação com confiança separada", () => {
  const [person] = resolvePeopleFromQsa([member({})]);
  expect(person.fullName).toBe("MARIA SOUZA");
  expect(person.normalizedName).toBe("maria souza");
  // Identidade (nome só) é FRACA; relação (QSA oficial) é forte. Dimensões
  // diferentes, valores diferentes — o brief §28 exige a separação.
  expect(person.identityConfidence).toBe(NAME_ONLY_IDENTITY_CONFIDENCE);
  expect(person.identityConfidence).toBeLessThan(1);
  expect(person.relation.confidence).toBe(QSA_RELATION_CONFIDENCE);
  expect(person.relation.roleCode).toBe("49");
  expect(person.relation.startedAt).toBe("2015-03-10");
  expect(person.relation.isCurrent).toBe(true);
  expect(person.relation.endedAt).toBeNull();
});

test("sócio PJ é mantido e preserva o representante legal", () => {
  const [person] = resolvePeopleFromQsa([
    member({
      name: "HOLDING XYZ LTDA",
      memberType: "company",
      legalRepresentativeName: "CARLOS LIMA",
      legalRepresentativeQualification: "Administrador",
    }),
  ]);
  expect(person.relation.memberType).toBe("company");
  expect(person.relation.legalRepresentativeName).toBe("CARLOS LIMA");
  expect(person.relation.legalRepresentativeRole).toBe("Administrador");
});

test("homônimos dentro do mesmo QSA colapsam numa pessoa só", () => {
  const resolved = resolvePeopleFromQsa([
    member({ name: "João Silva", qualificationCode: "49" }),
    member({ name: "JOAO  SILVA", qualificationCode: "22" }),
  ]);
  expect(resolved.length).toBe(1);
  // Fica a primeira relação — a fonte não distingue os dois.
  expect(resolved[0].relation.roleCode).toBe("49");
});

test("QSA com vários sócios preserva todos", () => {
  const resolved = resolvePeopleFromQsa([
    member({ name: "MARIA SOUZA" }),
    member({ name: "PEDRO ALVES", qualificationCode: "22" }),
  ]);
  expect(resolved.map((r) => r.normalizedName)).toEqual(["maria souza", "pedro alves"]);
});
