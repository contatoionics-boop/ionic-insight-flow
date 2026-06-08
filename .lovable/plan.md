## Objetivo
Transformar `AgentChat` numa UI estilo ChatGPT/Gemini: **uma pergunta por vez** no centro da tela, com transição animada entre turnos. Histórico continua no contexto da IA, mas não é renderizado — para revisar, o usuário pergunta ao agente.

## Decisões confirmadas
- **Tema**: claro (atual do sistema), adaptado.
- **Header direito**: nome do cliente (pill) + botão **Finalizar**.
- **Sem histórico visível**: só a última pergunta da IA + composer.

## Comportamento visual

### Header (sticky topo)
- Esquerda: logo + **Eonyx** (ou `config.nome_empresa`) com chevron decorativo.
- Direita: **pill claro com nome do cliente** + botão **Finalizar** (escuro/primary).
- Barra fina de progresso embaixo (`respondidas/totalVisiveis`).

### Área central
- Vazio inicial: pergunta de boas-vindas centralizada verticalmente, fonte grande, sem bolha.
- Durante a conversa: **só `lastAssistantMessage`** renderizada no centro.
- A cada nova pergunta: `key={message.id}` força remount → `animate-fade-in` (Tailwind utility já existente: fade + slide-up 10px).
- Enquanto IA processa (`status === "submitted"|"streaming"`): troca a pergunta por um shimmer "Pensando…".
- Sem scroll de histórico. Sem bolhas empilhadas.

### Composer (rodapé fixo, pill)
- Container arredondado (`rounded-full`), borda sutil, sombra leve.
- `+` à esquerda → input de foto (câmera/galeria), igual hoje.
- Textarea central, placeholder: "Responda à pergunta…".
- Mic à direita (gravação de voz, mantém `useGravacaoVoz`).
- Botão enviar (paper plane) à direita, ativo quando há texto; vira spinner quando `busy`.
- Foco automático após cada turno.

### Mensagens do usuário
- Não ficam na tela. Some junto com a pergunta anterior no momento do envio (fade-out curto, opcional — ou simplesmente desaparece quando a próxima pergunta entra).

## Mudanças técnicas (escopo enxuto)

1. **`src/components/agent/AgentChat.tsx`** — reescrita do layout:
   - Derivar `lastAssistantText` = última mensagem com `role === "assistant"` cujo texto não esteja vazio.
   - Renderizar só essa mensagem, com `key` = id, classe `animate-fade-in`.
   - Novo `Header` (Eonyx + cliente pill + Finalizar).
   - Novo `Composer` em formato pill.
   - Remover o `.map(messages)` e o `MessageBubble` antigo.
   - Manter: `useChat`, transport, voz, foto upload, finalizar, `getEstadoVistoria`.

2. **`src/lib/vistoria-agent.server.ts`** — pequeno ajuste no system prompt:
   - Adicionar: "Se o usuário pedir para revisar uma resposta já dada (ex.: 'o que respondi no CNPJ?'), consulte o `state` no contexto e responda diretamente, sem chamar `salvar_resposta`."

3. **Nada muda** em: `vistoria-chat.ts`, tools, schema, rotas, Whisper, Vision, finalização.

## Arquivos afetados
- Editado: `src/components/agent/AgentChat.tsx`
- Editado: `src/lib/vistoria-agent.server.ts` (1 parágrafo no prompt)

Sem migrações, sem deps novas, sem mudança de rota.
