import { describe, it, expect } from "bun:test";
import { fillTemplate, buildContactMessage } from "./message-fill";

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
    expect(buildContactMessage("Oi", CONTACT, { signature: "Radar Local" })).toBe(
      "Oi\n\nRadar Local",
    );
  });

  it("leaves missing contact fields empty instead of printing undefined", () => {
    expect(buildContactMessage("[{{bairro}}][{{telefone}}]", { companyName: "X" })).toBe("[][]");
  });
});
