# Novo modo de preenchimento: Checklist Guiado (sem substituir o chat)

## Parte 1 — Como funciona hoje (verificado no código)

**Respostas**: existe uma única tabela de respostas, `respostas_agente`, com `caso_id + pergunta_id` únicos (`valor_texto`, `arquivo_path`, `arquivos_paths`, `transcricao`, `ia_motivo`). Toda gravação passa por uma função central no servidor, `execSalvarResposta` (`src/lib/vistoria-agent.server.ts`), com upsert por `caso_id,pergunta_id`. Ou seja, **a fonte de verdade única já existe** — o checklist não cria nada novo.

**O chat grava direto no banco?** Sim. A IA chama a ferramenta `salvar_resposta` em `/api/vistoria-chat`, que executa `execSalvarResposta`. Já existe também um caminho sem IA: a server fn `salvarRespostasBloco` (`src/lib/vistoria-agent.functions.ts`), usada hoje pelos blocos agrupados (`BlocoResposta.tsx`), que salva vários campos de uma vez chamando a mesma função central. **Esse é o caminho que o checklist vai reutilizar.**

**Voz**: `use-gravacao-voz.ts` grava no navegador, converte para WAV e chama a server fn `transcreverAudio` (Whisper, português). Já é usada em campos de texto/CEP/CNPJ (`MicButton` em `FormFields.tsx`) e no campo de áudio. Reutilizável como está.

**Uploads**: vão direto do navegador para o bucket `agente-uploads`, em `casos/{casoId}/{uuid}.ext`; o caminho retornado é gravado em `arquivo_path`/`arquivos_paths` da pergunta. Vídeo até 100 MB. A vinculação foto↔pergunta já existe — no checklist ela fica visualmente dentro da pergunta.

**Condicionais**: `condicional_pergunta_id/operador/valor`, avaliados por `avaliarCondicional` (`src/lib/perguntas-mapeamento.ts`), já usados no servidor (`perguntasVisiveis`) e no cliente.

**Progresso**: `calcularPendencias` no servidor já devolve visíveis, respondidas, obrigatórias faltando, próxima pendência e `podeFinalizar` — **já respeitando condicionais**. É a base do percentual do checklist.

**Componentes reaproveitáveis**: `FormFields.tsx` (renderiza todos os tipos de campo, com microfone, câmera, CEP/CNPJ, vídeo, validação de foto), `BlocoResposta.tsx` (bloco agrupado com autosave em localStorage), `FormRunner.tsx` (wizard por seção, hoje só no preview do admin), `ui-bits.tsx` (Card/Button/Modal do design system).

**O que muda**: praticamente só interface e orquestração. **Nenhuma alteração de estrutura de dados é necessária** — nem no laudo, que continua lendo `respostas_agente`. Uma única adição opcional de backend: uma server fn de extração de múltiplos campos a partir de uma fala (item 8 do pedido), que não grava nada sem confirmação.

## Parte 2 — O que será construído

### Rota e coexistência
`/app/vistoria/$casoId` e `/agent/$token` passam a aceitar `?modo=checklist` (padrão) e `?modo=chat`. Um botão discreto no cabeçalho alterna entre "Checklist" e "Assistente". O `AgentChat` atual continua intacto; as duas telas leem e escrevem as mesmas respostas, então alternar a qualquer momento mostra tudo sincronizado.

### Nova tela `ChecklistVistoria`
- **Etapas** = seções reais do formulário (`secoes`, na ordem), mais uma etapa final de Revisão.
- **Desktop**: lista de etapas à esquerda, perguntas ao centro, painel de status/assistente à direita.
- **Mobile**: stepper compacto e horizontal no topo, campos grandes, Anterior/Próximo fixos na base respeitando a área segura.
- **Status por etapa**: Não iniciada / Incompleta / Concluída / Com pendência, calculado das respostas atuais e das condicionais.
- **Progresso geral**: "X de Y itens · Z%", vindo de `calcularPendencias` (só perguntas visíveis).
- **Campos**: renderizados por `PerguntaBloco` de `FormFields.tsx` — mesmo visual, mesmos tipos, mesmo microfone e mesma câmera de hoje. Blocos (`pergunta_blocos`) continuam renderizados agrupados.
- **Observação por pergunta**: campo opcional com microfone, gravado junto da resposta.
- **Autosave**: rascunho local por caso/seção (mesmo padrão de `BlocoResposta`) e gravação no servidor ao sair do campo, ao trocar de etapa e a cada ~10s com alterações pendentes, via `salvarRespostasBloco`. Indicador "Salvo" no cabeçalho.
- **Próximo** valida só os obrigatórios da etapa e destaca o que falta; nunca apaga resposta.

### Revisão rápida e revisão final
Painel lateral com as pendências mais relevantes durante o preenchimento, e etapa final separando Concluído / Pendências (obrigatórios) / Recomendações (opcionais). Clicar numa pendência leva direto à etapa e faz scroll/foco na pergunta. Finalizar continua chamando `finalizarVistoriaChat`, que já valida no servidor e dispara laudo e eventos.

### Assistente contextual
Painel lateral (desktop) / folha inferior (mobile) que usa a rota de chat já existente, recebendo etapa e pergunta atuais no contexto. O assistente **não grava resposta**: quando sugerir um valor, aparece "Usar esta resposta? Sim / Não", e só ao confirmar o valor entra no campo (e é salvo pelo caminho normal).

### Voz com múltiplos campos (item 8)
Nova server fn `extrairCamposDaFala`: recebe a transcrição e as perguntas visíveis da etapa, devolve pares campo→valor com confiança. O resultado é exibido como cartão "Informações identificadas na fala", com a transcrição visível e cada campo editável/desmarcável. **Nada é salvo sem confirmação.** Áudio não passa a ser armazenado (hoje não é), apenas a transcrição, como já ocorre.

## Detalhes técnicos

- Nova server fn `getChecklistVistoria` (em `src/lib/vistoria-agent.functions.ts`) devolvendo seções, blocos, perguntas, opções, respostas atuais e as métricas de `calcularPendencias` — reutilizando `loadAgentContext`, sem consulta nova ao banco.
- Gravação exclusivamente por `salvarRespostasBloco` → `execSalvarResposta` (mesmo caminho do chat), preservando o evento `vistoria_iniciada` e o merge de `arquivos_paths`.
- Novos arquivos em `src/components/agent/checklist/`: `ChecklistVistoria.tsx`, `EtapasNav.tsx`, `EtapaPerguntas.tsx`, `PainelRevisao.tsx`, `AssistentePanel.tsx`, `FalaMultiCampo.tsx`. Nenhum estilo novo: só componentes e tokens de `ui-bits.tsx`/design system atual.
- `src/lib/vistoria-checklist.ts`: cálculo puro de status por etapa e listas de pendências, a partir de perguntas visíveis + respostas (compartilhado pelo painel e pela revisão).
- Sem migração de banco. Geração do laudo intocada.

## Entrega em etapas

1. `getChecklistVistoria` + cálculo de status/progresso + casca do checklist com navegação por etapas (desktop e mobile).
2. Perguntas renderizadas com `FormFields`, autosave, voz e foto por pergunta, validação de etapa.
3. Revisão rápida, revisão final com salto para a pendência e finalização.
4. Assistente contextual com confirmação antes de aplicar sugestão.
5. Extração de múltiplos campos a partir da fala, com cartão de confirmação.
