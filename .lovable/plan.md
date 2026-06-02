# Renomear "Casos" → "Vistorias" e permitir ver/aprovar o andamento

## 1. Renomear no sidebar e na página
- `src/components/AppLayout.tsx`: trocar label `"Casos"` por `"Vistorias"` no item `/app/cases` (super_admin).
- `src/routes/app.cases.tsx`: `PageHeader` passa a `title="Vistorias"` e `description="Todas as vistorias da plataforma."`; mensagens vazias/loading usam "vistoria".
- Manter a rota `/app/cases` (apenas o label muda).

## 2. Linhas da tabela clicáveis
Em `app.cases.tsx`, cada `<tr>` ganha `hover:bg-muted/50 cursor-pointer` e `onClick` que navega para `/app/vistorias/$id` via `useNavigate`.

## 3. Nova rota: detalhes da vistoria
Criar `src/routes/app.vistorias.$id.tsx` para admin/super_admin verem o andamento e o que já foi respondido.

Conteúdo:
- **Cabeçalho**: código, status (badge), cliente, agente, formulário, agendado_em, endereço, observações, criado_em.
- **Progresso**: `respondidas / total_perguntas` com `Progress`.
- **Respostas por seção/pergunta**: lista `secoes` → `perguntas` do `formulario_id` ordenadas; para cada pergunta mostra texto/tipo/obrigatória + resposta de `respostas_agente` (`valor_texto`, transcrição, preview de `arquivo_path` via signed URL do bucket `agente-uploads`, badge `ia_aprovado`/`ia_motivo`), ou estado "Sem resposta" (mostra onde a vistoria parou).
- **Ações**: "Voltar" → `/app/cases`. Se o usuário for **super_admin** e o status estiver em revisão/aprovado, link "Abrir na revisão" → `/app/review/$id` para edição/aprovação (admin comum não tem acesso a essa fila).

## 4. Acesso de super_admin ao fluxo de revisão
Hoje `/app/review/$id` e `/app/review-queue` são usadas pelo especialista e as RLS de `casos` para UPDATE em status de revisão exigem `has_role('especialista')`. Para o super_admin também poder editar/aprovar pelo mesmo fluxo:
- Migration adicionando policy `casos super admin select revisao`/`update revisao` já é coberta pela policy existente `casos super admin all` (super_admin já pode tudo), então **não há mudança de RLS necessária**.
- O mesmo vale para `respostas_agente` (já tem `respostas super admin all`).
- Apenas garantir no componente `ReviewCasePage` que super_admin não é bloqueado (hoje carrega via `supabase.from("casos")` direto, sem checar role — funciona). E exibir o link "Abrir na revisão" do passo 3 quando `role === "super_admin"`.

## 5. Detalhes técnicos
- Rota TanStack: `createFileRoute("/app/vistorias/$id")` com `errorComponent` e `notFoundComponent`.
- Carregamento paralelo via Supabase browser client: caso + joins, secoes/perguntas/opcoes do `formulario_id`, respostas_agente por `caso_id`. RLS atual já cobre admin (próprios casos) e super_admin (tudo).
- Signed URLs para arquivos privados: `supabase.storage.from("agente-uploads").createSignedUrl(path, 3600)`.

## Fora de escopo
- Mudanças no fluxo do especialista além de permitir reuso por super_admin.
- Renomear a rota `/app/cases` (só o label muda).
- Polimento visual além do hover clicável da tabela.
