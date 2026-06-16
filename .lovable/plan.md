Vou implementar as 4 melhorias em fases, com migrações Supabase + frontend.

## 1. Código IONICS (Clientes + Unidades)

**Banco** (migração):
- `CREATE SEQUENCE empresas_ionics_seq START 1;`
- Adicionar `codigo_ionics TEXT UNIQUE` em `empresas`, com default `'ION-' || lpad(nextval(...)::text, 5, '0')`.
- Adicionar `codigo_ionics TEXT` em `unidades`, preenchido por trigger no INSERT como `<codigo_empresa>-<NN>` (NN = sequencial por empresa, baseado em `count(*) + 1` da empresa).
- Backfill nos registros existentes (empresas e unidades, por ordem de `criado_em`).

**Frontend**:
- `app.clients.index.tsx`: coluna + filtro de busca já existente passa a casar também por `codigo_ionics`.
- `app.clients.$empresaId.tsx`: exibir código em destaque no header da empresa e ao lado de cada unidade.
- `app.agendamento.$id.tsx`: ao selecionar cliente/unidade, mostrar código IONICS.
- PDF de mapeamentos: incluir no bloco de identificação do cliente (route que gera PDF — adicionar campo).

## 2. Filtros + Exportação em /app/cases

- Estender `listarMapeamentosComProgresso` para incluir `agendamento_data` (já no caso) e retornar dados que o filtro precisa.
- Adicionar barra de filtros (Agente select, Cliente texto, Data início/fim, Status select) — filtragem client-side em tempo real.
- Chips abaixo da barra com botão X individual.
- Botão "Exportar CSV" que serializa exatamente `rowsFiltradas` (cabeçalhos: ID, Cliente, Unidade, Código IONICS, Agente, Status, Progresso, Data agendamento, Data criação).

## 3. Conflito de agenda

**Banco**: novo server fn `verificarConflitoAgente({ agente_id, data, ignorar_id? })` que faz SELECT em `agendamentos` por agente_id + mesma data (truncada por dia).

**Frontend** (`app.agendamento.$id.tsx`):
- Antes de salvar, chamar verificação. Se houver conflito, abrir Dialog "Entendido" com mensagem detalhada e não permitir salvar.
- Inputs de data e agente recebem classe `border-destructive` enquanto conflito persistir.
- Em `app.agenda.tsx` (calendário visual): quando agente filtrado, server fn `listarDiasOcupadosPorAgente` retorna lista de datas — pintar células em vermelho.

## 4. Aceite de agendamento pelo agente

**Banco** (migração):
- Adicionar em `agendamentos`: `aceite_agente BOOLEAN DEFAULT false`, `data_aceite TIMESTAMPTZ`, `motivo_recusa TEXT`.
- Atualizar enum/coluna `status` para suportar `aguardando_aceite`, `confirmado`, `recusado_pelo_agente` (manter outros).
- Trigger: ao criar agendamento com agente, status default = `aguardando_aceite`.

**Frontend**:
- `app.agendamento.$id.tsx`: ao criar, status fica `aguardando_aceite`; bloquear edição de data/agente quando `status = 'confirmado'`.
- `app.minhas-vistorias.tsx` (visão do agente): card destacado para agendamentos `aguardando_aceite` com botões "Confirmar agendamento" e "Recusar / Solicitar reagendamento" (dialog com motivo).
- Server fns: `confirmarAgendamentoAgente(id)` e `recusarAgendamentoAgente(id, motivo)` — usam `requireSupabaseAuth` e validam que o `userId` é o `agente_id` do agendamento.
- Notificações (tabela `notificacoes` já existe): criar registros para Ian (criador) ao confirmar/recusar; criar para agente ao Ian agendar.

## Detalhes técnicos

- Todas as alterações de schema em migrações separadas por feature para facilitar review.
- Sem alterações em CSS variables — uso de tokens semânticos existentes (`bg-destructive/15`, `text-destructive`, `border-destructive`).
- Server fns ficam em `src/lib/*.functions.ts`; helpers privados em `*.server.ts` quando necessário.
- Export CSV: gerar Blob no client com `URL.createObjectURL`, sem dependência nova.
- PDF: identificar arquivo que gera o PDF dos mapeamentos antes de editar (provavelmente um server fn ou rota dedicada).

## Ordem de execução

1. Migração #1 — Código IONICS (sequence + colunas + trigger + backfill).
2. Migração #2 — Conflito + aceite (colunas em agendamentos + status novos).
3. Após aprovação das migrações, regenera types.
4. Implementar frontend + server fns das 4 features em paralelo onde possível.

Quer que eu prossiga nessa ordem?
