## Objetivo

Permitir que o super_admin agende vistorias pela interface (hoje só o admin tem o atalho no menu).

## Mudanças

**`src/components/AppLayout.tsx`**
- Adicionar item `{ to: "/app/new-case", label: "Agendar vistoria", icon: PlusCircle }` no array `navByRole.super_admin`, logo após o item "Agenda".

**`src/routes/app.agenda.tsx`**
- Incluir um botão "Agendar vistoria" no `PageHeader` que navega para `/app/new-case`, como atalho visual a partir da própria página de agenda.

## Fora do escopo

- Não mexer em RLS, server functions, ou no fluxo do vistoriador — tudo já existe e funciona:
  - rota `/app/new-case` com formulário de agendamento
  - server fn `agendarVistoria` que cria o caso e associa formulário + vistoriador
  - vistoriador recebe via `/app/minhas-vistorias` (filtrado por RLS)

## Fluxo final

Super admin → sidebar "Agendar vistoria" → escolhe formulário + vistoriador → confirma → vistoriador vê em "Minhas vistorias".
