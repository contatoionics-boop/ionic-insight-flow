# Pré-preenchimento dos dados de cadastro no mapeamento

## O que está acontecendo hoje

O chat já carrega os dados do cliente do cadastro, mas só consegue preencher automaticamente três coisas: CNPJ, CEP e endereço. Tudo o resto — "Cliente / Unidade", "Agente Técnico", "Data da Vistoria", telefone, e-mail, cidade/estado — continua sendo perguntado ao agente, mesmo já existindo no agendamento.

Além disso:
- O nome do agente técnico e a data/hora do agendamento nem chegam a entrar na lista de dados disponíveis para preenchimento (não são carregados junto com o caso).
- A primeira mensagem do chat sempre diz "Vamos continuar de onde você parou", mesmo quando o mapeamento está começando agora.
- Não existe uma etapa de conferência: o agente não vê os dados vindos do cadastro para confirmar se estão corretos.

## O que será feito

### 1. Trazer todos os dados do agendamento
Passar a carregar também o nome do agente técnico (cadastrado ou digitado manualmente), a data/hora agendada, tipo de solicitação, modalidade e nível, além dos dados de empresa/matriz/unidade que já vêm hoje.

### 2. Preenchimento automático amplo
Ampliar o preenchimento automático para reconhecer os campos mais comuns dos formulários:
- Cliente / Empresa / Razão social / Unidade / Loja / Posto
- Agente técnico / Responsável pelo mapeamento / Vistoriador
- Data da vistoria / Data do mapeamento (usa a data agendada)
- CNPJ, CEP, endereço, cidade, estado, bairro, telefone, e-mail
- Tipo de solicitação, modalidade e nível

O reconhecimento usa duas fontes, nesta ordem: a chave do laudo já configurada na pergunta (`chave_laudo`) e, na ausência dela, o texto da pergunta normalizado (sem acentos, minúsculo). Campos de foto, áudio e vídeo nunca são preenchidos.

### 3. Etapa de conferência no início
Ao abrir um mapeamento, antes de qualquer pergunta o chat mostra um cartão "Confira os dados do atendimento" com tudo que veio do cadastro e do agendamento, e dois caminhos:
- **Confirmar e iniciar** → grava os dados como respostas e segue para a primeira pergunta real.
- **Corrigir** → o agente edita os valores no próprio cartão antes de confirmar.

Só depois da confirmação o mapeamento é marcado como iniciado.

### 4. Saudação correta
A mensagem de abertura passa a depender do estado: mapeamento novo recebe boas-vindas + conferência dos dados; mapeamento já iniciado é que recebe "Vamos continuar de onde você parou".

### 5. Mapeamentos já em andamento
O preenchimento automático roda a cada carregamento do chat e só toca em perguntas ainda **não respondidas** — então os mapeamentos em andamento passam a receber os dados de cadastro nos campos que ainda estão vazios, sem sobrescrever nada que o agente já respondeu. Para esses casos, a etapa de conferência aparece uma única vez, listando o que foi preenchido, e depois o chat retoma normalmente de onde parou.

## Detalhes técnicos

- `src/lib/vistoria-agent.server.ts`
  - `loadAgentContext`: incluir `agente:profiles(nome)`, `agente_nome_manual`, `agendado_em`, `tipo_solicitacao`, `modalidade`, `nivel` do caso/agendamento na lista `cadastro`.
  - `sincronizarCadastro`: substituir os três `if` atuais por um mapa de resolução (chave canônica → valor), consultando primeiro `perguntas.chave_laudo` e depois heurística de texto; retornar a lista de perguntas preenchidas para a UI.
  - Marcar as respostas geradas com origem cadastro (ex.: `ia_motivo = 'preenchido_do_cadastro'`) para permitir destacá-las na conferência e na revisão.
- `src/lib/vistoria-agent.functions.ts` — `getEstadoVistoria` retorna `dadosCadastro` (label, valor, perguntaId, preenchido) e um flag `precisaConfirmarCadastro`.
- `src/components/agent/AgentChat.tsx` — renderizar o cartão de conferência (reaproveitando `BlocoResposta` para os campos editáveis), ajustar `formatarPerguntaRetomada` para diferenciar início x retomada, e disparar o salvamento em lote na confirmação.
- Sem migração de banco: nenhum novo campo é necessário; a normalização de casos antigos acontece no próprio carregamento do chat.

## Ponto a confirmar

A confirmação dos dados será registrada como respostas normais do formulário (aparecendo no PDF e na revisão), e não como um passo separado — assim nada muda na estrutura do laudo.
