# Company Data Ownership — dados globais × dados do tenant

> Spec #94. Documenta o que é canônico/global vs. o que é tenant-specific, e o
> licenciamento das fontes.

## Regra

`places` (a **Company**) é **tenant-scoped hoje** (`organization_id` +
`unique(organization_id, provider, provider_place_id)`). Esta é uma divergência
consciente do ideal "Company global" do spec — ver `DISCOVERY_INTELLIGENCE_V2_AUDIT.md`
§5. A separação conceitual, porém, **já está implementada no domínio**:

## Potencialmente GLOBAL (identidade + dados públicos)

- Identidade canônica: nome, endereço, coordenadas, categoria, `provider_place_id`.
- Dados públicos de negócio: site, telefone, rating, review count, CNAE (quando fonte existir).
- `Company` (domínio) → `places` (banco).

**Restrição de licenciamento**: dados do Google Places **não** podem ser
armazenados indefinidamente (migrations `discovery_google_retention` +
`pii_retention` já purgam). Por isso `places` NÃO deve virar uma tabela global
compartilhada sem antes resolver o licenciamento — a cópia por-org é, hoje, a
forma segura de respeitar os termos.

## TENANT-SPECIFIC (nunca na Company)

| Conceito                      | Onde fica                                     |
| ----------------------------- | --------------------------------------------- |
| Score de oportunidade por org | `company_opportunity_scores`                  |
| Lead / pipeline / stage       | `leads`                                       |
| Notas / atividades / timeline | `lead_notes`, `lead_activities`               |
| Next-best-action              | derivado (domínio), não persistido na Company |
| Sinais org-specific           | derivados do score                            |

## Caminho para "Company global" (futuro)

1. Confirmar licenciamento das fontes (Google Places, registry).
2. Introduzir `companies` global + `company_sources` (proveniência), migrar `places` → `companies`.
3. RLS de leitura global + tenant data em tabelas separadas.

**Não fazer**: compartilhar `places` entre orgs sem resolver (1) — quebraria o
licenciamento e o isolamento.
