# Base de Conhecimento (RAG) para o agente

Vou criar uma nova seção em Configurações chamada **Base de Conhecimento** onde você importa documentos (PDF, DOCX, TXT) que são processados, divididos em pedaços (chunks), convertidos em embeddings e usados automaticamente como contexto pela IA do sistema.

## 1. Banco de dados (migration)

- Habilitar extensão `vector` (pgvector) no Postgres.
- Tabela `base_conhecimento`:
  - `nome`, `categoria`, `arquivo_url`, `arquivo_path`, `tipo` (pdf/docx/txt), `tamanho_bytes`, `status` (aguardando | processando | pronto | erro), `erro_mensagem`, `criado_por`, `criado_em`, `atualizado_em`.
- Tabela `base_conhecimento_chunks`:
  - `documento_id` (FK → base_conhecimento, cascade delete), `conteudo` text, `embedding vector(1536)` (usando `openai/text-embedding-3-small` via Lovable AI Gateway — 1536 dims cabe em índice ivfflat; gemini-embedding-001 daria 3072 dims que **não** cabe no ivfflat), `posicao` int, `tokens` int.
- Índice ivfflat em `embedding` com `vector_cosine_ops` (lists=100).
- Bucket de storage `base-conhecimento` (privado).
- RLS: somente `super_admin` gerencia documentos; `service_role` faz tudo (server fns).
- GRANTs em ambas as tabelas.
- Função SQL `buscar_conhecimento(query_embedding vector(1536), match_count int, similarity_threshold float)` retornando os chunks ordenados por similaridade coseno, com `1 - (embedding <=> query)` como score.

## 2. Server functions (TanStack)

`src/lib/base-conhecimento.functions.ts`:
- `listarDocumentos()` — lista tudo, ordenado por data desc.
- `criarDocumento({ nome, categoria, arquivo_path, tipo, tamanho_bytes })` — cria registro `processando` e dispara processamento em background (await dentro do handler, retornando assim que terminar — sem fila externa pra manter simples).
- `processarDocumento(id)`:
  - Baixa arquivo do Storage via admin client.
  - Extrai texto:
    - **TXT**: decode UTF-8 direto.
    - **DOCX**: `mammoth.extractRawText({ buffer })`.
    - **PDF**: `pdf-parse` (Node-compat, funciona em workerd). Se falhar, marca erro.
  - Chunking: ~500 tokens (≈2000 chars) com overlap 50 tokens (≈200 chars).
  - Para cada chunk, chama o endpoint `https://ai.gateway.lovable.dev/v1/embeddings` com `openai/text-embedding-3-small` em batches de 32.
  - Insere chunks no banco.
  - Atualiza status para `pronto` (ou `erro` com mensagem).
- `excluirDocumento(id)` — apaga storage + cascade nos chunks.
- `buscarContextoRelevante(texto, topK=5, threshold=0.5)` — gera embedding da query e chama `buscar_conhecimento`. Usada internamente pelos agentes.

## 3. UI

- Novo item no `ConfiguracoesNav`: **"Base de conhecimento"** com ícone `BookOpen` (lucide), rota `/app/base-conhecimento`.
- Nova rota `src/routes/app.base-conhecimento.tsx`:
  - Tabela: Nome, Categoria, Tipo, Tamanho, Data, Status (badge colorido), ações (excluir).
  - Botão **"Importar documento"** abre modal com:
    - Campo nome (autopreenchido com nome do arquivo, editável)
    - Campo categoria (input livre + sugestões das categorias já usadas)
    - Drop/upload de arquivo (PDF, DOCX, TXT) — limite 10MB
  - Polling leve (revalidate a cada 3s) enquanto houver documento em `processando`.
  - Restrito a `super_admin`.

## 4. Integração com o agente

No `src/lib/vistoria-agent.server.ts` (e qualquer outro caminho que monte system prompt do agente principal), antes de chamar `generateText`:
- Chamar `buscarContextoRelevante(últimaMensagemUsuário)`.
- Se houver chunks com similaridade ≥ 0.5, anexar ao system prompt:
  ```
  Use as seguintes informações da base de conhecimento para embasar sua resposta:
  ---
  {chunks}
  ---
  ```
- Se vazio, agente responde normalmente sem mudar comportamento.

## 5. Detalhes técnicos relevantes

- **Embedding model**: `openai/text-embedding-3-small` (1536 dims) via Lovable AI Gateway. Justificativa: gemini-embedding-001 retorna 3072 dims, acima do limite de 2000 do ivfflat. Para usar Gemini precisaríamos HNSW (mais custoso) ou passar `dimensions: 1536`.
- **PDF parsing**: usar `pdf-parse` (puro JS, funciona no Worker). Mammoth também é puro JS.
- **NÃO uso edge function Supabase** — uso TanStack server function conforme stack do projeto.
- Mantém paleta atual; nenhum CSS var alterado.

## 6. Arquivos a criar/editar

Criar:
- migration SQL (pgvector, tabelas, função, índices, storage bucket, RLS, grants)
- `src/lib/base-conhecimento.functions.ts`
- `src/lib/base-conhecimento.server.ts` (helpers de extração de texto)
- `src/routes/app.base-conhecimento.tsx`

Editar:
- `src/components/ConfiguracoesNav.tsx` (novo item)
- `src/lib/vistoria-agent.server.ts` (injetar contexto RAG)
- `package.json` (adicionar `mammoth`, `pdf-parse`)

Posso seguir?
