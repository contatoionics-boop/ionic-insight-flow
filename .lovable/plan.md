# Geração dinâmica de PDF do mapeamento

Gerar um PDF estilo "FR-29-10" a partir das respostas do agente, funcionando para qualquer formulário cadastrado. O layout é fixo (cabeçalho/rodapé Ionics) e o conteúdo é montado dinamicamente percorrendo seções e perguntas do formulário usado naquele caso.

## 1. Schema — metadados do formulário

Migration adicionando colunas à tabela `formularios`:

- `codigo text` — ex.: "FR-29-10"
- `revisao text` — ex.: "00"
- `data_revisao date`
- `elaborado_por text`
- `aprovado_por text`

Todos opcionais. UI de edição entra na tela de edição do formulário (`app.forms.$id.index.tsx`) como um bloco "Metadados do documento".

## 2. Renderização automática por tipo

O gerador percorre `secoes` ordenadas. Para cada seção, agrupa as perguntas em blocos consecutivos por tipo:

- **Bloco de campos** (perguntas `texto`, `toggle`, `cnpj`, `cep`, `data`, `numero`, `select`): renderiza como tabela 2 colunas (rótulo azul-marinho à esquerda, valor à direita). Toggle vira "☑ Sim ☐ Não". Perguntas sem resposta saem em branco.
- **Bloco de fotos** (perguntas `foto`): renderiza como grid 2 colunas. Cada célula tem o `instrucao_agente` (ou `texto` se vazio) como legenda + a foto baixada do Storage. Quando IA marcou "aprovada/parcial/incorreta", aparece um selo discreto no canto.
- **Bloco de áudio** (`audio`): título + transcrição em itálico (player não faz sentido em PDF).

Isso resolve "diferentes formulários" sem configuração — qualquer combinação de tipos é renderizada.

## 3. Geração — onde roda

Server function `gerarPdfMapeamento({ casoId })` em `src/lib/casos-pdf.functions.ts` protegida por `requireSupabaseAuth`:

1. Carrega caso + empresa/matriz/unidade + formulário (com metadados) + seções + perguntas + opções + respostas_agente.
2. Baixa as fotos do bucket privado `agente-uploads` via `supabaseAdmin.storage.from(...).createSignedUrl(...)` e busca os bytes (fetch).
3. Monta o PDF com **pdf-lib** (puro JS, roda no Worker). Fontes: Helvetica/Helvetica-Bold embutidas (sem dep de fonte externa). Logo: usa `configuracoes_empresa.logo_url` (download + embed PNG/JPEG); se ausente, escreve o nome da empresa em texto.
4. Retorna `{ filename, contentBase64, mimeType: "application/pdf" }`.

Por que pdf-lib: TanStack Start roda em Cloudflare Worker. `puppeteer`, `playwright`, `chrome-aws-lambda`, `sharp` e libs que requerem Chromium ou binários nativos **não funcionam**. pdf-lib é fetch/ESM e roda nativamente.

## 4. UI — botão de download

Em `src/routes/app.review.$id.tsx`, no header da tela de revisão, botão "Baixar PDF" ao lado dos botões existentes. Ao clicar:

- Chama `gerarPdfMapeamento` via `useServerFn`.
- Converte base64 → Blob → `URL.createObjectURL` → `<a download={filename}>` clicado programaticamente.
- Toast de erro se falhar.

Filename padrão: `mapeamento-{caso.codigo}-{empresa.nome}.pdf` (slug).

## 5. Layout do PDF

Mesma estrutura do FR-29-10 mas com identidade Ionics:

```text
┌─────────────────────────────────────────────────┐
│ [Logo]   MAPEAMENTO TÉCNICO              [Code] │  cabeçalho
│          {formulario.nome}                       │  (repetido toda página)
├─────────────────────────────────────────────────┤
│ Cliente/Unidade │ Empresa │ Data │ dd/mm/aaaa   │  bloco identificação
│ Responsável     │ Nome    │ Contato │ email     │  (primeira página)
├─────────────────────────────────────────────────┤
│ 1 - {Seção 1.titulo}                            │  barra azul
│  ┌──────────────────┬──────────────────────┐   │
│  │ Rótulo pergunta  │ Resposta             │   │  bloco de campos
│  └──────────────────┴──────────────────────┘   │
│                                                  │
│ 1.1 - Registro fotográfico                      │  barra azul (subseção)
│  ┌────────────────┬────────────────┐            │
│  │ instrução      │ instrução      │            │  grid de fotos
│  │ [foto]         │ [foto]         │            │  2 col
│  └────────────────┴────────────────┘            │
├─────────────────────────────────────────────────┤
│ Elaborado por: X │ Aprovado por: Y │ Rev: 00 │  rodapé
│ Data revisão: ... │  Página N de M               │  (toda página)
└─────────────────────────────────────────────────┘
```

Quebra de página automática: ao acumular conteúdo que ultrapassa a altura útil, abre nova página com cabeçalho/rodapé idênticos. Fotos são redimensionadas para caber na célula mantendo aspect ratio. Cores: `--primary` Ionics (azul) para cabeçalhos de tabela.

## 6. Dependência nova

`bun add pdf-lib` (~280kb, sem nativos, compatível com Worker).

## Arquivos

**Migration:**
- `ALTER TABLE formularios ADD COLUMN codigo/revisao/data_revisao/elaborado_por/aprovado_por`

**Novos:**
- `src/lib/casos-pdf.functions.ts` — server fn `gerarPdfMapeamento`
- `src/lib/pdf-mapeamento.server.ts` — montagem do PDF (renderHeader/renderFooter/renderCamposTable/renderFotosGrid/renderSecao)

**Editados:**
- `src/routes/app.forms.$id.index.tsx` — bloco "Metadados do documento" no editor de formulário
- `src/routes/app.review.$id.tsx` — botão "Baixar PDF" + handler de download

## Fora do escopo (sugestões futuras)

- Salvar o PDF no Storage automaticamente ao finalizar
- Botão de download também na ficha do caso (`app.vistorias.$id`)
- Capa customizada / sumário automático
- Assinatura digital
