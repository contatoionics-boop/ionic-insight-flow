## Decisões confirmadas
1. **Enum**: adicionar `data`, `selecao_unica`, `toggle` via migration.
2. **IA**: Lovable AI Gateway (Gemini) com `LOVABLE_API_KEY` já configurado.
3. **Revisão**: último "passo" do stepper em `/agent/$token`, não rota separada.
4. **`contexto_ia` da pergunta** alimenta o prompt do Gemini diretamente (sem hardcode).

## Implementação

### 1. Migration (SQL)
- `ALTER TYPE pergunta_tipo ADD VALUE IF NOT EXISTS 'data';`
- `ALTER TYPE pergunta_tipo ADD VALUE IF NOT EXISTS 'selecao_unica';`
- `ALTER TYPE pergunta_tipo ADD VALUE IF NOT EXISTS 'toggle';`
- (As opções de `selecao_unica` já têm tabela `opcoes_pergunta`.)

### 2. Helper Lovable AI Gateway
- `src/lib/ai-gateway.server.ts` — `createLovableAiGatewayProvider` (padrão do stack).
- Dependências: `bun add ai @ai-sdk/openai-compatible`.

### 3. Server functions (sem `requireSupabaseAuth`; validam token público)
- `src/lib/agent-ai.functions.ts`:
  - `validarFoto({ token, perguntaId, imagemBase64, mime })`
    - Valida `links_agente.token` (não expirado).
    - Lê `perguntas.contexto_ia` correspondente.
    - Chama Gemini multimodal (`google/gemini-3-flash-preview`) com `Output.object` e schema Zod: `{ status: "aprovada" | "parcial" | "incorreta", descricao_encontrada, problemas[], orientacao }`.
    - Retorna o JSON. (Não persiste — persistência ocorre no envio final.)
  - `transcreverAudio({ token, audioBase64, mime })`
    - Valida token.
    - Chama Gemini com `inlineData` áudio + prompt PT-BR.
    - Retorna `{ transcricao }`.
- Erros: tratar 429/402 e retornar mensagens claras.

### 4. Atualizar tipos no front
- `TipoPergunta` em `agent.$token.tsx`: `"texto" | "numero" | "foto" | "audio" | "checkbox" | "data" | "selecao_unica" | "toggle"`.
- Atualizar `app.forms.tsx` para exibir os 3 novos tipos no select de tipo de pergunta (e mostrar editor de opções quando `selecao_unica`).

### 5. Reescrita do `agent.$token.tsx` em **stepper por seção**
Mudança chave: hoje o stepper avança pergunta a pergunta — passar a avançar **seção a seção**, renderizando todas as perguntas da seção atual numa lista.

Componentes de campo:
- `CampoTexto` (textarea)
- `CampoNumero` (`<input type="number">`)
- `CampoData` (`<input type="date">`)
- `CampoSelecaoUnica` — radio cards lendo `opcoes_pergunta`
- `CampoToggle` — switch Sim/Não (grava `"sim"`/`"nao"` em `valor_texto`)
- `CampoCheckbox` (mantido)
- `CampoAudio` (`audio_ou_texto`) — refatorado:
  - Modo gravar: MediaRecorder + cronômetro pulsante + player + "Regravar".
  - Modo "Prefiro digitar": textarea.
  - Após upload, chama `transcreverAudio` automaticamente e preenche o textarea de transcrição (editável + confirmação).
- `CampoFoto` (`upload_imagem`) — refatorado:
  - 1 arquivo por campo (substitui o anterior em vez de adicionar).
  - Preview + spinner "Analisando imagem com IA…".
  - Chama `validarFoto` passando `perguntaId` (que já carrega `contexto_ia`).
  - Badge ✅ verde / ⚠️ amarelo / ❌ vermelho + `orientacao`.
  - ❌ bloqueia avanço da seção; ⚠️ exige confirmação ("Avançar mesmo assim").
  - "Reenviar foto" sempre disponível.

Fluxo do stepper:
- Carrega `secoes` ordenadas + perguntas agrupadas.
- Estado: `current` agora = índice da seção.
- Header mostra "Seção X de N" + barra de progresso + título da seção.
- Botão "Próxima seção" só habilita se todos campos obrigatórios da seção estão completos e não há foto ❌ não confirmada.
- Auto-save: ao concluir uma seção, faz **upsert** em `respostas_agente` para aquelas perguntas (chave: `caso_id` + `pergunta_id` — criar índice único se não existir; ver migration).
- Recarregar o link → estado de rascunho é hidratado do banco.

Passo final = **Revisão**:
- Listagem por seção: texto, foto (thumb + badge IA), áudio (player + transcrição editável).
- Botões "Editar seção X" voltam ao passo correspondente.
- Botão "Confirmar e enviar ao especialista":
  - Marca `links_agente.utilizado_em`.
  - Atualiza `casos.status = 'aguardando_revisao'`.
  - Grava `ia_aprovado`/`ia_motivo` das fotos com base no último resultado IA.

### 6. Auto-save (ajuste de schema)
Adicionar à migration:
- Índice único `UNIQUE (caso_id, pergunta_id)` em `respostas_agente` para suportar `upsert`. (Validar antes que não há duplicatas existentes — projeto novo, tabela vazia.)

### 7. UX mobile
- Botões 48px+, `capture="environment"` em fotos.
- Stepper sticky no topo com progresso e seção atual.
- Footer fixo com "Voltar" / "Próxima seção" / "Enviar".

### 8. Não tocar
- `AppLayout`, dashboard, usuários, clientes, autenticação, lógica de cadastro de formulário (apenas adicionar tipos novos ao select).

## Arquivos a criar/editar
**Criar:**
- `supabase/migrations/<ts>_extend_pergunta_tipo.sql`
- `src/lib/ai-gateway.server.ts`
- `src/lib/agent-ai.functions.ts`
- `src/start.ts` — garantir `attachSupabaseAuth` permanece (sem mudanças se já existe). *Não necessário se as funções de IA não usam `requireSupabaseAuth`* — confirmarei na implementação.

**Editar:**
- `src/routes/agent.$token.tsx` — reescrita do stepper + campos novos + IA + revisão.
- `src/routes/app.forms.tsx` — incluir os 3 novos tipos no editor.
- `package.json` (via `bun add`) — `ai`, `@ai-sdk/openai-compatible`.

Pronto para implementar — basta aprovar.