## Objetivo

Polimento visual rápido e de baixo risco nos formulários e na navegação, mantendo a stack atual (shadcn + Tailwind + tokens do sistema). Sem adotar `@base-ui/react`, sem gradient menu, sem refator estrutural.

## Por que NÃO usar o Base UI Field

Já existe `src/components/ui/form.tsx` (shadcn `Form` + `FormField` + `FormLabel` + `FormMessage`) e `src/components/ui-bits.tsx`. Trazer `@base-ui/react` duplicaria primitivos, exigiria reescrever todos os formulários e abriria espaço para regressão visual (ex.: `text-destructive-foreground` no snippet é a cor do texto **sobre** destructive, não a cor do erro). O mesmo resultado de UX é alcançável padronizando o que já temos.

## Escopo

1. **Tokens de formulário em `src/styles.css`**
   - Revisar `--ring`, `--input`, `--border`, `--destructive` para foco mais visível e erro com contraste correto em light/dark.
   - Adicionar `--field-gap` e `--field-radius` para consistência.

2. **Padronizar primitivos** (`src/components/ui/input.tsx`, `textarea.tsx`, `select.tsx`, `label.tsx`)
   - Altura, padding e raio iguais entre Input/Textarea/Select/DatePicker.
   - Estado de foco com `ring-2 ring-ring/40` consistente.
   - Estado `aria-invalid` com borda destructive + mensagem padronizada.
   - Placeholder com cor `muted-foreground` em todos.

3. **`ui-bits.tsx`** (usado pelo app)
   - Alinhar `Input/Select/Textarea/Label` com os primitivos shadcn (mesmo tamanho, foco, erro).
   - `Label` ganha suporte a `required` (asterisco discreto) e `hint`.
   - `Modal` com largura responsiva, sticky footer opcional e fechamento por ESC.

4. **FormRunner / FormChat / FormFields** (vistoriador)
   - Hierarquia: título da seção + descrição + progresso (já existe) com mais respiro.
   - Cada pergunta vira um bloco com label forte, descrição, controle e mensagem de validação no mesmo padrão.
   - Estados de áudio/foto/IA com badges e ícones consistentes (success/warning/destructive já existentes).
   - Botões de navegação fixos no rodapé em mobile (sticky), com loading state claro.

5. **Formulários internos** (`app.new-case.tsx`, `app.clients.tsx`, `app.configuracoes.tsx`, `app.users.tsx`, builder em `app.forms.*`)
   - Aplicar o mesmo padrão de Label/Input/erro.
   - Agrupar campos relacionados com espaçamento consistente (`space-y-4` em grupos, `space-y-6` entre grupos).
   - Botões primários/secundários alinhados à direita com ordem consistente (Cancelar → Salvar).

6. **AppLayout (sidebar atual — só polir)**
   - Densidade: padding vertical dos itens uniforme.
   - Item ativo com contraste melhor (fundo `accent` + texto `accent-foreground`).
   - Hover sutil, ícones com tamanho fixo, divisores de grupo mais discretos.
   - Header com altura consistente e breadcrumbs/título com hierarquia clara.
   - Sem trocar componente, sem mexer em rotas.

## Fora de escopo

- Adotar `@base-ui/react` ou refatorar para `Field` primitives.
- Gradient menu.
- Mudanças de layout estrutural (grid, sidebar collapsível nova, etc.).
- Mudanças de comportamento, validação ou regra de negócio.

## Riscos

Baixos. Mudanças concentradas em CSS, props visuais e composição de classes. Sem mexer em loaders, server functions, schemas ou navegação.

## Entrega

Tudo em frontend, mantendo as cores e tokens já definidos em `src/styles.css`.