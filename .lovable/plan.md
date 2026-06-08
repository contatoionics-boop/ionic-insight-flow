# Múltiplos formulários por mapeamento

## Conceito

Cada **caso** continua sendo 1 formulário em execução. Introduzimos um **agendamento** que agrupa vários casos (1 por formulário) compartilhando cliente, agente, data e endereço.

```
agendamento (cliente + agente + data + endereço)
 ├── caso A  → formulário 1  → chat/respostas/PDF próprios
 ├── caso B  → formulário 2  → chat/respostas/PDF próprios
 └── caso C  → formulário 3  → chat/respostas/PDF próprios
```

Aproveita 100% do que já existe (chat, respostas, PDF por caso). O chat continua "baseado no formulário escolhido pelo agente" automaticamente, porque cada formulário é um caso isolado.

## Regras de execução (confirmadas)

- **Ordem livre, mas exclusiva**: o agente escolhe qualquer formulário pendente, mas só pode ter **um caso `em_andamento` por agendamento** ao mesmo tempo. Os demais ficam bloqueados até o atual virar `aguardando_revisao`/concluído.
- **Edição do agendamento**: Ian (admin) pode adicionar formulários novos ou remover formulários ainda não iniciados (`rascunho`/`agendado`). Formulários já iniciados não podem ser removidos pela edição — só cancelados manualmente.
- **PDF**: 1 PDF por formulário (sem mudança).
- **Sem backfill**: dados de teste serão apagados antes da migration; `agendamento_id` em `casos` será **NOT NULL**.

## Mudanças

### 1. Banco (migration)
- `DELETE` em `respostas_agente`, `links_agente`, `casos` (dados de teste; confirmado pelo usuário).
- Nova tabela `agendamentos`: `unidade_id`, `matriz_id`, `agente_id`, `criado_por`, `agendado_em`, `duracao_min`, `endereco_vistoria`, `observacoes_agendamento`, `criado_em`, `atualizado_em`.
- `casos.agendamento_id uuid NOT NULL` FK em `agendamentos(id) ON DELETE CASCADE`.
- Mover de `casos` para `agendamentos` os campos que passam a ser do grupo: `unidade_id`, `agendado_em`, `duracao_min`, `endereco_vistoria`, `observacoes_agendamento`. Em `casos` ficam só: `formulario_id`, `status`, `codigo`, `criado_em`, `atualizado_em`, `agendamento_id` (agente_id e criado_por podem ficar redundantes em casos para simplificar RLS, ou migrar para agendamento e fazer join — decidir na hora; preferência: mover tudo de cliente/agente para agendamentos).
- RLS de `agendamentos` espelha a de `casos` hoje (agente vê os seus; admin vê os da empresa). RLS de `casos` passa a derivar do agendamento.
- GRANTs obrigatórios (authenticated + service_role).

### 2. Agendamento pelo Ian — `src/routes/app.new-case.tsx` + `casos.functions.ts`
- Campo **Formulário** vira **multi-select** (mínimo 1).
- Nova server fn `agendarMapeamento({ unidadeId, matrizId, agenteId, agendadoEm, duracaoMin, endereco, observacoes, formIds[] })` → cria 1 `agendamento` + N `casos` numa transação.
- `agendarVistoria` antiga é substituída (não há dados antigos para preservar).

### 3. Edição de agendamento (nova tela ou modal)
- Tela `/app/agendamento/$id` para o Ian: lista formulários atuais (com status de cada caso), botão "Adicionar formulário" (cria novo caso) e "Remover" só habilitado em casos ainda não iniciados.
- Server fns: `adicionarFormularioAoAgendamento({ agendamentoId, formId })`, `removerCasoDoAgendamento({ casoId })`.

### 4. Lista do agente — `src/routes/app.minhas-vistorias.tsx`
- Agrupar por agendamento. Card por agendamento mostra: cliente + data + endereço + lista de formulários com status individual.
- Botão **Iniciar/Continuar** por formulário pendente. **Botão fica desabilitado** se já existe outro caso do mesmo agendamento com status `em_andamento` (apenas o caso ativo aparece habilitado, com label "Continuar").
- Agendamento aparece em "Concluídos" quando todos os casos estão `aguardando_revisao` ou além.

### 5. Execução no chat — `src/components/agent/AgentChat.tsx` + `app.vistoria.$casoId.tsx`
- Nenhuma mudança na lógica do agente IA: cada caso já carrega seu próprio formulário.
- Ao abrir o caso, marcar status `em_andamento` (já acontece). Garantir no servidor que outra abertura no mesmo agendamento é rejeitada enquanto há outro `em_andamento`.
- Header do chat ganha link "Voltar ao agendamento" → `/app/minhas-vistorias` com o agendamento expandido (ou nova rota `/app/agendamento/$id`).
- Após finalizar, redirecionar para a tela do agendamento mostrando o próximo formulário pendente (em vez de listar tudo).

### 6. Telas admin afetadas (ajuste de listagem, sem mudança de lógica)
- `app.cases`, `app.review-queue`, `app.agenda`, `app.tracking`: passam a fazer `join` via `agendamento` para puxar cliente/data/endereço. Listagem continua por caso (cada formulário é uma linha), só muda a origem dos campos.

### 7. Link público `/agent/$token`
- Fora do escopo desta etapa (fluxo autenticado primeiro). `links_agente` continua 1:1 com caso.

## Detalhes técnicos

- **Constraint "um em_andamento por agendamento"**: índice parcial único em `casos(agendamento_id) WHERE status = 'em_andamento'`. Garante a regra no banco, evita corrida.
- **Status do agendamento**: derivado por query (não armazenado). Regra: se todos os casos ∈ {aguardando_revisao, aprovado, concluido} → concluído; se algum em_andamento → em andamento; senão → agendado.
- **`gen_caso_codigo`**: continua gerando código por caso. Opcional: prefixar com código do agendamento depois — fora do escopo agora.
- **Ordem livre + exclusiva no front**: a UI só habilita o caso em andamento; tentar iniciar outro retorna erro do servidor (defesa em profundidade).
