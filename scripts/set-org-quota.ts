// Update monthly search/place quota for the organization a user belongs to.
//
// Usage:
//   bun run org:set-quota -- --email user@example.com --search-limit 100000
//   bun run org:set-quota -- -e user@example.com -s 100000 -p 1000000
//
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local automatically
// (via `deno run --env-file=.env.local`, wired in the "org:set-quota" package.json script).

import { createClient } from "npm:@supabase/supabase-js@2";
import { parseArgs } from "jsr:@std/cli/parse-args";

const args = parseArgs(Deno.args, {
  string: ["email", "search-limit", "place-limit"],
  alias: { e: "email", s: "search-limit", p: "place-limit" },
});

const email = args.email;
const searchLimit = args["search-limit"] ? Number(args["search-limit"]) : undefined;
const placeLimit = args["place-limit"] ? Number(args["place-limit"]) : searchLimit ? searchLimit * 10 : undefined;

if (!email || !searchLimit) {
  console.error("Usage: deno run -A scripts/set-org-quota.ts --email <email> --search-limit <n> [--place-limit <n>]");
  Deno.exit(1);
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  Deno.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey);

const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (usersError) {
  console.error("Failed to list users:", usersError.message);
  Deno.exit(1);
}
const user = usersPage.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No user found with email ${email}`);
  Deno.exit(1);
}

const { data: membership, error: membershipError } = await admin
  .from("organization_members")
  .select("organization_id")
  .eq("user_id", user.id)
  .limit(1)
  .maybeSingle();
if (membershipError || !membership) {
  console.error("Failed to find organization for user:", membershipError?.message ?? "no membership");
  Deno.exit(1);
}

const { data: org, error: updateError } = await admin
  .from("organizations")
  .update({ monthly_search_limit: searchLimit, monthly_place_limit: placeLimit })
  .eq("id", membership.organization_id)
  .select("id, plan, monthly_search_limit, monthly_place_limit")
  .single();
if (updateError) {
  console.error("Failed to update organization:", updateError.message);
  Deno.exit(1);
}

console.log(org);
