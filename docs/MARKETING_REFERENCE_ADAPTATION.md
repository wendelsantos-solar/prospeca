# Marketing Reference Adaptation

Análise de como as referências premium (imagens anexadas) foram adaptadas ao Prospeca.

## Absorvido

| Elemento                    | Origem                                           | Aplicação                                                                  |
| --------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| **Tons neutros quentes**    | Referências premium com paleta bege/cinza-quente | Mantido via tokens OKLCH com hue ~160 (verde-acinzentado quente)           |
| **Bordas sutis**            | `border` com opacidade, bordas delicadas         | `border-border` em todos cards, `border-primary/20` em cards destacados    |
| **Ícones outline precisos** | Lucide icons com stroke consistente              | Tamanhos padronizados: `h-4 w-4` padrão, `h-5 w-5` em containers com borda |
| **Superfícies definidas**   | Cards brancos sobre fundo levemente colorido     | `bg-surface` (branco) sobre `bg-surface-2` (cinza-verde claro)             |
| **Tipografia refinada**     | Inter com tracking ajustado, poucos pesos        | `font-semibold` (600) como peso principal para títulos, `tracking-tight`   |
| **Radius consistente**      | `rounded-xl` padrão                              | Mantido em todos os cards e containers                                     |
| **Alinhamento rigoroso**    | Grids precisos, gutters consistentes             | Tokens de container e section spacing                                      |
| **Controles segmentados**   | Toggle de billing                                | Replicado no toggle mensal/anual da página de preços                       |

## Adaptado

| Elemento                  | Decisão                                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Maior densidade**       | Referências usam muito whitespace; Prospeca precisa demonstrar produto real → mais conteúdo visível                        |
| **Maior contraste**       | Tokens OKLCH com valores de lightness mais pronunciados para garantir legibilidade em dados (score, tabelas)                  |
| **Demonstrações de mapa** | Referências não têm mapas; criamos uma representação estilizada mas realista do Google Maps com grid, ruas, raio e marcadores |
| **Narrativa comercial**   | Adaptada ao público B2B brasileiro (freelancers e agências pequenas)                                                          |
| **CTAs**                  | Verde primário (não preto) como cor de ação principal, mantendo identidade Prospeca                                        |
| **Screenshots reais**     | Em vez de ilustrações, usamos composições codadas que espelham a UI real do produto                                           |

## Não copiado

| Elemento                                  | Motivo                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Layout do sistema de documentos**       | Referências mostram interfaces de documentação/kanban; adaptamos ao domínio de prospecção local |
| **Kanban como única linguagem**           | Pipeline é um componente, não a identidade central                                              |
| **Baixa densidade**                       | Landing de SaaS B2B precisa demonstrar produto, não apenas vender estética                      |
| **Grandes áreas vazias**                  | Cada whitespace tem função composicional: separar seções, destacar CTAs                         |
| **Botão preto como identidade principal** | Prospeca usa verde como cor primária de marca                                                |
| **Conteúdo da referência**                | Copiamos a linguagem visual, não o conteúdo ou estrutura de navegação                           |

## Nível de acabamento

O acabamento visual busca equivalência com as referências nos seguintes aspectos:

- Precisão no alinhamento de bordas e containers
- Consistência de radius entre componentes
- Relação figura-fundo clara (cards sobre superfícies)
- Tipografia com tracking ajustado e hierarquia de pesos
- Ícones como elementos de reforço visual, não decoração
- Estados de hover e transições sutis
- Uso de sombras apenas quando necessário para elevação
