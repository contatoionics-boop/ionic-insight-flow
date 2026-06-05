## Objetivo

Resolver três problemas no fluxo de clientes/agendamento:

1. Botão **"Editar dados"** na lista de clientes não abre nada.
2. Após cadastrar empresa, a lista só mostra o novo cliente depois de recarregar a página.
3. Quando a empresa tem só uma localização, a matriz deve servir como ponto de mapeamento, sem precisar criar uma "unidade" separada para agendar.

---

## 1. Edição de clientes não abre

**Causa provável:** o botão "Editar dados" em `src/routes/app.clients.tsx` (linhas 320–327) navega para `/app/clients/$empresaId`. Na prática, o usuário já está vendo a mesma página e nada acontece visualmente, ou — quando a empresa foi criada sem CNPJ/endereço — a página de detalhe abre, mas só mostra "Nova matriz" (não há nada para "editar"), o que reforça a sensação de "não funciona".

**Mudanças:**

- Renomear o botão da lista para **"Abrir"** (com ícone de chevron), deixando claro que leva ao detalhe.
- Em `src/routes/app.clients.$empresaId.tsx`, quando a empresa **não tem matriz**, abrir automaticamente o modal "Nova matriz" na primeira renderização (em vez de só mostrar o estado vazio com botão).
- Quando a empresa tem **exatamente uma matriz**, adicionar um botão de atalho no header da página ("Editar dados da empresa") que abre direto o modal de edição daquela matriz.
- Garantir que a coluna de Ações da lista pare o `stopPropagation` apenas no wrapper, mantendo o clique no botão funcional (revisão de QA).

## 2. Lista não atualiza após salvar

**Causa:** em `handleSave` (`app.clients.tsx`, linhas 171–217), após o `insert` navegamos imediatamente para a página de detalhe. Ao usar o botão "voltar" do navegador ou voltar pelo menu, o `useEffect`/`refresh` não roda de novo (o componente já está montado e o estado anterior persiste).

**Mudança:**

- Disparar `router.invalidate()` (de `useRouter`) após o save, antes de navegar. Isso marca a rota da lista como stale, e ao voltar ela rebusca.
- Em alternativa, refazer `refresh()` no `handleSave` antes do `navigate` (cobre o caso de o usuário só fechar o modal sem ir ao detalhe).
- Aplicar o mesmo padrão em `handleRename` e `handleDelete` (já chamam `refresh`, manter).

## 3. Empresa com uma única localização → matriz é o ponto de mapeamento

Hoje `casos.unidade_id` é obrigatório (FK para `unidades`), então o agendamento exige sempre uma unidade. Para preservar o schema sem migração e manter compatibilidade com dados existentes, adotamos uma **unidade implícita "Sede"** vinculada à matriz, criada de forma transparente.

**Mudanças (frontend + server function):**

- **Server function `agendarVistoria`** (`src/lib/casos.functions.ts`):
  - Aceitar `matrizId` como alternativa a `unidadeId`.
  - Se vier `matrizId` sem `unidadeId`: procurar uma unidade existente da matriz; se não houver, criar uma unidade "Sede" copiando o endereço da matriz, e usar o id dela no `casos.insert`. Operação idempotente (criar só se não existir nenhuma).
- **Tela de agendamento** (`src/routes/app.new-case.tsx`):
  - Quando a matriz selecionada tem **0 unidades**, esconder o seletor de Unidade e mostrar um aviso "Mapeamento será agendado na sede (endereço da matriz)".
  - Quando tem **1 unidade**, manter o auto-select atual.
  - Enviar `matrizId` no payload quando não há unidade selecionável; backend resolve.
  - Pré-preenchimento de endereço já existe — apenas garantir o fallback para o endereço da matriz quando não há unidade.
- **Tela de clientes detalhe** (`src/routes/app.clients.$empresaId.tsx`):
  - Remover o aviso "Adicione a primeira unidade para poder agendar mapeamentos" e substituir por: "Esta matriz já pode receber mapeamentos. Adicione unidades extras se houver filiais."

---

## Detalhes técnicos

- Arquivos editados:
  - `src/routes/app.clients.tsx` — rótulo do botão, `router.invalidate()` no save.
  - `src/routes/app.clients.$empresaId.tsx` — auto-abrir modal de matriz quando vazio; atalho "Editar dados" para a matriz única; texto de hint na seção de unidades.
  - `src/routes/app.new-case.tsx` — esconder seletor de unidade quando matriz sem unidade, enviar `matrizId`.
  - `src/lib/casos.functions.ts` — aceitar `matrizId`, criar/reutilizar unidade "Sede".
- Sem alterações de schema/migrações.
- Sem mudanças de RLS (insert de unidade pelo backend usa o cliente autenticado, que já tem policy de insert via `criado_por = auth.uid()` na empresa do usuário).

## Riscos / pontos a verificar

- Policy de `INSERT` em `unidades` precisa permitir que o `criado_por` da empresa crie unidade sob qualquer matriz da empresa — confirmar nas políticas atuais antes de implementar; se faltar, abrir tarefa de policy (não incluído neste plano).
- "Sede" criada automaticamente aparecerá na lista de unidades da matriz; aceitável e intuitivo.