## Problema

Quando o agente técnico começa a responder a primeira pergunta do mapeamento (o "sim, quero iniciar"), o caso permanece com status `agendado`. Não é marcado como iniciado — em Mapeamentos aparece "Não iniciado", `data_execucao` fica nulo e o evento `vistoria_iniciada` nunca é registrado.

Motivo: existe a server fn `iniciarVistoria` (em `src/lib/casos.functions.ts`) que faria essa transição, mas ela **não é chamada em lugar nenhum**. O fluxo do agente vai direto do chat para `execSalvarResposta`, que só grava em `respostas_agente`, sem tocar em `casos.status`.

## Correção

Marcar o mapeamento como iniciado na **primeira resposta salva** pelo agente, dentro de `execSalvarResposta` (`src/lib/vistoria-agent.server.ts`).

Passos, após o `upsert` de sucesso em `respostas_agente`:

1. Ler `casos` (id = `casoId`) buscando `status`, `agente_id`, `agendamento_id`.
2. Se `status` estiver em `('agendado','rascunho')`:
   - `update casos set status='em_andamento' where id=casoId` (o trigger `casos_timeline_auto` já preenche `data_execucao = now()` automaticamente).
   - Chamar `registrarEvento({ casoId, agendamentoId, tipo: 'vistoria_iniciada', atorId: agente_id })` — mesmo evento que `iniciarVistoria` emite hoje.
3. Se já estiver `em_andamento` (ou finalizado), não faz nada — idempotente.

Efeitos automáticos após a mudança:
- **Mapeamentos** (`/app/cases`) passa a mostrar o badge "▶ Em campo desde {data}".
- **Agenda** (`/app/agenda`) passa a mostrar o dot âmbar / "Em campo desde {data}" no modal.
- **Timeline** do mapeamento ganha o evento `vistoria_iniciada` no momento certo.

Nenhum outro fluxo é alterado. `finalizarVistoria` continua responsável por `data_entrega_agente` / `aguardando_revisao`.

## Arquivos afetados

- `src/lib/vistoria-agent.server.ts` — acrescentar a lógica de "marcar iniciado" no fim de `execSalvarResposta` (usa `supabaseAdmin`, que já está importado, e `registrarEvento` de `@/lib/eventos.server`).

Sem migração, sem mudança de schema, sem mudança de UI.
