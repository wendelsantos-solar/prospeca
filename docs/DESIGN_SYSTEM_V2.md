# Design System V2 — Radar Local

Estado atual, não um plano — ver `docs/DESIGN_SYSTEM_V2_AUDIT.md` pro
que já existe vs. o que falta. Este doc documenta os tokens e convenções
como estão hoje.

## Onde vive

Tudo em `apps/web/src/styles.css` — Tailwind v4, sem `tailwind.config.*`
separado (v4 usa `@theme inline` na própria folha CSS). Valores em
OKLCH. Duas seções: `:root` (claro) e `.dark` (escuro), espelhadas.

## Princípio

Token semântico, nunca cor direta no componente. Se um componente
precisa de uma cor nova de verdade (não uma reutilização), o token entra
em `styles.css` primeiro, com nome pelo papel (`stage-won`), não pela
aparência (`green-500`).

## Cores — papéis já existentes

| Papel               | Tokens                                                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fundo/superfície    | `--background`, `--surface`, `--surface-2`, `--surface-hover`, `--card`, `--popover`                                                                                                                   |
| Ação primária       | `--primary(+foreground/hover/soft/subtle)`                                                                                                                                                             |
| Texto               | `--foreground`, `--muted-foreground`, `--subtle-foreground`                                                                                                                                            |
| Borda               | `--border`, `--border-strong`, `--input`, `--ring`                                                                                                                                                     |
| Status              | `--destructive`, `--warning`, `--info`, `--success` (todos com `-foreground`/`-soft`)                                                                                                                  |
| Temperatura do lead | `--hot`, `--warm`, `--cold` (com `-foreground`/`-soft`)                                                                                                                                                |
| Seleção             | `--sel` (+`-foreground`/`-soft`) — **azul, de propósito**, distinto do primário verde, pra não confundir "isso é ação" com "isso tá selecionado". Decisão mantida mesmo com o novo spec pedindo verde. |
| Estágio do Pipeline | `--stage-new/qualified/contacted/won/discarded` (+`-foreground`/`-soft`) — **novo nesta rodada**, antes eram emprestados de outros papéis                                                              |

Uso: `bg-{token}`, `text-{token}`, `border-t-{token}` — o `@theme
inline` já expõe cada `--X` como utilitário Tailwind (`--color-X`), não
precisa de config extra pra usar um token novo além de declará-lo nas
duas seções (`:root`/`.dark`) e mapeá-lo em `@theme inline`.

## Tipografia — escala nomeada (nova nesta rodada)

| Classe               | Tamanho | Line-height | Uso sugerido          |
| -------------------- | ------- | ----------- | --------------------- |
| `text-display`       | 30px    | 38px        | Números grandes, hero |
| `text-page-title`    | 24px    | 32px        | Título de página      |
| `text-section-title` | 18px    | 26px        | Título de seção       |
| `text-card-title`    | 14px    | 20px        | Título de card        |
| `text-body`          | 14px    | 21px        | Texto padrão          |
| `text-body-sm`       | 13px    | 19px        | Texto secundário      |
| `text-caption`       | 12px    | 17px        | Metadado              |
| `text-micro`         | 11px    | 16px        | Rótulo minúsculo      |

Peso não vem embutido — combine com `font-semibold`/`font-medium`
conforme a hierarquia. **Ainda não aplicada retroativamente** no app —
o código existente usa `text-sm`/`text-lg` etc ad-hoc; a escala nova é
pra uso em código novo/tocado a partir de agora, migração completa é
tarefa separada (dezenas de arquivos).

## Radius

Base `--radius: 0.75rem` (12px) gera `rounded-sm/md/lg/xl/2xl/3xl` via
`calc()`. Modal usa `rounded-[18px]` explícito (`components/ui/dialog.tsx`)
— maior que card de propósito, pra se diferenciar visualmente. Resto do
app usa a escala padrão sem mapeamento rígido por componente ainda (gap
conhecido, não resolvido nesta rodada).

## Sombra

`--shadow-card`, `--shadow-elegant`, `--shadow-elevated`,
`--shadow-popover` — sem uma escala `none/sm/md/lg/overlay` nomeada
ainda. Uso atual: cards sem sombra por padrão, `shadow-card` em hover,
`shadow-elevated` em elementos flutuantes/arrastados, `shadow-popover`
em dropdown/popover.

## Densidade

`useUIStore().density` (`"compact" | "comfortable"`, persistida,
zustand). Configurável em Configurações → Prospecção. Consumida hoje
por:

- `KanbanBoard.tsx` (padding, tamanho de fonte, campos opcionais no
  card comfortable)
- `DiscoveryCard.tsx` (novo nesta rodada — padding, score-ring, fonte)

Ainda não conectada em: tabelas (`ResultsList.tsx`, Dashboard/Admin),
`Filters.tsx`. Pra adicionar num componente novo: leia
`useUIStore((s) => s.density)` no componente pai que already renderiza a
lista, passe como prop — não leia a store dentro de cada item da lista
(evita re-render desnecessário por item).

## Ícones

Só `lucide-react`. Tamanho padrão 16px (`h-4 w-4`), sem stroke
customizado fixo no momento (spec sugere 1.75, não aplicado
globalmente). Nunca emoji como ícone de interface — exceção conhecida e
não corrigida: `map-popup.ts:9-10,47` (popup do mapa é uma string HTML,
não JSX — precisa de refactor pra usar SVG inline em vez de emoji).

## Como adicionar um token novo

1. Decida o papel (não a cor) — `stage-X`, não `yellow-X`.
2. Declare em `:root` e `.dark` em `styles.css`, valores OKLCH.
3. Mapeie em `@theme inline` (`--color-{nome}: var(--{nome})`).
4. Use via classe Tailwind normal (`bg-{nome}`, `text-{nome}`).
5. Se for uma variação de família existente (destructive/warning/info/
   success), copie os mesmos valores de lightness/chroma/hue — só muda
   o nome. Mantém contraste já validado, evita paleta nova sem
   necessidade.
