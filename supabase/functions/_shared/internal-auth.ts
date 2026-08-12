// Recognises service-role calls between edge functions (execute-search fired by
// create-search, the cron hitting recover-stuck-searches, and so on).
//
// Single home for what used to be four inline copies — three with a constant-time
// compare, one with a plain `===` that leaked the key prefix through timing
// (CWE-208). Fails closed when the service-role key is absent, so a missing env
// var can never turn `Bearer undefined` into a valid internal credential.
//
// `expectedKey` is injectable so the module is testable under Bun without Deno.

export async function isInternalCall(
  req: Request,
  expectedKey: string | undefined = serviceRoleKey(),
): Promise<boolean> {
  if (!expectedKey) return false;
  const header = req.headers.get("Authorization") ?? "";
  return await timingSafeEqual(header, `Bearer ${expectedKey}`);
}

/** Constant-time compare over fixed-length SHA-256 digests — hides length and prefix. */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

/** Deno-guarded so importing this module under Bun (tests) does not throw. */
function serviceRoleKey(): string | undefined {
  return typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") : undefined;
}
