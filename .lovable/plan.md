# Finalização do mapeamento → status + laudo/PDF prontos para revisão

## O que está acontecendo hoje (verificado)

- O CS-0042 tem as 32 perguntas obrigatórias respondidas, mas continua **Em andamento**: não existe evento `vistoria_finalizada`, nem data de entrega. Ou seja, a mudança de status só acontece quando o agente clica no botão "Finalizar" no topo do chat — e nesse caso ele não foi clicado.
- A tela de revisão já existe (`/app/review/{id}`) com edição de respostas, troca de arquivos, aba de Laudo, gerar PDF, aprovar e devolver para correção. O problema é achá-la: o menu "Fila de revisão" só aparece para o perfil **especialista**. Super admin / IAM não têm esse item, e a lista de Mapeamentos não tem botão "Revisar".
- O laudo estruturado (e por consequência o PDF do laudo) só é montado quando alguém abre a aba Laudo e clica em gerar — nenhum caso tem laudo salvo.

## O que será feito

### 1. Finalizar de verdade quando o agente termina
- Quando não houver mais nenhuma pergunta obrigatória pendente, o chat mostra um **cartão de conclusão fixo** ("Tudo respondido — Finalizar e enviar para revisão"), em vez de depender só do botão pequeno no topo. No mobile ele fica acima do campo de mensagem.
- A finalização passa a gravar também a **data/hora de entrega** do agente, além do status `Aguardando revisão` e do evento na timeline.
- Tela de confirmação após finalizar informa que o documento foi gerado.

### 2. Gerar o laudo e o PDF automaticamente na finalização
- Ao finalizar, o sistema extrai as variáveis e monta os blocos do laudo, salvando no mapeamento — assim a revisão já abre com o documento pronto.
- Se a geração falhar (IA indisponível, por exemplo), a finalização não é bloqueada: o status muda normalmente e a revisão mostra o aviso com o botão "Gerar laudo".
- Na revisão, a aba Laudo abre já com o conteúdo montado, com **pré-visualização do PDF** e os botões que já existem: ajustar respostas, salvar, gerar novo PDF, devolver para correção e aprovar. Toda edição de resposta marca o laudo como desatualizado, com botão "Regerar laudo/PDF".

### 3. Encontrar a revisão facilmente
- "Fila de revisão" passa a aparecer no menu de super admin e admin/IAM (hoje só especialista tem).
- Na lista de **Mapeamentos**, linhas com status "Aguardando revisão" ganham botão **Revisar** na coluna Ações, que leva direto para a tela de revisão.
- A fila de revisão passa a mostrar também a data de entrega do agente.

### 4. Caso preso hoje
- O CS-0042 (32/32 respondidas) será marcado como entregue/aguardando revisão, com o evento de finalização registrado, para entrar na fila. O CS-0041 continua em andamento porque ainda tem perguntas obrigatórias em aberto (26/32).

## Detalhes técnicos

- `src/lib/vistoria-agent.functions.ts` → `finalizarVistoriaChat`: além de `status: aguardando_revisao`, gravar `data_entrega_agente` e chamar a montagem do laudo (reaproveitando a lógica de `src/lib/laudo/*` e `extrair.server`) dentro de um `try/catch` que não derruba a finalização.
- Extrair a montagem do laudo hoje embutida em `gerarLaudo` (`src/lib/laudo.functions.ts`) para um helper server-only reutilizável pelas duas rotas.
- `src/components/agent/AgentChat.tsx`: cartão de finalização quando `obrigatoriasFaltando === 0`.
- `src/components/AppLayout.tsx`: incluir `/app/review-queue` nos menus `super_admin` e `admin`.
- `src/routes/app.cases.tsx`: botão "Revisar" na coluna Ações para `aguardando_revisao`.
- `src/components/laudo/LaudoPanel.tsx`: preview do PDF (iframe com blob) e estado "laudo desatualizado" após edição de respostas.
- Ajuste pontual de dados para o CS-0042 (status, data de entrega e evento).
