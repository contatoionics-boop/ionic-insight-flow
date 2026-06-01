
# Assistente de IA para criação de formulários

Sim, é totalmente possível. A IA do Lovable (Gemini multimodal) aceita texto + imagens e a AI SDK consegue devolver JSON estruturado, então dá pra montar um chat que conversa com o usuário, lê PDFs/fotos de formulários antigos e gera o rascunho completo (seções, perguntas, tipos, opções) — depois o usuário revisa e salva no banco usando as tabelas que já existem (`formularios`, `secoes`, `perguntas`, `opcoes_pergunta`).

## Como vai funcionar (fluxo)

1. Em **Configurações → Assistente de formulário** o usuário abre um chat.
2. Ele descreve a vistoria ("vistoria de imóvel para locação, com 4 etapas: fachada, sala, cozinha, quartos…") e/ou anexa imagens/PDFs de formulários antigos.
3. O assistente faz perguntas curtas pra refinar (tipo de cliente, obrigatoriedade, se precisa foto, etc.).
4. Quando tiver contexto suficiente, gera um **rascunho estruturado** mostrado em painel ao lado do chat: seções → perguntas → tipo (`texto`, `foto`, `selecao_unica`, etc.) → opções → instruções de IA.
5. Usuário pode pedir ajustes em linguagem natural ("adiciona uma seção de quintal", "transforma a pergunta 3 em foto") ou editar inline.
6. Botão **"Criar formulário"** persiste tudo em uma transação e abre o builder existente (`/app/forms/$id`) já populado.

## Escopo técnico

### Backend (TanStack server functions + AI SDK + Lovable AI)
- `src/lib/ai-gateway.server.ts` — provider helper Lovable AI (se ainda não existir).
- `src/routes/api/forms-assistant.ts` — rota streaming (`useChat` transport) usando `google/gemini-3-flash-preview` (texto+imagem). System prompt explica o esquema do formulário e os tipos de pergunta permitidos.
- Ferramenta (AI SDK `tool`) `propose_form` com `inputSchema` Zod espelhando a estrutura:
  ```
  { nome, descricao, cliente_id?, secoes: [{ titulo, ordem, perguntas: [
      { texto, tipo, obrigatoria, ordem, contexto_ia?, opcoes?: [{ texto, ordem }] }
  ]}]}
  ```
  Quando chamada, devolve o rascunho pro cliente renderizar (sem persistir ainda).
- `createFormFromDraft` (`createServerFn`, admin only) — valida com Zod, insere `formulario` + `secoes` + `perguntas` + `opcoes_pergunta` em ordem, devolve o `id`.
- Uploads de imagens: anexos viram `parts` multimodais no `UIMessage` (base64 ou via bucket temporário `agente-uploads`). PDFs: extrair texto no servidor antes de mandar ao modelo (parser leve) ou usar Gemini que aceita PDF direto.

### Frontend
- Nova rota `src/routes/app.settings.form-assistant.tsx` (link no menu lateral de admin em Configurações).
- Layout split: **chat à esquerda** (AI Elements: `Conversation`, `Message`, `PromptInput`, `Tool`) e **preview do rascunho à direita** (lista de seções/perguntas estilo accordion, com botões de editar/remover inline).
- Campo de anexo no `PromptInput` aceitando imagens e PDF.
- Botão final "Criar formulário" só habilita quando há um rascunho válido; chama `createFormFromDraft` e navega para `/app/forms/{id}`.

### Banco
- Nenhuma mudança de schema. Reaproveita 100% das tabelas existentes.
- Opcional: tabela `form_assistant_threads` (admin, RLS por `criado_por`) se quisermos guardar histórico de conversas — fora do MVP.

### Segurança
- Rota e server function exigem `requireSupabaseAuth` + checagem de role `admin`/`super_admin`.
- `LOVABLE_API_KEY` só no servidor.

## Entregáveis em ordem

1. Provider Lovable AI + rota `/api/forms-assistant` com streaming e tool `propose_form`.
2. Server function `createFormFromDraft` com validação Zod e inserção transacional.
3. Página `app.settings.form-assistant.tsx` com chat (AI Elements) + painel de rascunho editável + upload de imagem/PDF.
4. Link no menu de Configurações (visível só pra admin/super_admin).
5. QA: criar formulário só por texto, só por imagem, e misto; abrir no builder e confirmar que tudo bate.

## Limitações conhecidas

- PDFs muito longos podem estourar contexto — limitar a ~10 páginas/5 MB por anexo.
- O rascunho é **sugestão**: o usuário sempre revisa antes de salvar (evita lixo no banco).
- Sem histórico de conversa persistido no MVP (recomeça a cada visita).

Confirma que posso seguir assim?
