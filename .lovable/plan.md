# Novos campos no agendamento de mapeamento

Adicionar ao fluxo de "Agendar mapeamento" (disponível para IAM e Especialista, como hoje):

1. **Tipo de solicitação**: Instalação ou Upgrade (obrigatório)
2. **Modalidade**: Presencial ou Remoto (obrigatório)
3. **Nível**: Nível 1, Nível 2 ou Nível 3 (obrigatório)
4. **Agente técnico**:
   - Presencial → seleção do agente na lista, obrigatória (como hoje)
   - Remoto → seleção opcional; é possível escolher um agente da lista, **digitar o nome manualmente** (texto livre, quando a pessoa não está cadastrada) ou deixar em branco para definir depois

## Comportamento do agendamento remoto sem agente cadastrado

- O agendamento e os mapeamentos são criados normalmente, com status "agendado".
- Quando o nome é apenas digitado, ele fica registrado como "agente informado" no agendamento e aparece na agenda/mapeamentos, mas não gera aceite nem notificação (não há usuário vinculado).
- Sem agente vinculado não há verificação de conflito de agenda.
- Na agenda e na lista de mapeamentos aparece o nome digitado ou "Agente a definir".
- Uma ação "Atribuir agente" na tela do agendamento permite vincular um agente cadastrado depois: valida conflito, grava o agente no agendamento e nos mapeamentos, notifica para aceite e registra o evento `agente_atribuido` no histórico.

## Onde os novos campos aparecem

- Formulário de agendamento (novos seletores).
- Card/tela de detalhe do agendamento.
- Lista de mapeamentos e modal de detalhe da agenda: etiquetas compactas (ex.: "Instalação · Remoto · Nível 2").

## Detalhes técnicos

Banco (migração):
- Novos tipos enum: `tipo_solicitacao` (`instalacao`, `upgrade`), `modalidade_atendimento` (`presencial`, `remoto`), `nivel_mapeamento` (`nivel_1`, `nivel_2`, `nivel_3`).
- Colunas em `agendamentos` e `casos`: `tipo_solicitacao`, `modalidade`, `nivel` (default `instalacao` / `presencial` / `nivel_1` para as linhas existentes).
- `agendamentos.agente_id` passa a aceitar nulo (hoje é obrigatório); `casos.agente_id` já aceita nulo.
- Revisar políticas de leitura/escrita existentes que assumem `agente_id` preenchido, mantendo a paridade IAM/Especialista.

Código:
- `src/lib/casos.functions.ts`: `AgendarInput` ganha os três campos e torna `agenteId` opcional quando `modalidade = remoto`; `checarConflito`, criação do agendamento/casos e notificação passam a considerar agente nulo. Nova server function `atribuirAgenteAgendamento` (mesma checagem de permissão, conflito, notificação e evento).
- `src/routes/app.new-case.tsx`: novos seletores, regra de obrigatoriedade do agente por modalidade, e a verificação de conflito em tempo real só roda quando há agente.
- `src/routes/app.agendamento.$id.tsx`: exibe os novos campos e a ação "Atribuir agente" quando não houver agente.
- `src/routes/app.agenda.tsx` e `src/routes/app.cases.tsx`: etiquetas dos novos campos e tratamento de "Agente a definir".

## Observação

Entendi que o nome que pode ficar em aberto no atendimento remoto é o do **agente técnico** (cliente/unidade continuam obrigatórios, pois definem o endereço e a hierarquia do mapeamento). Se a intenção era permitir agendar remoto sem cliente cadastrado, me avise que ajusto o plano.
