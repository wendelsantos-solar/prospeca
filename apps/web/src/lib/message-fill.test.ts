import { describe, it, expect } from "bun:test";
import { fillTemplate, buildContactMessage, contactReason } from "./message-fill";
import { DEFAULT_MESSAGE_TEMPLATE } from "./constants";

const CONTACT = {
  companyName: "Empório Real Barbearia",
  category: "barber_shop",
  city: "São Paulo",
  neighborhood: "Vila Madalena",
};

describe("fillTemplate", () => {
  it("replaces known vars and empties unknown ones", () => {
    expect(
      fillTemplate("Olá {{empresa}} de {{cidade}}{{inexistente}}", {
        empresa: "Acme",
        cidade: "Porto Alegre",
      }),
    ).toBe("Olá Acme de Porto Alegre");
  });
});

describe("buildContactMessage", () => {
  it("resolves the lead vars, lowercasing the category label", () => {
    const msg = buildContactMessage(
      "Vi a {{empresa}}, {{categoria}} em {{bairro}}/{{cidade}}. — {{meu_nome}}",
      CONTACT,
      { senderName: "Wendel" },
    );
    expect(msg).toBe("Vi a Empório Real Barbearia, barbearia em Vila Madalena/São Paulo. — Wendel");
  });

  it("falls back to the account name when no sender name is set", () => {
    expect(buildContactMessage("{{meu_nome}}", CONTACT, { userName: "Ana" })).toBe("Ana");
  });

  it("appends the signature after a blank line", () => {
    expect(buildContactMessage("Oi", CONTACT, { signature: "Prospeca" })).toBe("Oi\n\nProspeca");
  });

  it("leaves missing contact fields empty instead of printing undefined", () => {
    expect(buildContactMessage("[{{bairro}}][{{telefone}}]", { companyName: "X" })).toBe("[][]");
  });

  it("prepends a cadence opener before the templated body when given", () => {
    expect(buildContactMessage("Oi", CONTACT, {}, "Passando para retomar o contato.")).toBe(
      "Passando para retomar o contato.\n\nOi",
    );
  });

  it("puts the opener before the body but the signature stays last", () => {
    expect(
      buildContactMessage("Oi", CONTACT, { signature: "Prospeca" }, "Retomando o contato."),
    ).toBe("Retomando o contato.\n\nOi\n\nProspeca");
  });
});

describe("contactReason", () => {
  it("grounds the reason in the no-website signal", () => {
    expect(contactReason({ companyName: "X", hasWebsite: false })).toBe("não tem site próprio");
  });

  it("grounds the reason in a low rating", () => {
    expect(contactReason({ companyName: "X", hasWebsite: true, rating: 3.2 })).toBe(
      "tem avaliações abaixo da média (nota 3.2)",
    );
  });

  it("grounds the reason in zero reviews", () => {
    expect(contactReason({ companyName: "X", hasWebsite: true, reviewCount: 0 })).toBe(
      "não tem avaliações online",
    );
  });

  it("falls back to a soft digital-presence reason when there is no strong signal", () => {
    expect(
      contactReason({ companyName: "X", hasWebsite: true, rating: 4.5, reviewCount: 10 }),
    ).toBe("ainda dá para melhorar a presença digital");
  });
});

describe("default template", () => {
  it("renders a grounded opener, not a generic pitch", () => {
    const msg = buildContactMessage(DEFAULT_MESSAGE_TEMPLATE, {
      companyName: "Barbearia do Beto",
      hasWebsite: false,
    });
    expect(msg).toContain("não tem site próprio");
    expect(msg).not.toContain("uma oportunidade");
  });
});
