// Os TRÊS import maps do monorepo têm que concordar.
//
// O segundo teste cobre o `import_map` POR FUNÇÃO no config.toml. Ele foi
// escrito, descartado por engano e restaurado: localmente as funções bootavam
// sem a chave (o `[edge_runtime].import_map_path` global resolve), o que fez
// parecer invariante falsa. Mas `supabase functions deploy` NÃO usa a chave
// global — sem a entrada por função o bundle falha com "Module not found
// packages/domain/...". Três funções estavam nesse estado e o deploy quebrou
// no meio. Boot local não é prova de deployabilidade.
//
// Motivo (defeito real, 2026-08-18): um módulo novo em @leads/domain foi
// adicionado só ao `deno.json` da raiz. `deno check` passou — ele usa a raiz —
// e o typecheck do monorepo passou. Mas o edge runtime resolve por
// `supabase/import_map.json`, e a função morreu em BOOT_ERROR
// ("Relative import path ... not in import map"). Ou seja: TODOS os gates
// verdes e a função quebrada em produção.
//
// Nenhum gate existente pegava isso, porque nenhum deles boota uma função. Um
// teste de igualdade de chaves pega — e custa milissegundos.
import { expect, test } from "bun:test";

const ROOT = new URL("../../", import.meta.url).pathname;

/**
 * Aliases de pacote do monorepo. `zod` fica de fora de propósito: os maps do
 * edge apontam `zod` para `npm:zod@3` e o `deno.json` da raiz não declara o
 * alias — diferença pré-existente e intencional, sem relação com o grafo de
 * @leads/*.
 */
async function monorepoAliases(relativePath: string): Promise<string[]> {
  const text = await Bun.file(`${ROOT}${relativePath}`).text();
  return Object.keys(JSON.parse(text).imports ?? {})
    .filter((alias) => alias.startsWith("@leads/"))
    .sort();
}

const MAPS = {
  root: "deno.json",
  edgeRuntime: "supabase/import_map.json",
  functions: "supabase/functions/deno.json",
} as const;

test("os três import maps declaram os mesmos aliases @leads/*", async () => {
  const [root, edgeRuntime, functions] = await Promise.all([
    monorepoAliases(MAPS.root),
    monorepoAliases(MAPS.edgeRuntime),
    monorepoAliases(MAPS.functions),
  ]);
  // Comparação de conjunto: qualquer alias @leads/* presente num map e ausente
  // noutro falha aqui, e não em BOOT_ERROR na primeira invocação real.
  expect(edgeRuntime).toEqual(root);
  expect(functions).toEqual(root);
});

test("todo alias @leads/* aponta para um arquivo que existe", async () => {
  for (const [name, path] of Object.entries(MAPS)) {
    const text = await Bun.file(`${ROOT}${path}`).text();
    const imports = JSON.parse(text).imports as Record<string, string>;
    const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";
    for (const [alias, target] of Object.entries(imports)) {
      if (!alias.startsWith("@leads/")) continue;
      const resolved = new URL(target, `file://${ROOT}${dir}`).pathname;
      const exists = await Bun.file(resolved).exists();
      expect(exists, `${name}: ${alias} -> ${target}`).toBe(true);
    }
  }
});

/**
 * Funções cujo grafo de imports alcança @leads/* precisam de `import_map` no
 * config.toml — é o que `supabase functions deploy` usa para montar os pacotes
 * do monorepo no bundle. Sem a chave, o deploy falha ao empacotar.
 */
test("toda função que alcança @leads/* declara import_map no config.toml", async () => {
  const config = await Bun.file(`${ROOT}supabase/config.toml`).text();
  const withImportMap = new Set<string>();
  for (const block of config.split(/^\[/m)) {
    const match = block.match(/^functions\.([a-z0-9-]+)\]/);
    if (match && block.includes("import_map")) withImportMap.add(match[1]);
  }

  const readImports = async (path: string): Promise<string[]> => {
    const file = Bun.file(path);
    if (!(await file.exists())) return [];
    return [...(await file.text()).matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  };

  /** Fecho transitivo: a função pode alcançar @leads/* via _shared. */
  const reachesMonorepo = async (entry: string): Promise<boolean> => {
    const seen = new Set<string>();
    const stack = [entry];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      for (const spec of await readImports(current)) {
        if (spec.startsWith("@leads/")) return true;
        if (spec.startsWith(".")) {
          const dir = current.slice(0, current.lastIndexOf("/"));
          stack.push(new URL(spec, `file://${dir}/`).pathname);
        }
      }
    }
    return false;
  };

  const missing: string[] = [];
  for await (const file of new Bun.Glob("supabase/functions/*/index.ts").scan({ cwd: ROOT })) {
    const fn = file.split("/")[2];
    if (await reachesMonorepo(`${ROOT}${file}`)) {
      if (!withImportMap.has(fn)) missing.push(fn);
    }
  }
  expect(missing).toEqual([]);
});
