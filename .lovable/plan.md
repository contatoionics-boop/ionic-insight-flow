## Objetivo

Tornar o modo chat da vistoria mais conversacional:

1. Quando o agente responder o CEP, o chat **pula automaticamente** as perguntas de endereço que o CEP já retornou (logradouro, bairro, cidade, estado / "cidade-estado"), deixando o agente responder só o que falta (tipicamente **número** e complemento).
2. Adicionar **gravar voz** como alternativa ao teclado em perguntas de texto (`texto`, `numero`, `cep` manual, `cnpj` manual), com transcrição automática inserida no campo — igual ao que já existe na pergunta tipo `audio`, mas disponível como botão de microfone ao lado do input.

Escopo: somente UX do chat de vistoria. Sem mudanças no modelo de dados, no editor de formulários, nem no fluxo do especialista.

## Mudanças

### 1. Auto-preenchimento pós-CEP (`src/components/agent/FormChat.tsx`)

- Ao confirmar uma pergunta do tipo `cep` com endereço encontrado, varrer as perguntas seguintes **da mesma seção** que ainda não foram respondidas.
- Para cada uma, comparar o `texto` da pergunta (normalizado — sem acento, lowercase) com um dicionário de sinônimos:
  - `logradouro` / `rua` / `endereco` / `endereço` → `logradouro` do CEP
  - `numero` / `número` / `nº` / `n.` → **não preencher** (é o que o usuário precisa informar)
  - `complemento` → **não preencher**
  - `bairro` → `bairro`
  - `cidade` (sozinho) → `cidade`
  - `estado` / `uf` → `estado`
  - `cidade/estado` / `cidade e estado` / `municipio/uf` → `${cidade}/${estado}`
- Para cada match: gravar a resposta via `onAdvanceSection([pergunta])`, marcar como confirmada e mover o cursor para frente, igualzinho ao fluxo do botão Confirmar. Os itens preenchidos aparecem no histórico como bolhas normais com legenda **"Preenchido pelo CEP — Corrigir"**, permitindo edição manual se a base do ViaCEP estiver desatualizada.
- O parsing do endereço é feito a partir do próprio `resposta.text` do CEP (formato já gravado: `00000-000 — Rua X, Bairro — Cidade/UF`), então não precisa mudar `CampoCep`.

### 2. Gravar voz em perguntas de texto (`src/components/agent/FormFields.tsx`)

- Criar um componente interno `MicInline` reaproveitando a lógica de gravação/transcrição já existente em `CampoAudio` (extrair para `useGravacaoVoz` em `src/components/agent/use-gravacao-voz.ts` para não duplicar — `MediaRecorder` + `transcreverAudio` server fn + upload opcional no storage).
- Adicionar o botão de microfone:
  - Ao lado do `<Textarea>` da pergunta `texto`
  - Ao lado do `<input number>` da pergunta `numero`
  - Dentro do `CampoCep` e `CampoCnpj`, na área "digite manualmente"
- Comportamento: ao parar a gravação, transcreve e **concatena** ao `resposta.text` (ou substitui se vazio). Mostra o tempo da gravação enquanto grava (ícone pulsante) e um spinner curto durante a transcrição.
- Reutiliza a server function `transcreverAudio` que já existe em `@/lib/agent-ai.functions` — sem mudanças no backend.

### 3. Detalhes técnicos

- Helper `normalizar(s: string)` em `FormChat.tsx`: remove diacríticos com `normalize("NFD").replace(/\p{Diacritic}/gu, "")` e baixa caixa.
- Helper `parseEnderecoFromCepText(text)`: regex `^(\d{5}-\d{3})\s*—\s*(.+?),\s*(.+?)\s*—\s*(.+?)\/(\w{2})$` retornando `{ logradouro, bairro, cidade, estado }` ou `null`.
- O auto-preenchimento roda dentro de `confirmar()` em `FormChat.tsx`, após o `onAdvanceSection` do CEP, em loop sequencial até bater numa pergunta sem match (ex.: "número") — onde o cursor para naturalmente.
- Para o microfone, áudio fica só local (não precisa salvar em `audioPath`) — o resultado importa é o texto transcrito.

### 4. Não muda

- Schema do banco, server functions, editor de formulários (`app.forms.$id.tsx`), modo preview, fluxo de envio ao especialista.
- O fluxo continua funcionando se o formulário **não** tiver perguntas de endereço separadas — o CEP é confirmado normalmente e segue para a próxima pergunta real.

## Arquivos afetados

- `src/components/agent/FormChat.tsx` — auto-preenchimento pós-CEP
- `src/components/agent/FormFields.tsx` — botão de microfone em `texto`/`numero`/`cep`/`cnpj`
- `src/components/agent/use-gravacao-voz.ts` — **novo**, hook extraído de `CampoAudio`
