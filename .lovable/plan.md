# Plano: Renomeação global + Dashboard novo

## 1. Renomeação global de terminologia

Varredura em todo `src/` (componentes, rotas, libs, PDFs, mensagens) substituindo nos textos visíveis ao usuário:

- "caso" / "casos" → "mapeamento" / "mapeamentos"
- "vistoria" / "vistorias" → "mapeamento" / "mapeamentos"
- "vistoriador(es)" → "agente(s) técnico(s)"

Regras:
- Trocar apenas **strings de UI** (JSX, labels, placeholders, toasts, títulos `<title>`/`head()`, textos de PDF, mensagens de erro do usuário, tooltips, breadcrumbs, cabeçalhos de tabela, estados vazios, notificações).
- **NÃO renomear**: nomes de tabelas do banco (`casos`, `respostas_agente`, etc.), colunas, tipos TypeScript (`CaseStatus`, `Caso`), nomes de arquivos de rota (`app.cases.tsx`, `app.vistorias.$id.tsx`, `app.minhas-vistorias.tsx`), nomes de funções, chaves de objetos, IDs HTML, query keys. Renomear esses itens quebraria rotas, RLS, tipos gerados do Supabase e o build.
- Sidebar (`AppLayout.tsx`): atualizar labels mantendo as rotas existentes (ex.: rota `/app/cases` com label "Mapeamentos").
- PDFs: ajustar textos em `pdf-mapeamento.server.ts` e `casos-pdf.functions.ts`.

Arquivos com varredura garantida (lista não exaustiva — será feito grep por ocorrência):
`src/components/AppLayout.tsx`, `src/components/ConfiguracoesNav.tsx`, `src/lib/casos.ts` (somente labels), `src/routes/app.cases.tsx`, `app.dashboard.tsx`, `app.review-queue.tsx`, `app.tracking.tsx`, `app.history.tsx`, `app.minhas-vistorias.tsx`, `app.vistorias.$id.tsx`, `app.vistoria.$casoId.tsx`, `app.new-case.tsx`, `app.review.$id.tsx`, `app.agenda.tsx`, `app.agendamento.$id.tsx`, componentes em `src/components/mapeamento/`, `src/components/agent/`, `NotificacoesBell.tsx`, `notificacoes.functions.ts` (templates de notificação), arquivos `*-pdf*`.

## 2. Dashboard — 6 cards de métricas

Substituir o grid atual (4 cards) em `src/routes/app.dashboard.tsx` por grid responsivo `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6`:

| Card | Métrica (fonte) | Subtítulo |
|---|---|---|
| Mapeamentos em aberto | `status in ('em_andamento','agendado')` | Em andamento |
| Aguardando revisão | `status = 'aguardando_revisao'` | Fila do especialista |
| Aceitos | `aceite_status = 'confirmado'` (campo já existe em `casos`) | Confirmados pelo agente |
| Em atraso | `atrasado = true` via `listarMapeamentosComProgresso` (mesma lógica da timeline / `app.cases.tsx`) — destaque vermelho quando > 0 | Prazo excedido |
| Mapeamentos hoje | `agendado_em` entre 00:00 e 23:59 de hoje | Agendados para hoje |
| Aprovados | `status = 'aprovado'` | Total no sistema |

Fonte única de dados: chamar `listarMapeamentosComProgresso` (server fn já existente, usada em `app.cases.tsx`) — evita múltiplas queries e reaproveita a lógica de `atrasado`. Remover a query atual direta ao Supabase no Dashboard.

Para o card "Em atraso", estender `StatCard` (em `src/components/ui-bits.tsx`) com prop opcional `tone?: 'default' | 'danger'` que aplica classes `text-destructive`/`border-destructive/40` quando ativo e valor > 0. Mudança aditiva, sem alterar CSS variables.

## 3. Seção "Agentes técnicos"

Nova seção entre os cards e a lista de recentes:

- Carregar agentes via `listTechnicalAgents` (já usado em `app.cases.tsx`).
- Cruzar com os mapeamentos já carregados (em memória) para calcular por agente:
  - total atribuído (`agente_id === a.id`)
  - em aberto (status `em_andamento` ou `agendado`)
  - em atraso (`atrasado === true`)
- Render: tabela compacta usando `Table/Th/Td` de `ui-bits` com colunas: Agente · Total · Em aberto · Em atraso (badge vermelho se > 0).
- Status online/offline: **não há dado disponível** no schema atual (`profiles` não tem `last_seen`). Vou omitir a coluna e deixar comentário no código. Se quiser, posso adicionar em uma próxima iteração com migration adicionando `profiles.last_seen_at` atualizado no login.

## 4. Lista "Mapeamentos recentes"

- Trocar título "Casos recentes" → "Mapeamentos recentes".
- Continuar usando os 6 mais recentes da mesma lista já carregada (ordenada por `criado_em desc`).
- Badges já vêm de `statusTones` (sem alteração) — apenas confirmar consistência.

## Notas técnicas

- Nenhuma migração de banco. Nenhuma alteração de RLS, tipos do Supabase, rotas, ou tokens de design.
- `routeForRole('super_admin')` continua apontando para `/app/dashboard`.
- Tipos `CaseStatus`/`statusLabels` permanecem; apenas os **valores** dos labels mudam ("Caso" não aparece, então nada a alterar lá — verificar).
- Build risk: renomes só em strings, sem mexer em imports/identificadores → build seguro.

## Fora de escopo

- Renomear arquivos de rota e tabelas do banco (quebraria URLs salvas, RLS e tipos).
- Adicionar telemetria de presença (online/offline) — requer nova coluna + heartbeat.
