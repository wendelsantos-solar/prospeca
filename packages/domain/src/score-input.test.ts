import { expect, test } from "bun:test";
import { scoreInputFromPlace } from "./score-input";

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
