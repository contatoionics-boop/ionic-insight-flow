# Blocos agrupados no chat de mapeamento

## O que está acontecendo hoje

O técnico responde pelo `AgentChat` (chat com IA). O servidor calcula a próxima pendência pergunta por pergunta e o chat entrega **uma pergunta por turno**. Num formulário de 52 perguntas isso vira 52 idas e voltas — daí o cansaço.

O que já existe e vamos aproveitar (nada é jogado fora):
- `FormFields.tsx` já sabe renderizar todos os tipos de campo (texto, número, foto, vídeo, áudio, seleção, toggle, CEP, CNPJ) com validação e upload.
- `avaliarCondicional` já implementa o "pular o que não se aplica" (item 4 da sua ideia) — falta só cadastrar as condicionais nos formulários novos.
- Salvamento, progresso, timeline de eventos e laudo continuam iguais: um bloco salva as mesmas respostas individuais que hoje.

O que falta no banco: a tabela `perguntas` tem `ordem` e condicionais, mas **nenhum conceito de grupo**. É essa a peça central.

## Decisão

Chat híbrido: o fluxo continua sendo conversa, mas quando a próxima pendência pertence a um grupo, a bolha do assistente vira um **mini-cartão** com todos os campos daquele grupo de uma vez. Perguntas soltas continuam exatamente como hoje.

Três layouts de bloco:

```text
cartao   → Bomba: [tipo] [marca/modelo] [vazão]        (um card, campos empilhados)
matriz   → Direção | Distância | Objeto                (tabela, uma linha por item)
           Frente  | ___      | ___
           Atrás   | ___      | ___
fotos    → slots nomeados: [Registrador] [Bloco] [Bico] ... (upload em lote)
```

## Etapas

### 1. Banco — conceito de bloco
- Nova tabela `pergunta_blocos`: `secao_id`, `titulo`, `layout` (`cartao` | `matriz` | `fotos`), `ordem`, `descricao`.
- Em `perguntas`: `bloco_id` (nullable), `bloco_linha` (rótulo da linha na matriz, ex. "Frente"), `bloco_coluna` (rótulo da coluna, ex. "Distância").
- Perguntas sem `bloco_id` seguem o comportamento atual. Nenhum formulário existente quebra.
- RLS/grants espelhando as políticas já usadas em `perguntas`.

### 2. Sugestão automática de blocos + ajuste manual
- Server function `sugerirBlocos(formularioId)` com heurísticas:
  - **prefixo comum** no texto ("Bomba – tipo", "Bomba – marca") → bloco cartão;
  - **mesmo sufixo repetido** por direção/item (frente/atrás/direita/esquerda) → bloco matriz, com linhas e colunas deduzidas;
  - **sequência de perguntas tipo foto** na mesma seção → bloco de fotos, cada slot nomeado com o texto da pergunta;
  - regra de tamanho: só sugere blocos com 2 a 8 campos.
- No editor (`app.forms.$id.index.tsx`): botão "Agrupar perguntas", painel com as sugestões, o admin aceita/rejeita cada uma, renomeia o bloco, troca o layout e arrasta perguntas entre blocos. Nada é aplicado sem confirmação.

### 3. Renderização do bloco no chat
- Novo componente `BlocoResposta.tsx` (reutiliza `PerguntaBloco` de `FormFields`) com os três layouts.
- `AgentChat` passa a olhar, além de `proximaPerguntaId`, o `proximoBlocoId`: se houver bloco, renderiza o cartão inline em vez de esperar texto no composer.
- "Confirmar bloco" salva todas as respostas do grupo numa chamada e devolve ao chat um resumo compacto ("Bomba: elétrica · Wayne · 50 L/min"), mantendo o histórico legível.
- Campos vazios não obrigatórios são permitidos; obrigatórios faltando bloqueiam o confirmar com destaque no campo.

### 4. Servidor — pendências por bloco
- `calcularPendencias` passa a agrupar: retorna a próxima pendência **e** o bloco a que ela pertence, com todas as perguntas visíveis do bloco (já filtradas por condicional).
- `execSalvarResposta` ganha uma variante em lote (`salvar_respostas`) para gravar o bloco inteiro; a ferramenta atual continua para respostas soltas.
- Prompt do assistente ajustado: ao encontrar um bloco, apresentar o grupo de uma vez e não repetir campo a campo.

### 5. Progresso por seção
- Cabeçalho do chat mostra "Seção X de Y — <título>" além da barra de progresso atual.
- Contagem de "momentos" (blocos + perguntas soltas) em vez de só perguntas, para o número percebido bater com a experiência.

### 6. Preview e revisão
- `FormRunner`/`FormChat` (preview do admin) renderizam os mesmos blocos, para o admin ver exatamente o que o técnico verá.
- Tela de revisão continua listando resposta por resposta, agora agrupada pelo título do bloco.

## Notas técnicas

- Condicionais: a lógica atual (`avaliarCondicional`) passa a ser avaliada também no nível do bloco — se todas as perguntas do bloco estiverem ocultas, o bloco some. Como os formulários serão refeitos, não faremos migração de condicionais agora.
- Nenhum dado deixa de ser coletado: bloco é só uma camada de apresentação/agrupamento sobre as mesmas linhas de `respostas_agente`.
- `chave_laudo` e o motor de laudo não mudam — continuam lendo respostas por pergunta.
- Fotos em lote reaproveitam o upload atual (mesmo bucket, mesmo limite), só mudando a UI para slots simultâneos.
