## Objetivo

Registrar de forma estruturada **toda ação** executada sobre um mapeamento (quem, o quê, quando, e detalhes) e exibir esse histórico de forma clara para IAM e Especialista.

Hoje o sistema já grava alguns marcos soltos em colunas do próprio caso (`data_execucao`, `data_entrega_agente`, `data_aprovacao_pablo`, `data_aceite`, `motivo_recusa`), mas:
- Não há registro de reagendamento, cancelamento, reabertura, reprovação, criação, alteração de agente, etc.
- Não guarda **quem** executou a ação nem **quando** de fato ocorreu (a coluna é sobrescrita a cada mudança).
- Não é possível reconstruir a linha do tempo completa.

A solução é criar uma **tabela de auditoria única** (`mapeamento_eventos`) que grava cada ação como um registro imutável, alimentada por gatilhos automáticos nas ações do backend.

---

## 1. Nova tabela `mapeamento_eventos`

Colunas:
- `caso_id` (FK obrigatória)
- `agendamento_id` (FK opcional — quando o evento é do agendamento vinculado)
- `tipo` (enum, ver abaixo)
- `ocorrido_em` (timestamp)
- `ator_id` (uuid do usuário) + `ator_nome` (snapshot, para não sumir se o usuário for removido)
- `ator_papel` (super_admin / admin / especialista / agente_tecnico / sistema)
- `metadata` (jsonb — dados extras específicos de cada tipo, ex.: motivo, agente antigo/novo, data antiga/nova, duração)

Enum `evento_tipo`:
- `mapeamento_criado`
- `agendamento_criado`
- `agendamento_agente_atribuido`
- `aceite_confirmado`
- `aceite_recusado`
- `reagendado`
- `agendamento_cancelado`
- `vistoria_iniciada`
- `vistoria_finalizada` (entrega para revisão)
- `revisao_aprovada`
- `revisao_reprovada` / `reenvio_solicitado`
- `mapeamento_concluido`
- `observacao_adicionada`

RLS: IAM (admin), especialista e super_admin leem todos os eventos dos casos que já enxergam; agente técnico lê só eventos dos casos onde é o agente atribuído. Inserção só via server functions (service role).

---

## 2. Instrumentação nas server functions

Cada função existente passa a inserir um evento na mesma transação:

| Função existente | Evento a gravar |
|---|---|
| `criarCaso` / criação de agendamento | `mapeamento_criado`, `agendamento_criado` |
| `aceitarAgendamentoAgente` | `aceite_confirmado` |
| `recusarAgendamentoAgente` | `aceite_recusado` (metadata: motivo) |
| `reagendarAposRecusa` / `reagendarVistoria` | `reagendado` (metadata: agente antigo/novo, data antiga/nova) |
| `cancelarVistoria` | `agendamento_cancelado` |
| `iniciarVistoria` | `vistoria_iniciada` |
| `finalizarVistoria` | `vistoria_finalizada` |
| `aprovarMapeamento` (mapeamento.functions) | `revisao_aprovada` |
| `solicitarReenvio` / reprovar | `revisao_reprovada` (metadata: motivo) |
| Inserção em `mapeamento_observacoes` | `observacao_adicionada` |

Helper único `registrarEvento(context, { casoId, agendamentoId?, tipo, metadata? })` para padronizar.

As colunas atuais (`data_aceite`, `data_execucao`, etc.) permanecem — servem como cache para queries rápidas de "atraso". A verdade histórica passa a viver na tabela de eventos.

---

## 3. UI — Timeline unificada

Substituir o `TimelineMapeamento` atual (que hoje mostra 3 marcos fixos: execução / entrega / aprovação) por uma **timeline dirigida a dados**, alimentada por `listarEventosDoMapeamento(casoId)`.

Cada item mostra:
- ícone e cor por tipo de evento (aceite=verde, recusa=vermelho, reagendado=âmbar, iniciada=azul, finalizada=roxo, aprovada=verde, etc.)
- rótulo em português ("Aceite confirmado pelo agente")
- ator ("por Cledir — Agente Técnico")
- data/hora completa ("26/06/2026 14:32")
- detalhes do metadata quando houver (motivo da recusa, "de 26/06 10:00 → 28/06 14:00", agente antigo/novo)

Onde exibir:
- **Detalhe do mapeamento** (`/app/vistorias/$id`) — timeline completa em card dedicado, visível para IAM, especialista e super_admin.
- **Fila de revisão** (`/app/review-queue` → detalhe) — mesmo componente.
- **Dashboard e lista de mapeamentos** — coluna extra "Última ação" com o evento mais recente (tipo + tempo relativo, ex.: "Recusado · há 2h").

---

## 4. Backfill do histórico existente

Migração de dados que percorre `casos` e `agendamentos` já cadastrados e cria eventos sintéticos para os marcos conhecidos (`criado_em`, `data_aceite`, `data_execucao`, `data_entrega_agente`, `data_aprovacao_pablo`, `motivo_recusa`) com `ator_papel = 'sistema'` e o ator identificado quando dá pra inferir (ex.: `criado_por`, `agente_id`).

---

## 5. Exportação (opcional, se quiser desde já)

Botão "Exportar histórico (CSV)" na tela de detalhe do mapeamento para IAM/especialista — útil para auditoria externa. Posso incluir nesta entrega ou deixar para uma segunda etapa.

---

## Detalhes técnicos

- Nova migração cria enum `evento_tipo`, tabela `mapeamento_eventos`, índices (`caso_id`, `ocorrido_em desc`), GRANTs (`SELECT` para authenticated; sem INSERT via RLS — só via server functions com service role) e políticas RLS de leitura por papel.
- Helper `registrarEvento` em `src/lib/eventos.functions.ts` (server-side, usa `supabaseAdmin`).
- Novo server fn `listarEventosDoMapeamento` com `requireSupabaseAuth` + verificação de papel.
- Novo componente `src/components/mapeamento/HistoricoEventos.tsx` (substitui/complementa `TimelineMapeamento`).
- Atualização da coluna "Progresso" em `app.cases.tsx` e do dashboard para mostrar "última ação".

## Perguntas antes de eu implementar

1. Você quer a exportação CSV do histórico já nesta entrega, ou fica para depois?
2. O agente técnico deve ver o histórico completo do próprio mapeamento (incluindo notas internas da revisão) ou só até o ponto em que entregou?
