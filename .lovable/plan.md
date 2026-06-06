## Contexto

O IONICS já possui uma interface de chat funcional em `src/components/agent/FormChat.tsx`, usada em `/agent/$token` e `/app/vistoria/$casoId` quando `?mode=chat`. Ela já cobre: bolhas pergunta/resposta, progresso no header, autosave por pergunta, edição de respostas anteriores, gravação de voz com Whisper, upload de foto com validação por GPT‑4o Vision, retomada de rascunho e tela de revisão final.

Este plano cobre as **lacunas** entre o que existe e a especificação enviada — sem alterar geração do PDF, autenticação ou permissões.

## 1. Chat como modo padrão
Inverter o default em `src/routes/agent.$token.tsx` e `src/routes/app.vistoria.$casoId.tsx`: `mode = "chat"` passa a ser o padrão; stepper fica como opt‑in via `?mode=stepper`. Listagens que abrem mapeamentos deixam de forçar `?mode=chat`.

## 2. Composer unificado fixo no rodapé (texto + voz + foto)
Novo componente `src/components/agent/ChatComposer.tsx` com os 3 modos sempre visíveis:
- Campo de texto + botão **Enviar**.
- Botão **microfone** press‑and‑hold reutilizando `use-gravacao-voz.ts` + função server Whisper já existente; transcrição cai no input para confirmação.
- Botão **câmera/galeria** (`<input type="file" capture>`) com preview inline; on confirm reusa o pipeline atual de upload + validação GPT‑4o Vision.
- Modos incompatíveis com o tipo da pergunta atual ficam desabilitados.

`FormChat` deixa de embutir `PerguntaBloco` no fluxo ativo (passa a renderizar via composer); `PerguntaBloco` continua sendo usado no modo **edição** e no modo stepper.

Tipos com UI específica (CEP, toggle Sim/Não, múltipla escolha, data, select) continuam como **chips/controles inline abaixo da bolha** e auto‑confirmam ao clicar.

## 3. Indicador de "digitando"
Componente `TypingDots` (3 pontos animados via keyframes em `src/styles.css`). Após `confirmar()` resolver: 600 ms de pausa → mostra `TypingDots` por ~1 s → revela a próxima bolha.

## 4. Saudação inicial
Primeira bolha do agente: `Olá! Vamos fazer o mapeamento de {clienteNome} ({formularioNome}). Responda por texto, voz ou foto.`

## 5. Conclusão e geração do documento
Adicionar CTA **"Gerar documento"** na bolha final, ao lado de "Enviar ao especialista" — chama o fluxo `gerarPdfMapeamento` já existente (sem alterar a geração).

## 6. Header
Subtítulo passa a mostrar **"Pergunta {cursor+1} de {items.length}"**, mantendo a barra de progresso atual.

## 7. Perguntas condicionais (incluído)

### Schema
Migration adicionando à tabela `perguntas`:
- `condicional_pergunta_id uuid references perguntas(id) on delete set null` — pergunta que dispara o gatilho.
- `condicional_operador text check (condicional_operador in ('igual','diferente','contem'))` — default `igual`.
- `condicional_valor text` — valor (ou opção `texto`) a comparar.

Todas opcionais; quando `condicional_pergunta_id` for `null`, a pergunta aparece sempre (compatível com dados atuais).

### Editor de formulário
Em `src/routes/app.forms.$id.index.tsx`, no editor da pergunta, adicionar bloco **"Mostrar somente se"**:
- Select com as perguntas da **mesma seção** ou de **seções anteriores** (excluindo a própria).
- Select de operador (`igual` / `diferente` / `contém`).
- Campo de valor — se a pergunta‑gatilho for `selecao_unica`/`checkbox`/`toggle`, vira select com as opções dela; senão, input texto.

### Avaliação no runtime
Helper `avaliarCondicional(pergunta, state)` em `src/lib/perguntas-mapeamento.ts`:
- Lê `state[condicional_pergunta_id]?.text` (toggle compara `"sim"`/`"nao"`; foto/áudio comparam presença).
- Retorna `true` se condição satisfeita ou se não houver condicional.

### Integração no FormChat / FormRunner
- `items` em `FormChat` é filtrado pelo helper; perguntas ocultas somem do progresso e da numeração.
- Quando o usuário **edita uma resposta‑gatilho** e o resultado muda quais perguntas estão visíveis, recalcular `items`; respostas de perguntas que ficaram ocultas são limpas no Supabase (`valor_texto = null`) para não aparecer no PDF.
- O mesmo filtro é aplicado em `FormRunner` (stepper) para consistência.

### PDF
`pdf-mapeamento.server.ts` já lê respostas existentes; perguntas ocultas terão resposta `null` e podem ser **suprimidas** do PDF (alterar o agrupador para pular perguntas cuja condicional não bate, em vez de imprimir linha vazia).

## O que **não** muda
- Geração do PDF FR‑12‑10 (apenas filtro de ocultas).
- Autenticação, RLS, papéis.
- Modo stepper continua disponível via `?mode=stepper`.
- Tabelas `secoes`, `opcoes_pergunta`, `respostas_agente`.

## Arquivos afetados
**Migration:** `perguntas` (+ 3 colunas condicionais).

**Novos:**
- `src/components/agent/ChatComposer.tsx`
- `src/components/agent/TypingDots.tsx`

**Editados:**
- `src/components/agent/FormChat.tsx` — saudação, typing dots, composer, CTA final, filtro condicional, header.
- `src/components/agent/FormRunner.tsx` — filtro condicional.
- `src/components/agent/FormFields.tsx` — expor handlers de voz/foto reutilizáveis.
- `src/lib/perguntas-mapeamento.ts` — `avaliarCondicional` + limpeza de respostas ocultas.
- `src/lib/pdf-mapeamento.server.ts` — pular perguntas cuja condicional não bate.
- `src/routes/agent.$token.tsx`, `src/routes/app.vistoria.$casoId.tsx` — default `mode=chat`.
- `src/routes/app.forms.$id.index.tsx` — UI "Mostrar somente se".
- `src/styles.css` — keyframes do typing.

## Ordem de execução
1. Migration condicional + tipos regenerados.
2. Helper `avaliarCondicional` + filtros em `FormChat`/`FormRunner`/PDF.
3. UI "Mostrar somente se" no editor de formulários.
4. `ChatComposer` + `TypingDots` + saudação + header + CTA final.
5. Default `mode=chat` + ajuste das listagens.
