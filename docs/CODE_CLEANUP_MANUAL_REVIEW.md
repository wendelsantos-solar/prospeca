# Revisão Manual — Itens de Confiança Média/Baixa

Itens que **parecem** removíveis mas foram **preservados** por dúvida razoável, dado que o repositório está no meio de um refactor para monorepo. Cada um precisa de decisão humana.

---

## 1. Bug pré-existente (não é limpeza, mas precisa correção)

**Caminho:** `apps/web/src/components/app/SearchForm.tsx:157`
**Suspeita:** `Cannot find name 'setRadius'` — referência a símbolo inexistente.
**Risco de remoção:** N/A — é um bug, não código morto. Não mexer sem entender a intenção.
**Como validar:** abrir o arquivo, ver o contexto da linha 157; provavelmente faltou um `const [radius, setRadius] = useState(...)` ou a chamada deveria ser removida.
**Recomendação:** corrigir em PR separado (é mudança funcional, fora do escopo de limpeza).

---

## 2. `apps/web/public/favicon-512.png`

**Suspeita:** asset órfão — 0 referências (`rg favicon-512|manifest` → nada).
**Risco de remoção:** baixo, mas favicons costumam ser referenciados por convenção/PWA manifest que pode ser adicionado depois.
**Como validar:** confirmar que não há (nem haverá) `manifest.webmanifest`/PWA usando o ícone 512. Se não, pode remover.
**Recomendação:** remover se não houver plano de PWA; caso contrário, referenciar num manifest.

---

## 3. `docs/DEPLOYMENT.md` vs `docs/deployment.md`

**Suspeita:** o `DEPLOYMENT.md` (maiúsculo, PT, "Deploy — Radar Local") parece **superado** pelo `deployment.md` (minúsculo, EN, era monorepo, referencia ADR-001).
**Risco de remoção:** médio — o autor do refactor pode estar consolidando docs; apagar pode perder conteúdo (ex.: comandos específicos de Edge Functions no arquivo antigo).
**Como validar:** comparar os dois; migrar qualquer conteúdo único do antigo para o novo + ADRs, então remover o antigo.
**Recomendação:** consolidar (novo absorve o antigo), depois remover `DEPLOYMENT.md`. Não apagar sem consolidar.

---

## 4. Docs de planejamento do refactor (possível sobreposição)

**Caminhos:** `docs/current-architecture.md`, `docs/target-architecture.md`, `docs/migration-plan.md`, `docs/ARCHITECTURE.md`, `docs/adr/*`
**Suspeita:** vários docs de arquitetura podem se sobrepor.
**Risco de remoção:** **alto** — são docs **ativos** do refactor em andamento. Provavelmente todos intencionais.
**Como validar:** confirmar com o autor quando o refactor terminar quais viram histórico.
**Recomendação:** **manter todos** até o refactor concluir.

---

## 5. `docs/MOCK_MIGRATION_REPORT.md`

**Suspeita:** relatório da migração mock→real; pode ser histórico já cumprido.
**Risco de remoção:** baixo/médio — é registro histórico.
**Como validar:** confirmar que a migração foi concluída e o relatório não é referenciado.
**Recomendação:** manter como histórico ou mover para `docs/archive/`. Não apagar sem registro.

---

## 6. `docs/superpowers/{specs,plans}/2026-07-20-geolocation-onboarding*`

**Suspeita:** spec + plano da feature de geolocalização, escritos para a estrutura **antiga** (flat `src/`), hoje obsoletos no monorepo.
**Risco de remoção:** baixo (não referenciados por código), mas são artefatos de processo úteis se a feature for portada.
**Como validar:** decidir se a feature de geolocalização será portada para o monorepo (a implementação está na branch `feat/geolocation-onboarding`).
**Recomendação:** manter até decidir sobre o port; depois arquivar ou remover.

---

## 7. Dependência de workspace `@leads/geo` em `packages/providers`

**Caminho:** `packages/providers/package.json` → `"@leads/geo"`
**Suspeita:** knip aponta como não usada; `rg @leads/geo packages/providers/src` → 0 usos.
**Risco de remoção:** médio — em monorepo mid-refactor, a dep pode estar declarada para fiação futura entre `providers` e `geo`.
**Como validar:** confirmar com o autor se `providers` vai consumir `geo`. Se não, remover a linha do package.json.
**Recomendação:** manter até confirmar a intenção do refactor.

---

## 8. Baseline — RESOLVIDO ✅

Estava vermelho; agora está **verde**:

- Bug `setRadius` **corrigido** (converte km → índice do slider, padrão existente). `typecheck` passa (5/5).
- `bun run format` aplicado → **0 erros** de prettier (restam 9 warnings `react-refresh/only-export-components`, benignos).
- `build` passa.

---

## 9. Unused exports (2ª passada, baseline verde) — 43 itens, NÃO removidos

Após o baseline ficar verde, o knip apontou 43 exports sem consumidores. Removi só os **re-exports mortos comprovados** (CITY_SUGGESTIONS no SearchForm, applyPresenceFilter no AppSidebar). O resto foi **preservado**, em dois grupos:

### 9a. Sub-exports de componentes shadcn/ui (manter por convenção)

`buttonVariants`, `badgeVariants`, `CardFooter`, `CommandDialog`, `CommandShortcut`, `CommandSeparator`, `DialogPortal`, `DialogOverlay`, `DropdownMenu{CheckboxItem,RadioItem,Shortcut,Group,Portal,Sub,SubContent,SubTrigger,RadioGroup}`, `PopoverAnchor`, `Select{Group,Label,Separator,ScrollUpButton,ScrollDownButton}`, `Sheet{Portal,Overlay,Close}`, `Table{Footer,Caption}`.

**Risco:** baixo tecnicamente, mas são a **API pública** dos componentes shadcn (copiados por convenção com o conjunto completo). Remover parcialmente quebra o padrão e o valor é mínimo.
**Recomendação:** manter. Se quiser enxugar, faça por componente, deliberadamente.

### 9b. App-level — provavelmente features planejadas (mid-refactor)

| Símbolo | Arquivo | Suspeita |
|---|---|---|
| `signOut`, `getSessionOrNull` | `hooks/useAuth.ts` | 0 usos — mas `signOut` = **logout ainda não conectado** (provável feature faltando, não código morto) |
| `useUpdateLeadMutation` | `hooks/useLeadsQuery.ts` | 0 usos — provável edição de lead planejada |
| `LeadCardSkeleton`, `MetricCardSkeleton`, `DashboardSkeleton`, `DetailsSkeleton` | `components/shared/Skeletons.tsx` | 0 usos — loading states planejados |
| `featureFlags` | `lib/env.ts` | 0 usos — infra de flags (scaffolding) |
| `MESSAGE_CHAR_LIMIT` | `components/app/message-template/constants.tsx` | exportado, usado só internamente |
| `applyPresenceFilter` (função em `stores/index.ts`) | `stores/index.ts:457` | 0 callers após remover o re-export; pode ser util planejada |

**Risco de remoção:** médio — em mid-refactor, "export sem consumidor" costuma ser **integração ainda não fiada**, não lixo. Apagar `signOut` removeria a capacidade de logout que deveria existir.
**Como validar:** confirmar com o autor do refactor quais features serão conectadas.
**Recomendação:** **manter todos**; reavaliar quando o refactor concluir. Se confirmado que não serão usados, remoção é trivial e segura (baseline verde agora serve de rede).

---

## Categorias explicitamente NÃO tocadas (por segurança)

- **`supabase/functions/**`** — todas as Edge Functions (invocadas por string em runtime). Knip as marca como "unused files" — **falso-positivo perigoso\*\*; deletar destruiria o backend.
- **`supabase/migrations/**`, `supabase/seed/**`** — nunca remover migrations/seeds por análise estática.
- **Arquivos de convenção/config** — `routeTree.gen.ts` (gerado), `vite.config.ts`, `eslint.config.js`, `tsconfig*`, `supabase/config.toml`, `server.ts`, `start.ts`.
- **`packages/*`** — código dos pacotes de domínio; parte pode não estar conectada ainda (mid-refactor), então "sem consumidor" ≠ morto.
