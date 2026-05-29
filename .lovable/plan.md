## Objetivo

1. Desacoplar formulário de cliente — formulário vira template reutilizável; o cliente é escolhido só ao criar o caso.
2. Permitir duplicar formulários (cópia com novo nome, mantendo todas seções/perguntas/opções).
3. Preview funcional em duas modalidades: dentro do app (com sidebar) e em tela cheia (igual link do vistoriador), com botão para alternar.

## 1. Migração de schema

- `ALTER TABLE formularios ALTER COLUMN cliente_id DROP NOT NULL`.
- Atualizar RLS de `formularios`, `secoes`, `perguntas`, `opcoes_pergunta`:
  - admin SELECT/INSERT/UPDATE/DELETE passam a checar `criado_por = auth.uid()` (ou `ver_todos_casos`), sem exigir cliente.
  - função `admin_pode_ver_formulario` reescrita: lê `formularios.criado_por` direto.
- Não altero `casos.cliente_id` (continua obrigatório no caso).

## 2. Listagem de formulários (`/app/forms`)

- Remover obrigatoriedade de cliente no modal "Novo/Editar formulário" (campo vira opcional, com opção "Template (sem cliente)").
- No card, exibir "Template" quando `cliente_id` é nulo, senão nome do cliente.
- Novo botão **Duplicar** em cada card: chama serverFn `duplicarFormulario({ id, novoNome })` que copia formulário + seções + perguntas + opções em uma transação, retornando novo id.
- Manter botões Visualizar / Editar estrutura / Editar info / Excluir.

## 3. Preview — duas rotas

**a) `/app/forms/$id/preview` (atual, dentro do app)**
- Continua usando `FormRunner` mas embrulhado em um container que respeita o layout `/app` (sidebar visível).
- Adicionar botão "Abrir em tela cheia" no topo que abre `/preview/forms/$id` em nova aba.

**b) `/preview/forms/$id` (novo, fora do layout `/app`)**
- Rota raiz, sem AppLayout — visual idêntico ao `agent.$token`.
- Mesmo componente `FormRunner` em modo `preview`.
- Estado só no React; nada salvo no banco.
- Banner amarelo "Preview — nenhum dado é salvo".
- Acessível só por usuários autenticados (não usa token); RLS de admin/super_admin garante leitura.

## 4. Builder do formulário (`/app/forms/$id`)

- No topo, ao lado de "Editar info", adicionar:
  - botão "Visualizar (no app)" → `/app/forms/$id/preview`
  - botão "Abrir preview em nova aba" → `/preview/forms/$id`

## Detalhes técnicos

- ServerFn `duplicarFormulario` em `src/lib/formularios.functions.ts` com `requireSupabaseAuth`; usa cliente autenticado (RLS aplica). Faz 4 inserts encadeados e devolve `{ id }`.
- Tipos do supabase serão regenerados após a migration (não editar `types.ts` à mão).
- FormRunner já é compartilhado — sem mudanças nele.
- Não mexer em: auth, agente público, casos, configurações de empresa.
