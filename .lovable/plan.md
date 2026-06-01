
## Visão geral do fluxo

```text
Admin                                    Vistoriador (agente_tecnico)
─────                                    ─────────────────────────────
1. Cadastra cliente
2. Escolhe formulário
3. Agenda vistoria                ──►    4. Vê na lista/agenda
   (data, hora, endereço,                5. Login OU link único
    vistoriador, observações)            6. Abre formulário pré-vinculado
                                            ao cliente e segue o fluxo
                                         7. Conclui → status atualizado
8. Acompanha status / reagenda
```

Não muda o papel `agente_tecnico` — ele passa a se chamar "vistoriador" na UI, mas o enum continua igual. Não há configuração extra no cadastro do usuário; o que ele vê vem do que o admin agendar para ele.

---

## Mudanças no banco

Adicionar campos de agendamento na tabela `casos` (1 migration):

- `agendado_em` — timestamp da vistoria
- `duracao_min` — duração estimada (default 60)
- `endereco_vistoria` — texto livre (puxa do cliente, editável)
- `observacoes_agendamento` — instruções para o vistoriador
- `status` ganha novos valores: `agendado`, `em_andamento`, `concluido`, `cancelado` (mantém os atuais)

RLS: vistoriador (`agente_tecnico`) ganha policy de SELECT/UPDATE só nos `casos` onde `agente_id = auth.uid()`.

---

## Telas novas / alteradas

### 1. Admin — "Novo caso" vira "Agendar vistoria" (`app.new-case.tsx`)
Já existe o esqueleto. Adicionar:
- Campo data/hora (shadcn datepicker + horário)
- Campo duração
- Campo endereço (auto-preenche com endereço do cliente)
- Campo observações
- Mantém seleção de cliente, formulário, vistoriador
- Mantém geração de link único como opção (modo "Ambos" — login ou link)

### 2. Admin — Calendário de agendamentos (rota nova `/app/agenda`)
- Visão semanal/mensal de todas as vistorias agendadas
- Filtro por vistoriador
- Click no evento → detalhes + ações (reagendar, cancelar, ver caso)
- Detecção de conflito de horário ao agendar/reagendar

### 3. Vistoriador — Minhas vistorias (rota nova `/app/minhas-vistorias`)
Vira a home do vistoriador. Duas abas:
- **Lista**: pendentes (agendadas futuras), em andamento, concluídas (com filtro de período)
- **Agenda**: calendário só com as vistorias dele
- Cada item tem botão "Iniciar vistoria" → abre o formulário do caso (mesma tela do agente via link, mas autenticado)

### 4. Reaproveitar `FormRunner` para vistoriador logado
Hoje o formulário só abre via `/agent/$token`. Criar rota autenticada `/app/vistoria/$casoId` que renderiza o mesmo `FormRunner` mas usando a sessão do vistoriador (sem precisar de token). Reutiliza `FormChat`/`FormFields`/`use-gravacao-voz`.

### 5. Sidebar
- Para `agente_tecnico`: menu mostra só "Minhas vistorias" (lista+agenda)
- Para `admin`/`super_admin`: adicionar "Agenda" ao lado de "Casos"

### 6. Roteamento por papel (`routeForRole` em `src/lib/auth.ts`)
- `agente_tecnico` → `/app/minhas-vistorias` (hoje cai num lugar genérico)

---

## Detalhes técnicos

- **Calendário**: usar `react-day-picker` (já presente via shadcn) para mês + lista para a semana. Sem dependência nova.
- **Conflito de horário**: validação no server function `agendarVistoria` (createServerFn) — query nos casos do mesmo vistoriador no intervalo `[agendado_em, agendado_em + duracao_min]`.
- **Notificações**: só no app (sem e-mail/WhatsApp). Badge de "pendentes hoje" no menu do vistoriador.
- **Status transições**:
  - admin agenda → `agendado`
  - vistoriador clica "Iniciar" → `em_andamento`
  - vistoriador conclui formulário → `aguardando_revisao` (segue fluxo atual)
  - admin cancela → `cancelado`
- **Server functions novos** em `src/lib/casos.functions.ts` (criar):
  - `agendarVistoria` (admin)
  - `reagendarVistoria` (admin)
  - `cancelarVistoria` (admin)
  - `listarMinhasVistorias` (vistoriador, escopo `agente_id = auth.uid()`)
  - `listarAgendaAdmin` (admin, com filtro por vistoriador e intervalo)
  - `iniciarVistoria` (vistoriador → marca `em_andamento`)

---

## Ordem de implementação

1. Migration: campos de agendamento + novos status + RLS do vistoriador
2. Server functions de casos (agendar, listar, iniciar, etc.)
3. Atualizar tela "Novo caso" com campos de agendamento
4. Criar `/app/vistoria/$casoId` (FormRunner autenticado)
5. Criar `/app/minhas-vistorias` (lista + agenda do vistoriador) + ajustar sidebar e `routeForRole`
6. Criar `/app/agenda` (calendário admin) + entrada na sidebar
7. Ações de reagendar/cancelar a partir do calendário admin
