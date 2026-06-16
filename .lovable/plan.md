## Plano: 4 melhorias no módulo Mapeamentos

### 1. Banco de dados (1 migração)

**Alterar `casos`** — adicionar campos de timeline:
- `data_execucao timestamptz` — preenchido quando agente envia 1ª resposta
- `data_entrega_agente timestamptz` — preenchido quando agente finaliza (status `aguardando_revisao`)
- `data_aprovacao_pablo timestamptz` — preenchido na aprovação final
- `motivo_recusa text` — texto da recusa quando Pablo solicita correção

> `data_agendamento` já existe como `agendado_em`; será reutilizada.

**Nova tabela `mapeamento_observacoes`**:
- `id`, `caso_id` (FK→casos), `texto`, `usuario_id` (FK→profiles), `criado_em`
- RLS: leitura/escrita para usuários `authenticated` que enxergam o caso
- GRANT padrão para `authenticated` e `service_role`

**Nova tabela `notificacoes`**:
- `id`, `usuario_id`, `caso_id` (nullable), `tipo` (`agente_atrasado` | `correcao_solicitada` | `aprovado` | `recusado`), `titulo`, `mensagem`, `lido boolean default false`, `criado_em`
- RLS: usuário só vê/atualiza suas próprias
- GRANT padrão

**Trigger/função `casos_timeline_auto`** — atualiza `data_entrega_agente` ao mover para `aguardando_revisao` e `data_aprovacao_pablo` ao mover para `concluido`. `data_execucao` será setada via server function ao salvar 1ª resposta (mais confiável que trigger nos respostas).

### 2. Server functions (`src/lib/mapeamento.functions.ts` — novo)

- `listarMapeamentosComProgresso()` — retorna casos + `{respondidas, totalObrigatorias}` calculado via join `perguntas` (obrigatoria=true) × `respostas_agente`.
- `adicionarObservacao({casoId, texto})` — `requireSupabaseAuth`.
- `listarObservacoes({casoId})`.
- `recusarMapeamento({casoId, motivo})` — seta status `em_correcao`, grava `motivo_recusa`, cria notificações para Ian (criador) e agente.
- `aprovarMapeamento({casoId})` — seta `concluido` + `data_aprovacao_pablo`, notifica Ian.
- `listarNotificacoes()` / `marcarNotificacaoLida({id})` / `marcarTodasLidas()`.
- Hook em `vistoria-chat.ts` (ou onde se grava 1ª resposta): se `data_execucao` for null, setar `now()`.

### 3. Cron de alerta (48h)

Server route `src/routes/api/public/hooks/check-atrasos.ts` (sem auth header — usa `apikey` anon):
- SELECT casos onde `data_execucao IS NOT NULL AND data_entrega_agente IS NULL AND data_execucao < now() - interval '48 hours'` E não existe notificação `agente_atrasado` ainda.
- Cria notificações para o criador (Ian) e retorna count.

Cron pg_cron rodando de hora em hora (via `supabase--insert`).

### 4. UI

**`src/routes/app.cases.tsx`** — coluna **Progresso**:
- `5/7` + barra `<Progress>` colorida: vermelho ≤40, amarelo 41-79, verde ≥80. Usa cores semânticas `destructive`, `warning` (criar se não existir — usar `--warning` token; ou inline com `bg-yellow-500` evitado → usar `bg-destructive`, `bg-primary`, e tom amarelo via classes Tailwind padrão `bg-amber-500` aceitas pois não são CSS vars). Vou usar tons via classes utilitárias do Tailwind existentes (`bg-red-500`, `bg-amber-500`, `bg-emerald-500`) sem alterar CSS vars.

**`src/routes/app.vistorias.$id.tsx`** — adicionar 3 seções:
- **Linha do Tempo** (componente novo `TimelineMapeamento`): lista vertical com 4 etapas, ícones (CalendarDays, Play, Send, CheckCircle), data/hora formatada, cinza se pendente, vermelho se >48h sem próxima.
- **Observações e Intercorrências** (componente novo `ObservacoesPanel`): textarea + botão "Adicionar"; log abaixo (mais recente no topo) com nome do usuário e timestamp.
- **Ações de revisão** (apenas para Pablo / super_admin): botões "Aprovar" e "Solicitar correção" (modal com motivo).

**Sino de notificações** — novo componente `NotificacoesBell` no header (`AppLayout.tsx`): badge com contador não lidos, dropdown listando últimas 10, click marca lida e navega.

**Toasts** — disparar via `sonner` quando lista de notificações ganhar novas (poll a cada 30s simples).

### 5. Arquivos a criar/editar

Novos:
- `supabase/migrations/<ts>_mapeamento_melhorias.sql`
- `src/lib/mapeamento.functions.ts`
- `src/lib/notificacoes.functions.ts`
- `src/components/mapeamento/TimelineMapeamento.tsx`
- `src/components/mapeamento/ObservacoesPanel.tsx`
- `src/components/mapeamento/AcoesRevisao.tsx`
- `src/components/NotificacoesBell.tsx`
- `src/routes/api/public/hooks/check-atrasos.ts`

Editar:
- `src/routes/app.cases.tsx` — coluna progresso
- `src/routes/app.vistorias.$id.tsx` — montar 3 seções novas
- `src/components/AppLayout.tsx` — incluir sino
- `src/routes/api/vistoria-chat.ts` — setar `data_execucao` na 1ª resposta

### Observações

- "Pablo" e "Ian" não são usuários nomeados — vou tratar como **papéis**: Pablo = `super_admin` (revisor), Ian = `criado_por` do caso (gestor). Confirme se prefere mapear de outra forma.
- O cron de atraso precisa ser agendado via `supabase--insert` após a aprovação da migração.
- Mantém paleta atual; não toca em `src/styles.css`.