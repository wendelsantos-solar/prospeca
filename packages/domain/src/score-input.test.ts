import { expect, test } from "bun:test";
import { scoreInputFromPlace } from "./score-input";
import { calculateScore } from "./score";

test("sem site + telefone móvel → hasValidPhone e whatsapp possible", () => {
  const input = scoreInputFromPlace(
    {
      websiteUri: undefined,
      nationalPhoneNumber: "(21) 99999-8888",
      primaryType: "restaurant",
      rating: 4.5,
      userRatingCount: 120,
      businessStatus: "OPERATIONAL",
    },
    3000,
  );
  expect(input.hasWebsite).toBe(false);
  expect(input.hasValidPhone).toBe(true);
  expect(input.whatsappStatus).toBe("possible");
  expect(input.hasEmail).toBe(false);
  expect(input.hasInstagram).toBe(false);
  expect(input.hasCategory).toBe(true);
  expect(input.rating).toBe(4.5);
  expect(input.reviewCount).toBe(120);
  expect(input.distanceMeters).toBe(3000);
});

test("telefone fixo → whatsapp unknown", () => {
  const input = scoreInputFromPlace(
    { nationalPhoneNumber: "(21) 3333-4444", rating: null, userRatingCount: null },
    null,
  );
  expect(input.whatsappStatus).toBe("unknown");
  expect(input.hasCategory).toBe(false);
});

test("enriched place → hasEmail/hasInstagram true, whatsapp verified", () => {
  const input = scoreInputFromPlace(
    {
      websiteUri: "https://ex.com",
      nationalPhoneNumber: "(21) 3333-4444",
      email: "contato@ex.com",
      instagram: "@ex",
      whatsapp: "5521999998888",
    },
    null,
  );
  expect(input.hasEmail).toBe(true);
  expect(input.hasInstagram).toBe(true);
  // whatsapp present overrides the landline "unknown"
  expect(input.whatsappStatus).toBe("verified");
});

test("empty-string enrichment fields count as absent", () => {
  const input = scoreInputFromPlace({ email: "", instagram: "" }, null);
  expect(input.hasEmail).toBe(false);
  expect(input.hasInstagram).toBe(false);
});

test("re-score after enrichment adds exactly email(10)+instagram(5) = +15", () => {
  const bare = {
    websiteUri: "https://ex.com",
    nationalPhoneNumber: "(21) 99999-8888",
    primaryType: "restaurant",
  };
  const before = calculateScore(scoreInputFromPlace(bare, 2000));
  const after = calculateScore(
    scoreInputFromPlace({ ...bare, email: "c@ex.com", instagram: "@ex" }, 2000),
  );
  // with-site: valid_phone 20 + whatsapp 15 + nearby_5 10 + category 5 = 50
  expect(before.total).toBe(50);
  expect(after.total).toBe(65);
});
