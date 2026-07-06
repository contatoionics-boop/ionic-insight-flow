## Objetivo

Corrigir a tela **Agenda** para mostrar somente agendamentos **aceitos pelo agente** e melhorar o modal de detalhes, e adicionar o indicador **"iniciado / não iniciado"** na tela **Mapeamentos**.

---

## 1) Agenda (`/app/agenda`)

**Problema atual:** o calendário mostra todos os casos com `agendado_em`, independente de o agente ter aceitado ou recusado. Isso diverge da tela de Mapeamentos e não deixa claro o status real.

**Mudanças:**

- Em `listarAgendaAdmin` (`src/lib/casos.functions.ts`):
  - Incluir no `select` o join com `agendamentos!agendamento_id(aceite_status, data_aceite, motivo_recusa)`.
  - Filtrar somente casos com `aceite_status = 'confirmado'` (agendamentos efetivamente aceitos pelo agente). Casos aguardando aceite ou recusados deixam de aparecer no calendário.
  - Excluir também casos com `status = 'cancelado'`.

- Em `src/routes/app.agenda.tsx`:
  - Adicionar no tipo `Evento` os campos `aceite_status`, `data_aceite` e a data de início da vistoria (`data_execucao`) e entrega (`data_entrega_agente`).
  - No modal de detalhes do agendamento (`sel`), exibir:
    - Badge "✓ Aceito em {data}" (sempre presente, já que só listamos aceitos).
    - Badge de execução: "Não iniciado" (cinza) quando `data_execucao` é nulo; "Em campo desde {data}" (âmbar) quando iniciado mas sem entrega; "Entregue em {data}" (verde) quando `data_entrega_agente` presente.
  - Nas células do calendário, adicionar um pequeno dot/ícone colorido antes do horário indicando o mesmo status de execução (cinza = não iniciado, âmbar = em campo, verde = entregue), para leitura rápida.

## 2) Mapeamentos (`/app/cases`)

**Problema atual:** a tabela mostra aceite (Aceito / Aguardando / Recusado) mas não mostra se o mapeamento foi **iniciado** em campo.

**Mudanças em `src/routes/app.cases.tsx`:**

- Abaixo do badge de aceite (na coluna "Agente"), adicionar um segundo badge de execução usando os campos já disponíveis em `MapeamentoComProgresso` (`data_execucao`, `data_entrega_agente`, `data_aprovacao_pablo`):
  - `data_aprovacao_pablo` presente → "✓ Aprovado" (verde).
  - `data_entrega_agente` presente → "📤 Entregue {data}" (azul).
  - `data_execucao` presente → "▶ Em campo desde {data}" (âmbar).
  - Nenhum dos três → "○ Não iniciado" (cinza).
- Nada muda no filtro/carregamento — os dados já vêm de `listarMapeamentosComProgresso`.

---

## Detalhes técnicos

- Arquivos a alterar:
  - `src/lib/casos.functions.ts` — ajustar `listarAgendaAdmin` (select + filtro `aceite_status='confirmado'` + exclusão de cancelados + retornar `data_execucao`/`data_entrega_agente`).
  - `src/routes/app.agenda.tsx` — tipo `Evento` estendido, badges no modal, dot de execução na célula.
  - `src/routes/app.cases.tsx` — badge extra de execução na coluna Agente.
- Não há mudança de schema, migração, RLS ou server-only import — apenas leitura já autorizada.
- Sem impacto em `/app/minhas-vistorias` (agente técnico) — só admin/pablo vêm a Agenda.
