# Laudo estruturado alimentado pela proposta comercial

## Problema

No laudo estruturado da revisão, a maioria das variáveis aparece como "pendente" porque hoje elas só podem vir de duas fontes: respostas do formulário (quando a pergunta tem chave de laudo) ou inferência da IA sobre essas respostas. A proposta comercial anexada ao mapeamento já contém boa parte dessas informações (nível, quantidade de bicos, comboio, comunicação, cliente, escopo vendido), mas hoje ela só é usada para comparar divergências — nunca para preencher o laudo.

Também há dados que já existem no próprio agendamento (cliente, unidade, modalidade, nível, tipo de solicitação) e que não estão sendo aproveitados como fonte das variáveis.

## Objetivo

O laudo passa a ser montado com um encadeamento de fontes: formulário → proposta → cadastro do agendamento → IA. Só sobra "pendente" o que realmente não existe em nenhuma dessas fontes, e esses campos continuam editáveis manualmente na revisão.

## Como vai funcionar

### 1. Nova origem "proposta"

As variáveis do laudo ganham a origem `proposta` (hoje existem `formulario`, `ia`, `manual`, `ausente`). Na tela de revisão o campo mostra um selo "proposta" (com o percentual de confiança), no mesmo padrão do selo "IA".

Ordem de precedência ao montar o laudo:

```text
manual  >  formulario  >  proposta  >  cadastro (agendamento)  >  IA  >  pendente
```

Nada preenchido pela proposta sobrescreve o que o agente respondeu em campo — o valor de campo sempre vence, e a diferença entre os dois continua virando divergência no painel "Proposta × Campo".

### 2. Extração mais rica da proposta

A extração do PDF passa a devolver, além do escopo atual (nível, bicos, comboio, comunicação, fase, itens inclusos/não inclusos), os campos comerciais que alimentam o laudo:

- nome do cliente / razão social
- nome da solução contratada (ex.: SAAF)
- tipo de ação (instalação ou upgrade)
- objeto do escopo e tipo do objeto (posto, pista, frota, comboio)
- identificação dos objetos (placas/prefixos, quando listados)
- terminal previsto (T850/T1000), RFID, bitola, tensão
- quantidade de comboios e de pistas

Cada campo continua com valor + confiança + trecho de origem; abaixo do limiar de confiança o campo não é usado (continua pendente, sem palpite).

### 3. Mapa proposta → chaves do laudo

Um módulo novo converte o escopo extraído nas chaves do laudo (`nivel_servico`, `qtd_bicos`, `comboio`, `comunicacao_tipos`, `nome_cliente`, `nome_solucao`, `tipo_acao`, `objeto_escopo`, `tipo_objeto`, `ids_objetos`, `terminal_atual`, `rfid`, `bitola_bico`, `tensao_veiculo`), já no formato/vocabulário esperado (por exemplo `nivel_2`, `sim`/`nao`, "WiFi", "4G").

### 4. Preenchimento pelo cadastro do agendamento

Antes de recorrer à IA, o sistema completa com o que já está no caso e na hierarquia empresa/matriz/unidade: nome do cliente, modalidade, nível, tipo de solicitação, responsável e identificação da unidade. Isso remove os "pendentes" que hoje aparecem mesmo com o dado existindo no agendamento (caso de "Tipo de ação" e "Modalidade" no print).

### 5. Recálculo e edição

- A montagem/regeração do laudo (automática na finalização e pelo botão "Regerar") usa a nova cascata.
- Quando a proposta é anexada ou reextraída depois, o laudo é remontado para incorporar os novos valores, preservando o que veio do formulário e as edições manuais.
- Na revisão, o especialista continua podendo editar qualquer campo; ao salvar, o valor vira `manual` e nunca é sobrescrito.
- A comparação Proposta × Campo passa a considerar apenas valores de origem `formulario`/`manual` como "campo", para não comparar a proposta com ela mesma (evita divergência falsa).

## Detalhes técnicos

- `src/lib/proposta/tipos.ts`: novos campos no `EscopoProposta` (+ rótulos e formatação), mantendo compatibilidade com propostas já extraídas.
- `src/lib/proposta/extrair.server.ts`: prompt e schema Zod ampliados para os novos campos.
- Novo `src/lib/proposta/para-laudo.ts` (puro): escopo → `VariaveisLaudo` parciais com `origem: "proposta"`.
- Novo helper de cadastro (`origem: "cadastro"`) derivado do caso/unidade/matriz/empresa.
- `src/lib/laudo/tipos.ts`: `OrigemVariavel` ganha `"proposta"` e `"cadastro"`.
- `src/lib/laudo/extrair.server.ts`: `extrairVariaveis` recebe as camadas extras e aplica a precedência antes de chamar a IA (reduzindo também o custo da chamada, que passa a pedir só o que sobrou).
- `src/lib/laudo/montar.server.ts`: carrega a proposta mais recente `pronta` do caso e injeta as camadas na extração.
- `src/lib/proposta/processar.server.ts`: após extrair a proposta, remonta o laudo do caso.
- `src/components/laudo/LaudoPanel.tsx`: selos "proposta" e "cadastro" e ajuste da regra do selo "pendente" (só quando não há valor).
- `src/lib/proposta/comparar.ts`: filtra as variáveis por origem antes de comparar.

## Fora de escopo

- Alterar o layout/PDF do laudo.
- Reajuste automático de preços na proposta.
- Extração de PDFs escaneados (sem camada de texto) — segue com preenchimento manual.
