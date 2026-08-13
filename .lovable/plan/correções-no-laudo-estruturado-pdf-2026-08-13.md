# Correções no laudo estruturado (PDF)

Análise feita sobre o `laudo-cs-0044.pdf` gerado pela aplicação. São 14 páginas onde ~10 são repetição do mesmo conteúdo. Abaixo o que está errado e como corrigir.

## Problemas encontrados

### 1. Nome do cliente no texto vem da proposta
No teste foi usada uma proposta de outro cliente, então a introdução saiu com "SETEL CONSTRUTORA LTDA" enquanto o cabeçalho traz o cliente do agendamento. Não é erro de cabeçalho, mas mostra que hoje a camada `proposta` tem prioridade sobre a camada `cadastro` para o nome do cliente.

Ajuste: para os campos de identidade (nome do cliente, unidade, modalidade, tipo de ação, nível), o cadastro do agendamento passa a vencer a proposta — o documento nunca cita um cliente diferente do agendado. A proposta continua vencendo nos campos técnicos/comerciais (bicos, comboio, comunicação, terminal, bitola, tensão, solução, escopo). Quando o nome do cliente da proposta divergir do cadastro, isso vira uma divergência no painel "Proposta × Campo" (útil para detectar proposta anexada no mapeamento errado).


### 2. Seção 2.3 repetida 14 vezes com conteúdo idêntico
"Objeto do mapeamento" gerou 2.3.1 a 2.3.14 com nomes de produtos do catálogo ("APE SAAF V2", "MICRO TERMINAL 5 MIFARE", "BASE MODEM AMPLIFICADA...") em vez de identificação de objetos (placas/prefixos/pistas). Todos com o mesmo parágrafo, a mesma tabela de produtos e a mesma tabela de materiais.

Correção:
- `ids_objetos` só é aceito quando parece identificação real de objeto (placa, prefixo, "Pista 1", tanque, frota). Listas que batem com descrições do catálogo de produtos são descartadas e não viram seções.
- Deduplicação e limite de itens; sem identificação válida, gera-se uma única seção com o objeto do escopo.
- Quando várias seções teriam exatamente a mesma tabela de produtos/materiais, a tabela é impressa uma única vez em "Produtos e materiais aplicáveis" e as seções por objeto ficam só com o parágrafo descritivo.

### 3. Observações técnicas repetidas
"Obs.: T1000 compatível com leitura RFID" e "Obs.: Terminal T850 não recebe GPS" se repetem em cada objeto. Passam a ser consolidadas uma única vez ao final da seção 2.3.

### 4. Tabelas quebradas entre páginas
Nas páginas 4 a 11 aparecem títulos com tabela vazia, cabeçalhos de tabela em branco e linhas soltas sem cabeçalho.

Correção no renderizador:
- Título de tabela nunca fica sozinho no fim da página (fica junto do cabeçalho e da primeira linha).
- Ao quebrar a página no meio de uma tabela, o cabeçalho de colunas é redesenhado na página seguinte com "(cont.)".
- Nunca desenhar cabeçalho de tabela sem nenhuma linha.

### 5. Texto com acentuação corrompida
"AutomatizaÁo do abastecimento de combustÌvel" — texto extraído da proposta com codificação errada. Será aplicada uma normalização na extração (correção dos padrões de mojibake mais comuns) antes de gravar o escopo, e a mesma limpeza na montagem do laudo.

### 6. Numeração e rótulos
- Aparecem 2.2.1 (WiFi) e 2.2.3 (Rádio 2.4GHz) sem 2.2.2 quando não há 4G: a numeração dos subitens passa a ser sequencial conforme o que é realmente incluído.
- "referente à instalacao" → rótulos normalizados: Instalação / Upgrade, Presencial / Remoto, Nível 1/2/3.
- Alertas técnicos hoje aparecem antes da introdução, soltos no topo. Passam a ficar logo após a introdução, em bloco identificado como "Observações técnicas relevantes".

### 7. Campos frágeis
- "marca/modelo do objeto" saiu como "AREWWE" (resposta livre sem validação) e "vazão" ficou pendente. Quando o valor não tem sentido (curto demais, sem letras/dígitos plausíveis), o campo vira `[CONFIRMAR: ...]` em vez de imprimir lixo, e aparece como pendente na revisão para o especialista corrigir.

## Detalhes técnicos

- `src/lib/laudo/montar.server.ts`: separa as camadas em `cadastroIdentidade` (prioridade sobre a proposta) e `cadastroComplementar`, mantendo a precedência `manual > formulario > cadastro(identidade) > proposta > cadastro > IA`.
- `src/lib/proposta/para-laudo.ts`: filtro/validação de `ids_objetos` contra o catálogo de produtos; normalização de acentuação.
- `src/lib/laudo/template.ts`: numeração dinâmica em 2.2; consolidação de produtos/materiais e das notas; seção única quando não há objetos válidos; alertas movidos para depois da introdução; normalização de rótulos.
- `src/lib/pdf-laudo.server.ts`: `table()` com repetição de cabeçalho na quebra, bloco título+cabeçalho+1ª linha mantido junto e guarda contra tabela sem linhas.
- Novo helper de sanitização de texto (mojibake + rótulos) usado por proposta e laudo.

## Fora de escopo

- Mudança de identidade visual do PDF (cores, capa, sumário) — pode ser feita depois.
- Seção de fotos do mapeamento e página de assinatura — proponho em uma etapa separada.
