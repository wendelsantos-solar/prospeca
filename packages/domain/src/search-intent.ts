// SearchIntent — the structured interpretation of a natural-language "mission".
//
// Both paths produce this SAME shape:
//   - the deterministic parser below (fallback / offline);
//   - an LLM path whose output is validated against a schema (contracts) before
//     any search runs — the LLM never executes queries directly (spec #8).
//
// The deterministic parser is deliberately conservative: it only claims what it
// can match with simple rules; complex phrasing is left to the LLM path.

export interface DigitalPresenceIntent {
  /** true = must have a site · false = must NOT have a site · null = any. */
  website: boolean | null;
  /** ≤ this follower count counts as "weak instagram" (optional). */
  instagramMaxFollowers?: number | null;
}

export interface SearchIntent {
  /** Resolved niche/category term (e.g. "barbearias"). */
  businessIntent: string;
  /** Free-text location label ("campo grande, rio de janeiro"). */
  location: string;
  /** Rolled-up presence filter, compatible with the existing `searches.presence_filter`. */
  presence: "all" | "no-website" | "with-website";
  digitalPresence: DigitalPresenceIntent;
  ratingMin: number | null;
  radiusKm: number | null;
  /** The original sentence (never mutated) — kept for audit/display. */
  raw: string;
}

/** 1:1 accent map (each accented char → one ASCII char, so string lengths align). */
const ACCENTS: Record<string, string> = {
  á: "a",
  à: "a",
  â: "a",
  ã: "a",
  ä: "a",
  é: "e",
  è: "e",
  ê: "e",
  ë: "e",
  í: "i",
  ì: "i",
  î: "i",
  ï: "i",
  ó: "o",
  ò: "o",
  ô: "o",
  õ: "o",
  ö: "o",
  ú: "u",
  ù: "u",
  û: "u",
  ü: "u",
  ç: "c",
};

function ascii(s: string): string {
  return s.replace(/[áàâãäéèêëíìîïóòôõöúùûüç]/g, (c) => ACCENTS[c] ?? c);
}

/** Trailing connector words left over after extraction (e.g. "... em Niterói e com"). */
const TRAILING_CONNECTORS =
  /(?:\s+(?:e|com|sem|que|de|da|do|das|dos|para|pra|por|num|numa|na|no|nas|nos))+\s*$/i;

export function parseSearchIntent(text: string): SearchIntent {
  const raw = text.trim();
  const padded = ` ${raw.toLowerCase().replace(/\s+/g, " ").trim()} `;

  // Two aligned surfaces: `tt` (ASCII, for matching) and `oo` (accented, for
  // output). Blanks are applied to BOTH in sync so indices never drift.
  let tt = ascii(padded);
  let oo = padded;

  const blank = (re: RegExp): RegExpMatchArray | null => {
    const m = tt.match(re);
    if (m && m.index !== undefined) {
      const spaces = " ".repeat(m[0].length);
      tt = tt.slice(0, m.index) + spaces + tt.slice(m.index + m[0].length);
      oo = oo.slice(0, m.index) + spaces + oo.slice(m.index + m[0].length);
    }
    return m;
  };

  // 1) radius — "raio de 10 km" / "num raio de 5,5 km"
  let radiusKm: number | null = null;
  const radius = blank(/(?:num\s+)?raio\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s*km/i);
  if (radius) radiusKm = parseFloat(radius[1].replace(",", "."));

  // 2) rating — "bem avaliadas" / "com boas avaliações" / "nota 4"
  let ratingMin: number | null = null;
  if (blank(/\b(?:bem|boa|boas|otima|otimas|excelente|excelentes)\s+avali\w*/i)) {
    ratingMin = 4;
  } else {
    const nota = blank(/nota\s*(?:maior|acima|>=|≥|>\s*=?)?\s*(\d)/i);
    if (nota) ratingMin = parseInt(nota[1], 10);
  }

  // 3) presence — "sem site" / "baixa presença digital" / "com site"
  let presence: SearchIntent["presence"] = "all";
  let website: boolean | null = null;
  if (
    blank(
      /(?:com\s+)?(?:sem\s+site|baixa\s+presenca\s+digital|pouca\s+presenca\s+digital|sem\s+presenca\s+digital)/i,
    )
  ) {
    presence = "no-website";
    website = false;
  } else if (blank(/com\s+site|com\s+presenca\s+digital/i)) {
    presence = "with-website";
    website = true;
  }

  // 4) location — everything after a standalone " em ", minus trailing connectors
  let location = "";
  const emIdx = tt.search(/\bem\s+/i);
  if (emIdx >= 0) {
    location = oo
      .slice(emIdx)
      .replace(/^\s*em\s+/i, "")
      .trim();
    oo = oo.slice(0, emIdx);
  }
  location = location.replace(TRAILING_CONNECTORS, "").trim();

  // 5) business intent — remaining words (accents preserved), no connector stripping
  //    (categories like "salão de beleza" must survive intact).
  const businessIntent = oo
    .replace(/[^a-z0-9áàâãéêíóôõúüç\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    businessIntent,
    location,
    presence,
    digitalPresence: { website },
    ratingMin,
    radiusKm,
    raw,
  };
}
