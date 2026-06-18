
# Plano — Base de Conhecimento estruturada (`knowledge_base`)

Vamos manter `base_conhecimento` para documentos (PDF/DOCX/TXT) e criar uma nova tabela `knowledge_base` para registros estruturados, com importação por JSON/CSV/Excel, embeddings por registro e filtros por categoria, tags e classificação.

## 1. Banco — migration

**Enums novos**

```sql
create type public.knowledge_classificacao as enum ('OK','ATENCAO','BLOQUEIO');
create type public.knowledge_categoria as enum (
  'estrutura_documento','catalogo_produtos','catalogo_materiais',
  'regras_tecnicas','exemplos_laudos','textos_padrao','glossario_tecnico'
);
```

**Tabela `public.knowledge_base`**

- `id` uuid PK
- `categoria` `knowledge_categoria` not null
- `titulo` text not null
- `conteudo` text not null  ← gera embedding
- `tags` text[] not null default '{}'
- `classificacao` `knowledge_classificacao` not null default 'OK'
- `fonte` text
- `importacao_id` uuid (FK → importações; agrupa o que veio de cada arquivo)
- `embedding` vector(1536)
- `criado_por` uuid
- `created_at`, `updated_at` timestamptz

**Tabela `public.knowledge_base_importacoes`**

- `id`, `nome_arquivo`, `tipo` (json/csv/xlsx), `total_registros`, `total_inseridos`, `status` (processando/pronto/erro), `erro_mensagem`, `criado_por`, `created_at`.

**Índices**: HNSW em `embedding` (cosine), GIN em `tags`, btree em `categoria` e `classificacao`.

**RLS + GRANTs**: só `super_admin` (mesmo padrão atual), `GRANT` para `authenticated` e `service_role`. Trigger `set_atualizado_em` adaptado para `updated_at`.

**RPC `buscar_knowledge_base`**

```
buscar_knowledge_base(
  query_embedding vector,
  match_count int default 5,
  similarity_threshold float default 0.5,
  p_categoria knowledge_categoria default null,
  p_tags text[] default null,
  p_classificacao knowledge_classificacao default null
)
```
Retorna `id, titulo, conteudo, categoria, tags, classificacao, fonte, similarity`. Filtros opcionais; `tags` usa overlap `&&`.

## 2. Server — `src/lib/knowledge-base.functions.ts`

Todas com `requireSupabaseAuth` + checagem `super_admin`.

- `listarRegistros({ busca?, categoria?, tags?, classificacao?, page, pageSize })` — paginado, ordena por `updated_at desc`.
- `criarRegistro` / `atualizarRegistro` / `excluirRegistro` — CRUD manual; ao salvar `conteudo`, gera embedding (modelo `openai/text-embedding-3-small`, 1536 dims, mesmo já usado em `base-conhecimento.server.ts`).
- `listarImportacoes` / `excluirImportacao(id)` — exclusão remove todos os registros associados.
- `baixarTemplate(tipo: 'csv'|'json')` — devolve string com exemplo dos campos e valores válidos dos enums.
- `importarRegistros({ arquivo_path, tipo })`:
  1. Cria `knowledge_base_importacoes` em `processando`.
  2. Baixa do bucket `agente-uploads` (limite 5 MB — rejeita antes do parse).
  3. Parse conforme `tipo`:
     - JSON: array de objetos.
     - CSV: `papaparse` com header.
     - XLSX: `xlsx` (SheetJS) → primeira aba → JSON.
  4. Limite 5.000 linhas — acima disso retorna erro amigável: "Divida em arquivos menores".
  5. Valida cada linha com Zod:
     - `titulo`, `conteudo`, `categoria` obrigatórios.
     - `categoria` deve ser um dos 7 valores; `classificacao` opcional (default `OK`), deve ser `OK|ATENCAO|BLOQUEIO` (aceita `ATENÇÃO` → normaliza para `ATENCAO`).
     - `tags` aceita array ou string `"a,b,c"`.
     - `fonte` opcional.
  6. Linhas inválidas vão para um array `erros[]` com `{ linha, motivo }` (não derruba o import inteiro).
  7. Gera embeddings em lotes de 32 a partir de `titulo + "\n\n" + conteudo` (reaproveita `gerarEmbeddings`).
  8. Insere em lotes de 100 com `importacao_id`.
  9. Atualiza importação para `pronto` com `total_registros` e `total_inseridos`, ou `erro` com mensagem; devolve `{ inseridos, ignorados, erros }` para a UI mostrar.

Sem rota nova para upload — usa o mesmo bucket `agente-uploads` via cliente Supabase no browser (igual ao fluxo atual de documentos), depois chama a server fn.

## 3. Integração com a IA

Em `buscarContextoRelevante` (`src/lib/base-conhecimento.functions.ts`):

- Continua buscando em `base_conhecimento_chunks`.
- Busca também em `knowledge_base` via novo RPC (sem filtros por padrão).
- Mescla por `similarity` desc, devolvendo `topK` no total.
- Para registros estruturados, formata o `conteudo` com header de metadados, ex.:
  ```
  [knowledge_base | catalogo_produtos | classificacao=ATENCAO | tags=a,b]
  Título: ...
  ...
  ```
  Assinatura pública da função não muda — só melhora o contexto entregue ao agente.

## 4. UI — `src/routes/app.base-conhecimento.tsx`

Abas no topo (mantém visual atual):

- **Documentos** — tela existente, sem mudanças.
- **Registros** (novo):
  - Botões: `Importar arquivo`, `Novo registro`, `Baixar modelo` (CSV/JSON).
  - Filtros: busca por título/conteúdo, select de categoria (7 opções com labels amigáveis), multi-select de tags, select de classificação (OK / ATENÇÃO / BLOQUEIO).
  - Tabela paginada: Título, Categoria (label PT-BR), Tags (chips, máx 3 visíveis), Classificação (badge colorido: OK verde, ATENÇÃO amarelo, BLOQUEIO vermelho), Fonte, Atualizado em, ações (editar / excluir).
  - **Modal Importar**: input de arquivo (.json/.csv/.xlsx, até 5 MB), preview das 5 primeiras linhas detectadas + colunas reconhecidas, aviso se faltar `titulo`/`conteudo`/`categoria`; botão Confirmar; mostra progresso e, ao final, resumo `{ inseridos, ignorados, primeiros erros }`. Mensagens de erro amigáveis (tamanho, formato, limite de linhas).
  - **Modal Novo/Editar**: titulo, categoria (select), tags (input com chips), classificacao (select com labels), fonte, conteudo (textarea grande).
- **Importações** (sub-aba): histórico com status, total de registros, mensagem de erro e botão "Remover importação" (apaga registros associados após confirmação).

Polling igual ao atual enquanto houver importação `processando`.

Labels PT-BR para enums ficam num helper compartilhado (`src/lib/knowledge-base.ts`) — UI exibe "ATENÇÃO" mesmo com `ATENCAO` no banco.

## 5. Dependências novas

- `xlsx` (SheetJS) — parse de Excel.
- `papaparse` (+ `@types/papaparse`) — CSV.

Ambos rodam no Worker (puro JS).

## 6. Entregáveis

- 1 migration: enums, 2 tabelas, índices, RLS, GRANTs, trigger `updated_at`, RPC `buscar_knowledge_base`.
- `src/lib/knowledge-base.functions.ts` + `src/lib/knowledge-base.ts` (labels/enums client-safe).
- Ajuste em `src/lib/base-conhecimento.functions.ts` → `buscarContextoRelevante` mescla as duas fontes.
- Refator de `src/routes/app.base-conhecimento.tsx` em componentes:
  `DocumentosTab` (atual), `RegistrosTab`, `ImportacoesTab`, `ImportarRegistrosModal`, `RegistroFormModal`.
- Templates de exemplo (CSV e JSON) gerados pela server fn `baixarTemplate`.
