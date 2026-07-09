## Diagnóstico do CS-0031

Consultei o banco para o CS-0031 (formulário 23dd620c…, 67 perguntas / 57 obrigatórias / 0 condicionais).
`respostas_agente` do caso: **46 linhas**, distribuídas em 46 `pergunta_id` distintos. Nenhuma condicional afeta visibilidade.

Cada tela usa uma fórmula diferente, por isso os números divergem:

| Tela | Fórmula usada hoje | Resultado |
|---|---|---|
| Lista de mapeamentos (`/app/cases`) | `respondidas_obrigatórias / total_obrigatórias` — só conta perguntas obrigatórias com `valor_texto/arquivo_path/transcricao` não-vazio (`src/lib/mapeamento.functions.ts` L130-147) | **44 / 57** |
| Detalhe (`/app/vistorias/:id`) | `perguntas.filter(p => respostasPorPergunta.get(p.id).length > 0)` — conta **qualquer** linha, mesmo vazia (`src/routes/app.vistorias.$id.tsx` L181) | **45 / 67** |
| Chat do agente (`AgentChat` / `getEstadoVistoria`) | `respondidas = visíveis com algum valor` e `obrigatoriasFaltando = obrigatórias visíveis sem valor` (`src/lib/vistoria-agent.functions.ts` L42-49) | popup: "13 pergunta(s) obrigatória(s) sem resposta" (= 57-44) |

Três coisas quebradas:
1. **Denominadores inconsistentes** (57 obrigatórias vs 67 totais) → o mesmo caso aparece com progresso 77 %, 67 % e "13 faltando".
2. **Detalhe conta linhas fantasmas** (44 vs 45): há 1-2 linhas em `respostas_agente` sem valor útil (upsert antigo) ou ligadas a `pergunta_id` não mais no form. A tela de detalhe ignora esse filtro e infla o número.
3. **IA sugere "Finalizar" com 13 obrigatórias pendentes**: o `buildSystemPrompt` já injeta "Obrigatórias faltando: 13", mas o modelo (`gpt-4o-mini`) alucina fechamento assim que a resposta parece "wrap-up". Falta uma trava dura no lado do servidor.

## O que vou fazer

### 1. Unificar a fórmula de progresso em torno de "obrigatórias respondidas / obrigatórias totais"
Um único helper `contarProgresso(casoId)` em `src/lib/mapeamento.functions.ts` que retorne `{respondidas, total, obrigatoriasFaltando, respondidasTotais, totalPerguntas}`. Todas as telas passam a exibir "X / Y obrigatórias" como número principal, com "(Z de W no total)" como sublinha.

Consumidores atualizados:
- `src/routes/app.vistorias.$id.tsx` — trocar o cálculo local pelo helper e filtrar rows sem valor (mesma regra do resto do sistema).
- `src/components/agent/AgentChat.tsx` — barra de progresso passa a usar `respondidas_obrigatorias / total_obrigatorias`; popup mantém "13 obrigatórias".
- Lista (`app.cases.tsx`) já usa esta fórmula, apenas garantir o mesmo filtro (`valor_texto || arquivo_path || transcricao`).

### 2. Corrigir a contagem-fantasma na página de detalhe
No `useMemo` de `respostasPorPergunta`, filtrar linhas sem `valor_texto && !arquivo_path && !transcricao && !(arquivos_paths?.length)`. Elimina o 45 vs 44.

### 3. Trava dura para "Finalizar" (chat)
- `execSalvarResposta` já persiste a resposta; após salvar, **recomputar o estado** e devolver ao modelo `estado_pos_salvamento: { obrigatorias_faltando, proxima_pergunta_id }`. Isso força o próximo turno a ver o número real.
- Reforçar o system prompt: "**Nunca** sugira, mencione ou implique que o mapeamento pode ser finalizado enquanto `obrigatorias_faltando > 0`. Se o usuário pedir para finalizar antes disso, responda listando quantas ainda faltam e retome a próxima pergunta."
- Como cinto-de-segurança, o botão "Finalizar" no `AgentChat` já usa `obrigatoriasFaltando` do servidor (correto); o `confirm()` continua a exibir o número real, então mesmo com o modelo pedindo para finalizar o usuário vê "Ainda há 13 sem resposta".

### 4. Sanidade dos dados
Migração pontual (não destrutiva) que apaga linhas em `respostas_agente` onde `coalesce(valor_texto,'')='' AND arquivo_path IS NULL AND coalesce(transcricao,'')='' AND coalesce(array_length(arquivos_paths,1),0)=0`. Assim casos antigos param de contar respostas vazias.

## Arquivos afetados
- `src/lib/mapeamento.functions.ts` (novo helper + reuso)
- `src/lib/vistoria-agent.functions.ts` e `src/lib/vistoria-agent.server.ts` (retorno pós-salvar + prompt)
- `src/routes/app.vistorias.$id.tsx` (fórmula + filtro)
- `src/components/agent/AgentChat.tsx` (barra em cima do total de obrigatórias)
- 1 migração SQL de limpeza de respostas vazias

## Não incluído
- Não vou mexer no fluxo de perguntas condicionais (não afeta o CS-0031, que tem 0 condicionais).
- Não vou trocar de modelo de IA — a trava de servidor resolve a alucinação sem custo extra.
