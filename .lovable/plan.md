## Builder de formulário — tela dedicada

Hoje `app.forms.tsx` mistura listagem + edição inline de seções/perguntas via modais. Vou separar em duas telas e enriquecer o editor.

### 1. Nova rota dedicada
- Arquivo: `src/routes/app.forms.$id.tsx` (URL `/app/forms/$id`).
- Layout em 2 colunas (md+): esquerda = estrutura, direita = painel de propriedades. No mobile, painel vira sheet/drawer ao selecionar um campo.
- Header da tela: nome do formulário, cliente, botão **"Editar info"** (abre o modal atual de Nome/Descrição/Cliente) e botão **"Voltar"**.

### 2. Listagem (`app.forms.tsx`) — simplificar
- Remover a visualização inline de seções/perguntas (todo bloco "if (selected)").
- Botão "Editar" no card passa a navegar para `/app/forms/$id` em vez de abrir modal.
- Manter modal de criar formulário e modal de excluir.
- Manter o modal "Editar info" reaproveitado pela tela dedicada (export do componente ou duplicar mínimo).

### 3. Estrutura (coluna esquerda)
- Lista de **seções** em ordem (campo `ordem`), cada uma com:
  - Handle de drag, título editável inline, botão excluir.
  - Lista de **perguntas** dentro, cada uma com handle, label, badge do tipo, botão excluir.
  - Clicar numa pergunta → seleciona e abre painel à direita.
  - Botão **"+ Adicionar campo"** ao final da seção (cria pergunta tipo `texto` placeholder e já seleciona).
- Botão **"+ Adicionar seção"** ao final da lista.
- Drag-and-drop com `@dnd-kit/core` + `@dnd-kit/sortable` (instalar via `bun add`):
  - Reordenar seções entre si.
  - Reordenar perguntas dentro da mesma seção. (Mover entre seções fica fora de escopo desta iteração.)
  - Persistência: ao soltar, atualizar `ordem` em batch (`update` por id) na tabela correspondente.

### 4. Painel de propriedades (coluna direita)
Aparece quando há pergunta selecionada. Campos:
- **Título / Label** — input texto (`perguntas.texto`).
- **Tipo** — select com: `texto`, `numero`, `data`, `selecao_unica`, `toggle`, `audio`, `foto` (enum já estendido).
- **Obrigatório** — Switch (`perguntas.obrigatoria`).
- **Contexto IA** — Textarea, visível só se tipo ∈ {`foto`, `audio`} (`perguntas.contexto_ia`).
  - Para `foto`: "o que deve aparecer na imagem".
  - Para `audio`: "o que o vistoriador deve descrever".
- **Opções** — visível só se tipo = `selecao_unica`. Lista editável (input por linha + botão remover + botão "+ adicionar opção"). Persiste em `opcoes_pergunta` (insert/update/delete diff + `ordem`).
- Botão **"Salvar campo"** — faz update na pergunta e sincroniza opções. Toast de confirmação.
- Botão **"Excluir campo"** — confirma e remove (com cascata de opções).

Estado: o painel mantém um "draft" local; mudar de campo sem salvar mostra confirmação ("Descartar alterações?").

### 5. Persistência (sem schema novo)
Usa tabelas existentes: `secoes`, `perguntas`, `opcoes_pergunta`. Nenhuma migration necessária.

Operações:
- Criar seção: insert com `ordem = max+1`.
- Criar pergunta: insert tipo `texto`, obrigatória `true`, `ordem = max+1` dentro da seção.
- Reordenar: array de `{ id, ordem }` → `update` em batch.
- Salvar campo: `update perguntas`; para opções fazer diff (insert novas, update existentes, delete removidas).
- Excluir: deletar opções → deletar pergunta/seção (já é o padrão atual).

### 6. Dependências novas
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (via `bun add`).

### 7. Arquivos
**Criar:**
- `src/routes/app.forms.$id.tsx` — tela builder completa.
- `src/components/forms/SortableSection.tsx`
- `src/components/forms/SortableQuestion.tsx`
- `src/components/forms/FieldPropertiesPanel.tsx`

**Editar:**
- `src/routes/app.forms.tsx` — remover modo "selected" inline, fazer card "Editar" navegar para `/app/forms/$id`. Manter modais de criar/excluir formulário e o modal "Editar info" reutilizável.
- `package.json` (via `bun add`).

### 8. Não tocar
- `AppLayout`, menu lateral, autenticação, dashboard, clientes, casos, tela do agente (`agent.$token.tsx`), tabelas e RLS.

### Notas técnicas
- Tipo `TipoPergunta` já cobre os 7 tipos (após a migration aprovada anteriormente).
- Server-side: tudo via `supabase` client autenticado (RLS já cobre admin). Sem `createServerFn` necessário.
- Mobile: estrutura ocupa tela inteira; clicar num campo abre Sheet com o painel de propriedades.

Após sua aprovação, implemento e te chamo para o print antes de partir para popular o FR-12-10.