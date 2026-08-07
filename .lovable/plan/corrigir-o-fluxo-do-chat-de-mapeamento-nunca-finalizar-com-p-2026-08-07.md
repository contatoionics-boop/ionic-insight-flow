# Corrigir o fluxo do chat de mapeamento: nunca finalizar com pendências

## O que eu verifiquei no banco (caso CS-0031, formulário BB0001)

- O formulário tem **67 perguntas, sendo 57 obrigatórias** e **nenhuma condicional**.
- O caso tem **44 de 57 obrigatórias respondidas** e **46 de 67 no total**.
- Ou seja: os números das telas estão corretos (44/57 e 46/67, "ainda faltam 21").
  O erro está no **chat**, que sugeriu finalizar com **13 obrigatórias pendentes**.

## Causa

1. **A regra de "não finalizar" existe apenas como texto no prompt.** Não há
   nenhuma trava real: se o modelo "achar" que acabou, ele anuncia o fim.
2. **O botão Finalizar não valida nada.** A função `finalizarVistoriaChat`
   muda o status para "aguardando revisão" sem conferir pendências — então o
   agente consegue encerrar um mapeamento incompleto.
3. **A condução da conversa é 100% do modelo.** Não existe um mecanismo que
   force "a próxima pergunta pendente"; em formulários longos (67 itens) o
   modelo perde o fio e pula para o encerramento.
4. **Contagens divergentes dentro do próprio motor.** O prompt considera
   respondida qualquer pergunta com texto/arquivo/transcrição, ignorando
   respostas com múltiplas fotos (`arquivos_paths`) e aceitando texto vazio,
   enquanto o retorno de cada salvamento usa uma regra diferente (mais
   rigorosa). O modelo recebe dois sinais conflitantes.

## O que vou fazer

### 1. Uma única fonte de verdade para "respondida"
Criar uma função única de avaliação (texto não vazio, arquivo, lista de
arquivos ou transcrição) e usá-la no prompt, no retorno do salvamento, no
estado do rodapé do chat, no resumo e nas telas de lista/detalhe. Fim das
divergências entre 44/57, 46/67 e o que o chat enxerga.

### 2. Trava real no encerramento
- `finalizarVistoriaChat` recalcula as pendências no servidor e **recusa**
  finalizar enquanto houver obrigatória em aberto, devolvendo quantas e quais.
- O botão "Finalizar" fica desabilitado (com dica "faltam N obrigatórias")
  enquanto houver pendências, e mostra o erro caso o servidor recuse.

### 3. Condução determinística da conversa
- A cada turno, o prompt passa a receber, no topo, um bloco curto e explícito:
  contagem atual, a **próxima pergunta pendente** e a lista das pendentes
  restantes — em vez de depender do modelo varrer o JSON completo.
- Depois de cada `salvar_resposta`, o modelo é obrigado a seguir para o
  `proxima_pergunta_id` retornado pelo próprio servidor.
- Uma nova ferramenta `proximas_pendentes` permite ao modelo reconsultar as
  pendências a qualquer momento (útil quando o usuário pede para finalizar).
- Se o usuário pedir para encerrar com pendências, o assistente responde com
  quantas faltam e retoma pela próxima.

### 4. Retomada e visibilidade
- No resumo "Respostas já preenchidas", separar claramente
  **Obrigatórias pendentes** de **Opcionais pendentes** (hoje aparecem juntas
  como "Ainda faltam 21", o que confunde com as 13 obrigatórias).
- O rodapé do chat mostra as duas contagens (obrigatórias e total).

## Detalhes técnicos

- `src/lib/vistoria-agent.server.ts`: extrair `estaRespondida()`; usar em
  `buildSystemPrompt` e `execSalvarResposta`; adicionar `calcularPendencias(ctx)`
  retornando `{ obrigatoriasFaltando, pendentes[], proxima }`; injetar bloco
  determinístico no prompt.
- `src/routes/api/vistoria-chat.ts`: registrar a ferramenta `proximas_pendentes`.
- `src/lib/vistoria-agent.functions.ts`: validar pendências dentro de
  `finalizarVistoriaChat` (erro claro em vez de status alterado).
- `src/components/agent/AgentChat.tsx`: desabilitar/rotular o botão Finalizar
  conforme o estado e tratar o erro do servidor.
- `src/components/agent/ResumoRespostas.tsx`: separar pendentes obrigatórias
  das opcionais.
- `src/lib/mapeamento.functions.ts` e `src/lib/agente-progresso.functions.ts`:
  passar a usar a mesma regra de "respondida".

Sem mudanças de banco de dados.

## Validação antes de fechar

Reproduzir com CS-0031: confirmar que o chat lista as 13 obrigatórias
pendentes, que o botão Finalizar fica bloqueado e que os números batem entre
chat, resumo, lista de mapeamentos e tela de detalhe.
