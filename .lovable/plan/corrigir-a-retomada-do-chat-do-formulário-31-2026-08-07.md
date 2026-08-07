# Corrigir a retomada do chat do formulário 31

## Diagnóstico confirmado

- O caso **CS-0031 / BB0001** possui **67 perguntas**, **46 respondidas** e **13 obrigatórias pendentes**.
- O histórico salvo termina, em 09/07, com a mensagem antiga **“Tudo registrado... pode finalizar”**.
- Ao reabrir o chat, a interface mostra a última mensagem do histórico sem confrontá-la com o estado atual. Por isso o contador novo mostra **“Faltam 13”**, mas o conteúdo central continua dizendo para finalizar.
- O prompt corrigido só é usado quando ocorre uma nova chamada à IA; apenas abrir a tela não gera uma retomada.
- A escolha atual de `proxima` usa a lista carregada apenas por `perguntas.ordem`, sem garantir **ordem da seção + ordem da pergunta**, e prioriza todas as obrigatórias antes das opcionais. Isso não representa necessariamente o ponto correto em que o agente parou.
- O caso ainda está com status `agendado` no banco apesar de já possuir 46 respostas; a lista consegue inferir que foi iniciado pelas respostas, mas o status oficial ficou inconsistente.

## Implementação

### 1. Definir a sequência oficial do formulário

- Carregar e ordenar perguntas por **ordem da seção** e depois **ordem da pergunta**.
- Definir a retomada como a **primeira pergunta visível e ainda não respondida nessa sequência**, preservando o fluxo natural do formulário.
- Usar essa mesma sequência no prompt, no retorno de `salvar_resposta`, no estado do chat e no resumo.

### 2. Criar um estado de retomada no servidor

- Expandir o estado retornado ao chat com os dados necessários da próxima pendência: ID, texto, tipo, seção, instrução e opções.
- Recalcular esse estado sempre a partir das respostas salvas, sem confiar na última frase produzida pela IA.
- Quando já houver respostas e o caso ainda estiver `agendado`, normalizar o caso para `em_andamento` sem duplicar o evento de início.

### 3. Substituir visualmente a conclusão antiga ao reabrir

- Depois de carregar histórico + estado, se houver pendências, mostrar uma mensagem de retomada como mensagem atual: **“Vamos continuar de onde você parou”** seguida da próxima pergunta oficial.
- A mensagem antiga de encerramento continuará preservada no histórico, mas nunca será usada como mensagem principal quando o servidor informar pendências.
- A resposta seguinte do agente será enviada junto do contexto dessa pergunta de retomada, permitindo que a IA a associe ao ID correto, salve e avance.
- Se não houver histórico, iniciar diretamente pela primeira pergunta; se não houver pendências obrigatórias, só então mostrar o encerramento.

### 4. Tornar o avanço resistente a respostas antigas da IA

- Após cada `salvar_resposta`, exigir que a resposta visível use a `proxima_pergunta_id` devolvida pelo servidor.
- Caso a IA ainda tente anunciar conclusão com pendências, a interface priorizará o estado oficial e exibirá a próxima pergunta em vez do texto incorreto.
- Manter a trava já existente no botão e no servidor para impedir finalização enquanto houver obrigatórias pendentes.

## Validação

- Abrir o **CS-0031** e confirmar que a tela não exibe mais “Tudo registrado”.
- Confirmar que aparece a primeira pendência na sequência real do formulário e que o topo continua mostrando **13 obrigatórias pendentes**.
- Responder essa pergunta, recarregar a página e verificar que o chat retoma na pendência seguinte, sem repetir nem pular pergunta.
- Pausar e retomar em perguntas de texto, seleção, áudio e foto.
- Confirmar que o caso aparece oficialmente como **Em andamento** e que lista, resumo e chat apresentam as mesmas contagens.
- Finalizar somente após zerar as obrigatórias e verificar que, nesse único cenário, o texto de conclusão e o botão Finalizar são liberados.

Sem alteração de estrutura do banco e sem apagar o histórico existente.