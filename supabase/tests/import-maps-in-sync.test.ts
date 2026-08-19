// Os TRÊS import maps do monorepo têm que concordar.
//
// ESCOPO: só a sincronia dos maps. Foi tentado também exigir `import_map` por
// função no config.toml e a regra NÃO se sustenta — três funções que alcançam
// @leads/* não têm a chave e bootam normalmente, porque o
// `[edge_runtime].import_map_path` global resolve. Assertar invariante falsa
// gera trabalho inútil e falsa confiança.
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
