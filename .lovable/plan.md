# Plano: experiência mobile/PWA para Agente Técnico

Quando um usuário com papel `agente_tecnico` faz login, o sistema deve entregar uma interface pensada para celular (uma "mini app") e ser instalável como PWA na tela inicial. Admins, especialistas e super_admin continuam com a experiência desktop atual — sem mudanças.

## 1. PWA instalável (escopo manifesto + ícones)

- Adicionar `public/manifest.webmanifest` com `name`, `short_name` ("Ionics Agente"), `theme_color` navy (#1a2436), `background_color` branco, `display: "standalone"`, `start_url: "/app/minhas-vistorias"`, `scope: "/"`.
- Gerar ícones (192, 512, maskable) em `public/icons/`.
- Registrar `<link rel="manifest">`, `theme-color`, `apple-touch-icon` no `head()` do `src/routes/__root.tsx`.
- **Sem service worker / sem offline** nesta etapa (regra Lovable: manifest-only para "instalar no celular"). Offline pode entrar depois se pedirem.

## 2. Layout mobile dedicado para agente técnico

Criar `src/components/AgentMobileLayout.tsx` — shell otimizado para telefone:

- Topbar fixa compacta (logo + nome do agente + sino de notificações + sair).
- **Bottom navigation** (estilo app) com 3 abas grandes touch-friendly:
  - Hoje (mapeamentos do dia)
  - Agenda (próximos / histórico)
  - Perfil (dados + sair + tema)
- Conteúdo em `<main>` com `safe-area-inset` (`pb-[env(safe-area-inset-bottom)]`), tipografia maior, cards full-width, botões com altura mínima 44px.
- Sem sidebar lateral, sem colapsar/expandir — o `AppLayout.tsx` atual fica só para os outros papéis.

## 3. Roteamento condicional por papel

Em `src/components/AppLayout.tsx`:

- Após `useAuth()` resolver, se `auth.role === "agente_tecnico"` → renderizar `<AgentMobileLayout><Outlet /></AgentMobileLayout>` em vez do shell desktop.
- Manter o redirect já existente (`routeForRole` → `/app/minhas-vistorias`) como rota inicial pós-login do agente.
- Em `src/routes/index.tsx` (login), após `signIn`, continuar usando `routeForRole`; nenhum ajuste de lógica de auth.

## 4. Adaptação das telas que o agente usa

Telas tocadas (apenas as acessíveis ao papel `agente_tecnico`):

- `src/routes/app.minhas-vistorias.tsx` — reorganizar em lista vertical de cards grandes, agrupados por "Hoje / Próximos / Concluídos"; botões "Confirmar / Recusar / Iniciar" em largura total.
- `src/routes/app.vistoria.$casoId.tsx` (execução do mapeamento via chat) — garantir input fixo no rodapé acima da bottom nav, botões de anexar foto grandes, mensagens em coluna única.
- Telas não acessíveis ao agente (dashboard, clientes, configurações, etc.) ficam intactas.

## 5. Viewport e meta tags

Em `__root.tsx`:

- Confirmar `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- Adicionar `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style="black-translucent"`, `apple-mobile-web-app-title="Ionics Agente"`.

## 6. Fora de escopo (confirmar se quer depois)

- Service worker / modo offline / cache de mapeamentos para uso sem internet.
- Push notifications nativas (hoje o sino é in-app).
- Câmera nativa via Capacitor / app store.

## Detalhes técnicos

- Arquivos novos: `src/components/AgentMobileLayout.tsx`, `public/manifest.webmanifest`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`.
- Arquivos alterados: `src/routes/__root.tsx` (head tags), `src/components/AppLayout.tsx` (switch por role), `src/routes/app.minhas-vistorias.tsx` e `src/routes/app.vistoria.$casoId.tsx` (refit mobile).
- Sem migrações Supabase, sem novas server functions, sem mudanças de auth/roles.
- Sem `vite-plugin-pwa` (manifest-only, conforme regra Lovable).

Pode confirmar para eu implementar?
