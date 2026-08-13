# Proposta comercial × mapeamento: extração e alerta de divergências

## Objetivo

Anexar o PDF da proposta comercial no agendamento do mapeamento, extrair dela o escopo vendido e comparar automaticamente com o que o agente registrou em campo, gerando um painel de divergências para a revisão (Pablo) — sem bloquear o preenchimento do formulário.

## O que já existe e será reaproveitado

- Motor de laudo estruturado com variáveis extraídas do formulário (`laudo_variaveis`): já traz `nivel_servico`, `qtd_bicos`, `bitola_bico`, `comunicacao_tipos`, `tipo_objeto`, `terminal_atual`, `area_classificada`, `usa_conversor_24_12`.
- Extração híbrida determinística + IA (`src/lib/laudo/extrair.server.ts`) usando OpenAI com a `OPENAI_API_KEY` do projeto.
- Blocos de alerta com severidade (`info` / `bloqueante`) e confirmação humana registrada em `casos.laudo_alertas`.
- Tela de revisão com aba de laudo (`LaudoPanel`) e fila de revisão.
- Upload de arquivos em bucket privado do Supabase e trilha de eventos (`mapeamento_eventos`).

## Fluxo proposto

```text
Novo mapeamento  ->  anexa proposta (PDF)  ->  extração do escopo vendido
                                                        |
Agente responde o formulário  ->  variáveis do laudo  ->  comparador
                                                        |
                               painel "Proposta x Campo" na revisão + alertas no laudo
```

## Etapas

### 1. Armazenar a proposta
- Novo bucket privado `propostas` (upload autenticado, leitura por URL assinada).
- Nova tabela `propostas_comerciais`: caso/agendamento, arquivo, status da extração (`pendente`, `processando`, `pronto`, `erro`), escopo extraído (JSON), texto bruto, timestamps. Com GRANTs e RLS iguais aos demais objetos do mapeamento (agente do caso, criador, admin/IAM/super_admin).
- Campo opcional de upload na tela de agendamento (`app.new-case.tsx`) e também na tela do mapeamento, para anexar depois.

### 2. Extrair o escopo vendido
- Server function `extrairProposta`: lê o PDF, extrai o texto (biblioteca JS pura compatível com o runtime de edge) e envia a um modelo OpenAI com saída JSON validada por Zod.
- Campos extraídos: nível de automação contratado (1/2), quantidade de bicos ou pistas, comboio (sim/não e quantidade), módulo de comunicação (Wi-Fi comodato / 4G adicional), fase de automação contratada (1 a 4), itens inclusos e itens não inclusos.
- Cada campo guarda valor + confiança + trecho de origem. Confiança baixa vira "não identificado na proposta" em vez de palpite.
- Reprocessamento manual ("Reextrair") e edição manual dos campos extraídos na revisão.

### 3. Comparador proposta × formulário
- Módulo `src/lib/proposta/comparar.ts`, puro e testável, recebendo o escopo da proposta + as variáveis do laudo e devolvendo uma lista de divergências com severidade e explicação.
- Regras iniciais:
  - Nível contratado × nível viável em campo: Nível 2 sem Wi-Fi/GPRS declarado ou com sinal fraco = divergência alta (Nível 2 exige módulo bico wireless + sensor de abastecimento na bomba).
  - Quantidade de bicos contratada × quantidade mapeada (com cálculo do delta e impacto proporcional em válvulas solenoides: 12V para T1000 padrão, 24V para CMB).
  - Comboio previsto × comboio encontrado (ausente ou a mais).
  - Tipo de bomba/adaptação: bomba elétrica não aceita adaptação de pulso — conflita com o padrão assumido na proposta.
  - Bitola: bico automatizado passa 1" para 47 mm; se o bocal for estreito, recomendar 3/4" e sinalizar impacto na proposta.
  - Fase/telemetria: Nível 3 exige hardware adicional no veículo — se contratado sem previsão no mapeamento, sinalizar.
  - Comunicação: 4G adicional previsto × Wi-Fi encontrado (ou o inverso).
- Cada divergência traz: código, título, valor da proposta, valor do campo, severidade (`atencao` / `alta`), recomendação de ajuste comercial.

### 4. Onde as divergências aparecem
- Recalculadas ao finalizar o mapeamento (junto com a montagem do laudo) e sob demanda pelo botão "Recomparar".
- Persistidas em `casos.divergencias_proposta`.
- Nova aba/painel "Proposta × Campo" na tela de revisão: resumo (n divergências, n de severidade alta), tabela lado a lado, link para baixar a proposta e botão de recomparar.
- Marcador na lista de mapeamentos e na fila de revisão quando houver divergência alta.
- Bloco de alertas no laudo (severidade `info`) listando as divergências, com o mesmo mecanismo de confirmação já existente ("corrigido" / "ciente do risco" com justificativa).
- Eventos na timeline: proposta anexada, extração concluída, divergências calculadas, divergência confirmada.

### 5. Sem bloqueio
- O agente não vê nem é interrompido pelas divergências; o chat segue igual. Toda a sinalização é da revisão para dentro.

## Detalhes técnicos

- Extração de texto do PDF precisa de biblioteca pura JS compatível com o runtime serverless (sem binários nativos); PDFs 100% escaneados ficam com status `erro: sem texto` e caem no preenchimento manual do escopo.
- A extração roda em server function autenticada, chamada logo após o upload, com status persistido para a UI acompanhar.
- Comparação usa as variáveis já normalizadas do laudo; chaves ausentes viram "não informado" e geram uma pendência leve, não uma divergência falsa.
- Novas chaves de laudo podem ser necessárias para tipo de bomba e qualidade de sinal, caso ainda não estejam mapeadas no formulário.

## Fora de escopo nesta entrega

- Reajuste automático de valores/preços da proposta.
- Geração de proposta revisada em PDF.
