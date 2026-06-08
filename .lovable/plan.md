## Visão geral

Substituir o `FormChat`/`FormRunner` (formulário disfarçado de chat) por um **agente conversacional real**, dirigido por LLM via AI SDK + Lovable AI Gateway. O formulário do admin vira o **roteiro** que a IA usa para conduzir a conversa em PT‑BR formal técnico.

**Decisões confirmadas:** `google/gemini-3-flash-preview`; tom formal técnico; aceita batch (várias respostas num turno); `FormChat` legado é removido.

**Não muda:** schema do banco (`formularios`/`secoes`/`perguntas`/`opcoes_pergunta`/`respostas_agente`/condicionais), editor de formulários, RLS, autenticação, geração do PDF FR‑12‑10, upload de foto + validação GPT‑4o Vision, transcrição Whisper, helpers de CEP/CNPJ.

## Arquitetura

```text
Browser (AgentChat + useChat)        /api/vistoria-chat (server route)        Supabase
─────────────────────────────        ──────────────────────────────────       ────────
UIMessage[] + parts ──POST──▶  streamText(model, tools, system) ──tools──▶  respostas_agente
   parts ◀──stream────────────  toUIMessageStreamResponse                     perguntas
   AI Elements UI                                                             casos / storage
   Composer: texto + mic + foto
```

- **Frontend:** `AgentChat.tsx` montado com AI Elements (`Conversation`, `Message`, `MessageResponse`, `PromptInput`, `Tool`, `Shimmer`). Render via `message.parts`. Composer único no rodapé: textarea + botão de microfone (reusa `useGravacaoVoz` → Whisper) + botão de câmera (reusa pipeline de upload Storage). Sem botão "Confirmar".
- **Backend:** server route `src/routes/api/vistoria-chat.ts`. Recebe `{ messages, token | casoId }`, valida acesso (token de link OU sessão autenticada para vistoria interna), carrega formulário + estado atual de respostas, monta system prompt + tools e faz `streamText` com `gemini-3-flash-preview`.
- **State persistente:** `respostas_agente` continua sendo a fonte de verdade. Cada turno, o server lê o estado atual antes de chamar o modelo, então não precisamos persistir o histórico de mensagens (a conversa é descartável; o que importa é a tabela de respostas).

## System prompt (essência)

> Você é o assistente de vistoria da Ionics conduzindo o mapeamento técnico de **{cliente}** com o formulário **{nome}**. Use português do Brasil em tom **formal técnico** ("Por favor, informe…"). Faça **uma pergunta por vez**, reformulando o texto cru de forma clara. Aceite respostas em batch: se o usuário fornecer várias informações numa só mensagem, distribua-as chamando `salvar_resposta` várias vezes antes de avançar. Sempre chame `salvar_resposta` antes de fazer a próxima pergunta. Respeite as condicionais (campo `condicional`). Use `validar_cep`/`validar_cnpj`/`validar_foto` quando aplicável. Quando todas as obrigatórias visíveis estiverem respondidas, chame `marcar_concluido` e ofereça o botão de gerar o documento.

Anexa JSON enxuto: `[{ pergunta_id, secao, texto, tipo, obrigatoria, opcoes, condicional, instrucao_agente, contexto_ia }]` + `state` atual `{ pergunta_id: { valor_texto, arquivo_path, transcricao } }`.

## Tools (todas com validação server-side)

1. **`salvar_resposta`** `{ pergunta_id, valor_texto?, opcao_id?, arquivo_path?, transcricao? }` — valida que `pergunta_id` pertence ao formulário do caso, valida tipo (foto exige `arquivo_path`, selecao_unica exige `opcao_id` válido, toggle só aceita `"sim"`/`"nao"`, etc). Faz upsert em `respostas_agente`. Retorna `{ ok, proxima_pergunta_sugerida }`.
2. **`validar_cep`** `{ cep }` — reusa lookup atual; retorna `{ logradouro, bairro, cidade, estado }`.
3. **`validar_cnpj`** `{ cnpj }` — reusa `buscarPorCnpj`; retorna razão social, endereço.
4. **`validar_foto`** `{ pergunta_id, arquivo_path }` — reusa `validarFoto` (GPT‑4o Vision). Retorna `{ status, problemas, orientacao }`.
5. **`marcar_concluido`** `{}` — server recalcula condicionais e checa se todas as obrigatórias visíveis têm resposta válida. Se faltar, retorna `{ ok: false, faltando: [pergunta_id...] }` e a IA volta a perguntar. Se ok, marca caso como `pronto_para_envio` e libera CTA "Gerar documento" no UI.

`stopWhen: stepCountIs(50)` para permitir loops de tool em batch.

## Anexos (foto/áudio)

- **Foto:** clique na câmera → upload direto ao Supabase Storage (mesmo pipeline atual) → cliente envia a mensagem com `parts: [{type:"text", text:"Foto anexada"}, {type:"data-attachment", data:{arquivo_path, mime}}]`. Server injeta `arquivo_path` no contexto da próxima `salvar_resposta`/`validar_foto`.
- **Áudio:** mic press‑and‑hold → blob → `transcreverAudio` (já existente) → transcrição vai como texto normal na próxima mensagem do usuário.

## Mudança de rotas

- `/agent/$token` e `/app/vistoria/$casoId` passam a renderizar **só** `AgentChat`.
- `?mode=stepper` removido (`FormRunner` deletado junto com `FormChat`).
- `useGravacaoVoz`, `validarFoto`, `transcreverAudio`, helpers de CEP/CNPJ, `avaliarCondicional` — **preservados** (chamados pelas tools).

## Componentes do mapeamento existentes (FormFields)

Os componentes especializados (`MicButton`, lógica de CEP/CNPJ inline) ficam disponíveis como utilitários para o composer, mas não como blocos de formulário. Para inputs estruturados que ainda fazem sentido renderizar inline (ex.: foto: preview + confirmar), o AI Elements `Tool` renderiza o resultado da tool com card customizado dentro da bolha da IA.

## Arquivos

**Novos**
- `src/routes/api/vistoria-chat.ts` — server route, `streamText`, tools, validação de acesso por token/sessão.
- `src/lib/vistoria-agent.server.ts` — system prompt builder + execução das tools (usa `supabaseAdmin` escopado ao `caso_id`).
- `src/lib/vistoria-agent.functions.ts` — `createServerFn` auxiliares: `getEstadoVistoria(token|casoId)` para hidratar a UI ao montar; `uploadAnexo(...)`.
- `src/components/agent/AgentChat.tsx` — UI principal (AI Elements).
- `src/components/agent/composer/AttachPhotoButton.tsx`, `RecordVoiceButton.tsx` — composer.
- `src/components/ai-elements/*` — instalados via `bun x ai-elements@latest add conversation message prompt-input tool shimmer`.

**Editados**
- `src/routes/agent.$token.tsx` — passa a renderizar `AgentChat`; remove `validateSearch` de mode e ramos do `FormRunner`/`FormChat`.
- `src/routes/app.vistoria.$casoId.tsx` — idem.
- `src/lib/perguntas-mapeamento.ts` — exportar `achatarFormulario(secoes, perguntasPorSecao)` para uso no system prompt; manter `avaliarCondicional`.
- `src/start.ts` — confirmar `attachSupabaseAuth` em `functionMiddleware` (já existe).

**Deletados**
- `src/components/agent/FormChat.tsx`
- `src/components/agent/FormRunner.tsx`
- `src/components/agent/FormFields.tsx` (após mover `MicButton`/inputs reaproveitáveis para `composer/`)
- `src/components/agent/TypingDots.tsx` (substituído pelo `Shimmer` do AI Elements)

## Segurança e validação

- Server route valida acesso antes de qualquer chamada ao modelo: token via `links_agente` (igual `validarToken` em `agent-ai.functions.ts`) ou sessão autenticada via `requireSupabaseAuth` para `/app/vistoria/...`.
- Toda tool valida que o `pergunta_id` pertence ao formulário do caso atual antes de gravar — impede que LLM grave em outro caso.
- Tipos rejeitados em `salvar_resposta` voltam como tool result `{ ok:false, motivo }` e a IA reformula.
- `LOVABLE_API_KEY` lido **dentro** do handler.

## Custos/latência

- `gemini-3-flash-preview` (barato/rápido) — fácil trocar depois para `openai/gpt-5-mini` ou `gpt-5.4-mini` mudando 1 string.
- Histórico de mensagens **não** persiste — cada vistoria é uma sessão; estado vive em `respostas_agente`.
- Anexos: só `arquivo_path` (curto) entra no contexto; binários ficam no Storage.

## Ordem de execução

1. Instalar AI Elements + verificar `ai`/`@ai-sdk/react`/`@ai-sdk/openai-compatible` no `package.json`.
2. `vistoria-agent.server.ts` (system prompt builder + executores de tool com validação por tipo).
3. `api/vistoria-chat.ts` (stream + auth dupla token/sessão + integração das tools).
4. `vistoria-agent.functions.ts` (`getEstadoVistoria`, `uploadAnexo`).
5. `AgentChat.tsx` + composer (texto, mic, foto).
6. Trocar `agent.$token.tsx` e `app.vistoria.$casoId.tsx` para `AgentChat`.
7. Deletar `FormChat`, `FormRunner`, `FormFields` (preservando o que migrou pro composer), `TypingDots`.
8. QA: criar caso, conversar (texto + foto + voz + batch de CNPJ/endereço), checar `respostas_agente` populadas com os IDs corretos, gerar PDF, validar condicionais.
