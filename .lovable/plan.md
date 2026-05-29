## O que vamos resolver

1. **Não aparece opção de modo Chat / link nos formulários** — hoje o modo Chat e a geração de link só existem em `/app/new-case`. Vamos colocar um botão "Gerar link" em cada card da lista de Formulários, com escolha de cliente, agente e modo (Stepper / Chat), reaproveitando a lógica existente.
2. **Não dá pra criar usuário** — o log do Supabase mostra `POST /invite → 401 no_authorization`. Isso indica que a chamada `auth.admin.inviteUserByEmail` está saindo sem o token de service role anexado (provavelmente um problema com `inviteUserByEmail` neste setup). Vamos trocar para um fluxo mais robusto que **funciona com o que já temos**, sem depender de SMTP novo.

---

## 1. Botão "Gerar link" nos cards de Formulários

Em `src/routes/app.forms.index.tsx`:

- Adicionar botão **"Gerar link"** (ícone `Link2`) no rodapé de cada card, ao lado de Duplicar/Excluir.
- Ao clicar, abrir um Modal com:
  - Select **Cliente** (carrega `clientes`; se o form já tem `cliente_id` vem pré-selecionado e travado).
  - Select **Agente técnico** (carrega `user_roles` onde `role = agente_tecnico`).
  - Toggle **Modo de preenchimento**: Stepper / Chat (mesmo componente visual de `app.new-case.tsx`).
  - Botão **Gerar link** → cria `casos` + `links_agente` e exibe o link copiável (`/agent/<token>` ou `/agent/<token>?mode=chat`).
- Reutilizar exatamente a lógica de `generate` que já existe em `app.new-case.tsx` (extraída para `src/lib/agent-link.ts` para evitar duplicação).

O fluxo de `/app/new-case` continua como está — agora existe nos dois lugares.

---

## 2. Correção da criação de usuário

Problema identificado nos logs Supabase Auth:
```
POST /invite → 401 "This endpoint requires a valid Bearer token"
```
A função `adminCreateUser` chama `supabaseAdmin.auth.admin.inviteUserByEmail`, mas o endpoint `/invite` está rejeitando — provavelmente porque exige SMTP configurado e/ou o cliente está mandando a request sem o header de service role nesse caminho.

Vamos trocar `inviteUserByEmail` por um fluxo equivalente que **não depende** do endpoint `/invite`:

Em `src/lib/admin-users.functions.ts` → `adminCreateUser.handler`:

1. Gerar senha temporária aleatória (`crypto.randomUUID()`).
2. Chamar `supabaseAdmin.auth.admin.createUser({ email, password: tempPwd, email_confirm: true, user_metadata: { nome } })` — endpoint `/admin/users`, que funciona com service role e não depende de SMTP.
3. Atualizar `profiles.nome` e inserir `user_roles` como já faz hoje.
4. Em seguida chamar `supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email })` para obter um link de definição de senha e retornar esse link junto com `{ ok, userId, recoveryLink }`.
5. No front (`app.users.tsx`), após criar com sucesso, mostrar o `recoveryLink` em um banner copiável: *"Envie este link de primeiro acesso para o usuário"*. Assim funciona mesmo sem SMTP configurado.
6. O botão **Resetar senha** continua usando `resetPasswordForEmail` (público). Adicionar fallback: se quiser, também usar `generateLink` no servidor para gerar manualmente.

Logging extra: registrar `console.error` com a mensagem original do Supabase em caso de falha, para diagnóstico futuro nos worker logs.

---

## Arquivos a alterar

- **Criar** `src/lib/agent-link.ts` — helper `criarCasoELink({ clienteId, formId, agenteId, userId, mode })` retornando o URL.
- **Editar** `src/routes/app.forms.index.tsx` — botão + modal "Gerar link".
- **Editar** `src/routes/app.new-case.tsx` — usar o helper novo (refactor mínimo).
- **Editar** `src/lib/admin-users.functions.ts` — trocar `inviteUserByEmail` por `createUser` + `generateLink`.
- **Editar** `src/routes/app.users.tsx` — exibir link de primeiro acesso retornado após criar.

Sem mudanças de schema/migration.

---

## Como testar depois

1. Em **Formulários**, clicar em "Gerar link" num card → escolher Cliente + Agente + **Chat** → confirmar que o link gerado termina com `?mode=chat` e abre o `FormChat`.
2. Em **Usuários**, clicar em "Novo usuário" → preencher → confirmar que o usuário aparece na lista e o link de primeiro acesso é exibido para copiar.
3. Abrir o link de primeiro acesso em aba anônima → cair em `/reset-password` → definir senha → logar.