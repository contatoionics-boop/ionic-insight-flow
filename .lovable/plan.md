
Sim, dá pra fazer tudo. Recomendo dividir em **2 etapas** para validar cada bloco antes de seguir.

---

## Etapa 1 — CEP, CNPJ e novos tipos de pergunta

### 1.1 Banco

Migration única:

- `clientes`: adicionar colunas `nome_fantasia`, `cep`, `logradouro`, `numero`, `bairro`, `cidade`, `estado` (as colunas `cnpj`, `email`, `telefone` já existem).
- Enum `pergunta_tipo` (no projeto se chama o tipo da coluna `perguntas.tipo`): `ADD VALUE 'cep'` e `ADD VALUE 'cnpj'`.
- Inserir as 6 novas perguntas na seção "Dados Gerais" do formulário **BB0001** (ajustando os nomes de coluna reais: `texto` em vez de `titulo`, `obrigatoria` em vez de `obrigatorio`).

> Observação: o SQL que você colou usa `titulo` e `obrigatorio`, mas no schema as colunas são `texto` e `obrigatoria`. Vou corrigir na migration. Também: você mencionou "FR-12-10" no título mas no SQL usa "BB0001" — vou seguir **BB0001**. Me avisa se for outro.

### 1.2 Cadastro de clientes (`/app/clients`)

- Campo CNPJ com máscara `XX.XXX.XXX/XXXX-XX` + botão "🔍 Consultar CNPJ".
- Campo CEP isolado com máscara `XXXXX-XXX` + botão "🔍 Buscar endereço".
- Novos campos editáveis: nome fantasia, logradouro, número, bairro, cidade, estado.
- Consultas feitas **no frontend** direto em `viacep.com.br` e `publica.cnpj.ws` (sem servidor).
- Falha de API → mensagem inline, campos continuam editáveis manualmente, nunca bloqueia.
- Helpers reutilizáveis em `src/lib/cep.ts` e `src/lib/cnpj.ts` (fetch + máscara + parse).

### 1.3 Novos tipos no FormRunner (modo stepper atual)

Em `src/components/agent/FormFields.tsx`, adicionar render para `cep` e `cnpj`:
- Input com máscara + botão de consulta.
- Ao consultar com sucesso: mostra resumo "Encontrei: …" e botões **Confirmar** / **Corrigir**.
- Corrigir → libera campos de texto livre.
- Falha → fallback texto livre, sem travar.

Isso já faz as novas perguntas do BB0001 funcionarem no modo stepper.

---

## Etapa 2 — Modo chat `/agent/$token?mode=chat`

Mantém o stepper intacto. Mesmo loader, mesma persistência (`respostas_agente`), mesmo auto-save, mesma IA de foto/áudio — só muda a interface.

### 2.1 Arquitetura

- `src/routes/agent.$token.tsx`: ler `?mode=chat` via `Route.useSearch()` e renderizar `<FormChat>` em vez de `<FormRunner>`.
- Novo `src/components/agent/FormChat.tsx`: orquestra a conversa.
- Reaproveitar `FormFields` internamente para foto/áudio (mesma lógica IA), só embrulhado em balão.

### 2.2 Estrutura da conversa

- Lista linear de mensagens em estado React:
  `{ id, role: 'agent'|'user', kind: 'text'|'image'|'audio'|'options'|'summary', content, perguntaId? }`.
- Cursor (`secaoIdx`, `perguntaIdx`) avança após confirmação.
- Header: logo da empresa + nome + badge "Vistoria em andamento".
- Transcript scrollável + área de input dinâmica por tipo.

### 2.3 Comportamento por tipo (todos seguem o padrão: balão pergunta → input → balão resposta → "✅ Registrado" → próxima)

- **texto/numero**: textarea + Enter.
- **data**: date picker inline.
- **selecao_unica**: opções como botões grandes.
- **toggle/sim_nao**: dois botões Sim/Não.
- **audio**: botão gravar + alternativa texto; balão com player + transcrição.
- **foto**: upload → thumbnail no balão → spinner "Analisando…" → mensagem do agente com resultado IA (aprovado / parcial com Reenviar+Continuar / reprovado só Reenviar). Reaproveita exatamente `analisarFoto` atual.
- **cep/cnpj**: pergunta → input com máscara → spinner → balão "Encontrei: …" com Confirmar/Corrigir; Corrigir abre texto livre. Fallback se API falhar.

### 2.4 Transições e final

- Fim de seção: balão "✅ Seção X concluída! Próxima: Y."
- Fim do formulário: balão de revisão + cards por seção com respostas + botão "Confirmar e enviar ao especialista" (chama o mesmo `finalizarEnvio` atual).

### 2.5 Auto-save e retomada

- Cada resposta confirmada → mesmo `upsert` em `respostas_agente` que o stepper já faz.
- Ao abrir o link: hidrata respostas existentes, reconstrói o histórico de balões para perguntas já respondidas, e posiciona o cursor na primeira pergunta sem resposta.

### 2.6 Onde aparece o link `?mode=chat`

- Onde hoje gera link do agente (caso/preview), adicionar toggle "Stepper / Chat" que muda o query param do link gerado.

---

## Pontos técnicos / decisões

- Sem edge functions: chamadas a ViaCEP/CNPJ.ws são CORS-liberadas e ficam no browser.
- ViaCEP retorna `{ erro: true }` para CEP inválido — tratar.
- `publica.cnpj.ws` tem rate-limit baixo (~3 req/min por IP); em caso de 429, mostrar "Tente novamente em instantes" e manter fallback manual.
- Tipos do Supabase serão regenerados após a migration (não edito `types.ts` à mão).
- Nenhuma mudança em auth, modo stepper, fluxo de casos ou IA existente.

---

## Ordem sugerida

1. **Etapa 1** completa (migration + clientes + tipos cep/cnpj no stepper). Você testa.
2. **Etapa 2** (modo chat) depois que a etapa 1 estiver ok.

Posso começar pela Etapa 1?
