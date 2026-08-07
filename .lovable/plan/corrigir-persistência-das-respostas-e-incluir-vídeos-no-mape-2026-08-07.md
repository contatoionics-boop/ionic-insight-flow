# Corrigir persistência das respostas e incluir vídeos no mapeamento

## Diagnóstico confirmado

- No **CS-0031**, o CNPJ `81.361.644/0001-07` foi enviado quatro vezes e está no histórico do chat, mas **não existe registro correspondente em `respostas_agente`**. Por isso o estado oficial continua apontando “CNPJ do Cliente” como a primeira pendência.
- O CNPJ já existe nos dados cadastrais da matriz. O prompt orienta a IA a salvá-lo automaticamente, porém a IA apenas informou que ele já estava cadastrado e **não executou `salvar_resposta`**.
- O avanço ainda depende da IA escolher e executar corretamente a ferramenta. As últimas respostas foram salvas, mas o retorno da ferramenta continuou apontando o CNPJ como `proxima_pergunta_id`; mesmo assim, a IA avançou verbalmente para outras perguntas. Assim, mensagem exibida e estado salvo ficaram divergentes.
- As mensagens do usuário e do assistente são persistidas sem aguardar a conclusão da gravação. Ao fechar ou trocar de aba rapidamente, a interface pode voltar somente ao último estado confirmado no banco.
- Ao reabrir, a tela exibe apenas a pergunta atual. Mesmo quando uma resposta foi salva, ela não permanece visível como confirmação, o que faz o agente acreditar que perdeu o conteúdo.
- A pergunta “Vídeo curto com visão geral da estrutura” está cadastrada como tipo **foto**. O seletor atual usa `accept="image/*"`, e o enum do banco não possui o tipo `video`; portanto vídeos não podem ser selecionados nem tratados corretamente.

## Implementação

### 1. Tornar o salvamento da resposta atual determinístico

- Enviar em cada interação o ID da pergunta oficial que está sendo respondida.
- Antes de pedir à IA que formule a próxima mensagem, salvar a resposta da pergunta atual no servidor para os tipos textuais, CNPJ, CEP, número, data, seleção, toggle e transcrição de áudio.
- Manter a IA para interpretação de respostas em lote e condução da conversa, mas não depender dela para persistir a resposta simples da pergunta exibida.
- Validar no servidor se a pergunta enviada ainda é a pendência atual; em caso de clique duplo, repetição ou resposta já salva, retornar o estado existente sem criar duplicidade.
- Só avançar visualmente após o banco confirmar o salvamento e devolver a próxima pergunta recalculada.

### 2. Sincronizar dados cadastrais com perguntas equivalentes

- Mapear CNPJ, CEP, endereço e demais dados já conhecidos do cadastro para as perguntas correspondentes do formulário.
- Registrar esses valores como respostas oficiais quando a pergunta ainda estiver vazia, em vez de apenas instruir a IA a “pular”.
- No CS-0031, persistir o CNPJ já informado e recalcular imediatamente a próxima pendência real.
- Preservar a possibilidade de o agente revisar/corrigir posteriormente um valor pré-preenchido.

### 3. Garantir persistência ao sair ou trocar de aba

- Aguardar a confirmação de gravação da mensagem e da resposta antes de liberar o próximo envio.
- Persistir a mensagem final do assistente de forma confirmada, com tratamento de falha e nova tentativa segura.
- Ao receber `visibilitychange`, foco novamente ou reconexão, recarregar o estado oficial e reconciliar a tela com o banco sem reiniciar a pergunta já respondida.
- Usar chaves idempotentes/identificadores de mensagem para impedir mensagens e respostas duplicadas durante repetição de requisições.

### 4. Manter a resposta confirmada visível

- Retornar no estado da retomada a última pergunta respondida, o valor confirmado, o horário e a próxima pergunta.
- Exibir acima da pergunta atual um bloco compacto **“Resposta registrada”**, com o conteúdo enviado e confirmação visual.
- Ao reabrir o chat, mostrar a última resposta persistida seguida da próxima pendência; nunca voltar para uma pergunta cujo valor já está salvo.
- Para anexos, mostrar nome/tipo e miniatura quando aplicável; o resumo completo continuará disponível em “Ver respostas”.

### 5. Criar suporte próprio para vídeo

- Adicionar `video` ao enum `pergunta_tipo` e às tipagens do aplicativo.
- Atualizar o editor de formulários para permitir criar perguntas do tipo **Vídeo** e migrar perguntas existentes cujo conteúdo exige vídeo, incluindo a pergunta do formulário 31 atualmente marcada como foto.
- No chat, disponibilizar seleção de vídeos da galeria/arquivos e captura de vídeo em dispositivos compatíveis, sem remover as opções atuais de foto.
- Aceitar formatos comuns de navegador e celular (`video/mp4`, `video/webm`, `video/quicktime`), validar arquivo não vazio e aplicar limite de tamanho antes do upload.
- Salvar o caminho do vídeo em `respostas_agente`, considerar a pergunta respondida somente após o upload confirmado e avançar usando o mesmo estado oficial.
- Exibir player de vídeo com URL assinada nas telas de respostas e revisão; em PDF, apresentar a identificação do anexo em vez de tentar incorporar o vídeo.
- Não enviar o vídeo para a validação de imagem atual; ele será armazenado e disponibilizado para revisão humana.

## Ajustes técnicos

- Separar os novos validadores/helpers de runtime dos arquivos `*.functions.ts`, mantendo as funções de servidor como wrappers finos.
- Centralizar a regra de “respondida” para texto, transcrição, imagem, áudio e vídeo, reutilizando-a no chat, contadores, resumo e finalização.
- Incluir migração de schema para o novo enum e migração de dados para reclassificar as perguntas de vídeo existentes, sem apagar respostas ou histórico.
- Atualizar as telas de revisão, detalhes e geração de relatório para reconhecer anexos de vídeo sem tratá-los como imagem.

## Validação

- No CS-0031, confirmar que o CNPJ aparece como registrado uma única vez e que a próxima pergunta deixa de ser CNPJ.
- Responder uma pergunta, trocar de aba imediatamente, voltar e confirmar que a resposta permanece visível e o fluxo continua na pergunta seguinte.
- Recarregar durante e depois de uma resposta, simulando conexão lenta, e verificar ausência de perda e duplicidade.
- Testar respostas por texto digitado, voz transcrita, seleção, foto, áudio e vídeo.
- Anexar vídeos MP4, WebM e MOV no mobile/PWA e desktop; verificar upload, retomada, player na revisão e contagem de progresso.
- Confirmar que anexar uma imagem continua funcionando em perguntas de foto e que vídeo não é enviado à validação de imagem.
- Finalizar somente após todas as obrigatórias visíveis estarem efetivamente persistidas.