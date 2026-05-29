## Três entregas: Preview, Configurações da empresa, Rebranding "Ionics"

### Rotas
Mantendo padrão atual `/app/...`: **`/app/forms/$id/preview`** e **`/app/configuracoes`**.

---

### 1. Preview do formulário

Extrair o renderizador de `src/routes/agent.$token.tsx` (935 linhas, hoje inline) para componente compartilhado:

- **`src/components/agent/FormRenderer.tsx`** — props: `secoes`, `perguntas`, `opcoes`, `mode: "live" | "preview"`, callbacks `onAnswerSubmit`, `onFileUpload`.
  - Em `preview`: renderiza todos os tipos (texto, número, data, seleção única, toggle, foto, áudio) idênticos ao live, mas:
    - Foto: mostra dropzone + `contexto_ia` como instrução; upload é noop (sem Storage, sem IA).
    - Áudio: mostra gravador; ao parar, sem transcrição.
    - Texto/data/seleção/toggle: estado local apenas.
  - Stepper de seções e botões Próxima/Anterior funcionam em ambos os modos.

- `agent.$token.tsx` passa a consumir `<FormRenderer mode="live" />` injetando os handlers atuais. Refactor sem mudar comportamento.

- **Nova rota** `src/routes/app.forms.$id.preview.tsx`:
  - Carrega formulário/seções/perguntas/opções (mesmas queries do builder).
  - Header: logo + nome da empresa (lido das configurações; fallback "Ionics"), título do formulário, badge **"PREVIEW — nenhum dado será salvo"**.
  - Botão "Fechar preview" volta para `/app/forms/$id`.
  - Renderiza `<FormRenderer mode="preview" />`.

- **Builder** (`app.forms.$id.tsx`): botão **"👁 Visualizar formulário"** no header, ao lado de "Editar info", navega para `/app/forms/$id/preview`.

---

### 2. Configurações da empresa

**Migration** (precisa aprovação antes do código):

- Tabela `public.configuracoes_empresa` (singleton — id fixo via default):
  - `nome_empresa text`, `logo_url text`, `cnpj text`, `telefone text`, `email_contato text`, `endereco text`, `cidade_estado text`, `site text`, `texto_rodape text`, `atualizado_em timestamptz default now()`.
  - Constraint de unicidade garantindo 1 linha (`id uuid primary key default '...'` fixo).
  - GRANTs: `SELECT` para `anon` e `authenticated`; `INSERT/UPDATE` para `authenticated`.
  - RLS: SELECT liberado a todos; INSERT/UPDATE restritos a `super_admin` via `has_role`.
- Bucket Storage `empresa-logos` público. Policies: leitura pública; INSERT/UPDATE/DELETE só `super_admin`.

**Rota** `src/routes/app.configuracoes.tsx`:
- Form com os 9 campos; upload de logo via `supabase.storage.from('empresa-logos').upload(...)` → grava URL pública em `logo_url`.
- Botão "Salvar" faz upsert na linha singleton.
- Acesso só `super_admin` (consistente com outras telas).

**AppLayout**: item "Configurações" (`Settings` icon) como **último** item da sidebar → `/app/configuracoes`.

**Hook** `src/hooks/use-configuracoes-empresa.ts` — lê a linha singleton; usado pelo preview, pelo `/agent/$token` e pronto para o gerador de laudo futuro (que ainda não existe — não vou inventar).

---

### 3. Rebranding "Ionics" (exato, capitalização como o usuário escreveu)

| Arquivo | Mudança |
|---|---|
| `src/components/AppLayout.tsx` L88 | `IONIX` → `Ionics` |
| `src/components/AppLayout.tsx` L118 | `IONICS Pós-Vistoria · v0.1` → `Ionics · v0.1` |
| `src/components/AppLayout.tsx` L129-130 | `<h1>Pós-Vistoria</h1>` + `<p>Plataforma interna IONICS</p>` → `nome_empresa` das configs (fallback "Ionics"); remove o subtítulo |
| `src/routes/index.tsx` L65, L84 | `IONIX` → `Ionics` |
| `src/routes/index.tsx` L68 | `Mapeamento técnico pós-vistoria com IA.` → `Ionics` |
| `src/routes/index.tsx` L71 | parágrafo "Plataforma interna IONICS..." → `Ionics` |
| `src/routes/index.tsx` L75 | `© 2026 IONICS · Pioneirismo consagrado` → `© 2026 Ionics` |
| `src/routes/reset-password.tsx` L57 | `IONIX` → `Ionics` |
| `src/routes/app.dashboard.tsx` L49 | `description="Visão geral da operação de pós-vistoria."` → remover |
| `src/lib/mock-data.ts` | `IONICS` → `Ionics` em prompts/legendas (emails `@ionics.com.br` ficam) |

---

### Arquivos

**Criar**
- `src/components/agent/FormRenderer.tsx`
- `src/routes/app.forms.$id.preview.tsx`
- `src/routes/app.configuracoes.tsx`
- `src/hooks/use-configuracoes-empresa.ts`
- Migration: tabela + bucket + RLS/GRANTs.

**Editar**
- `src/routes/agent.$token.tsx` — refactor para usar `FormRenderer`.
- `src/routes/app.forms.$id.tsx` — botão preview.
- `src/components/AppLayout.tsx` — item de menu + textos.
- `src/routes/index.tsx`, `src/routes/reset-password.tsx`, `src/routes/app.dashboard.tsx`, `src/lib/mock-data.ts` — rebranding.

**Não tocar**: auth/RLS de outras tabelas, builder, seed BB0001, outras rotas.

### Ordem de execução
1. Migration (tabela + bucket) — aguarda aprovação.
2. Refactor do agent + criação do FormRenderer.
3. Rota de preview + botão no builder.
4. Página de Configurações + item de menu.
5. Rebranding em massa.