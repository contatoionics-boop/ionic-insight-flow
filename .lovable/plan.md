# Resultado de Mapeamento Técnico — documento estruturado

Hoje o PDF é um espelho do formulário: imprime pergunta/resposta na ordem das seções. O objetivo é gerar o **laudo técnico** no padrão FR-31-10 (igual ao PDF anexado): seções fixas, textos padrão com variáveis, blocos condicionais, blocos repetíveis por objeto e tabelas de produtos/materiais.

## Como vai funcionar

1. O agente responde o mapeamento normalmente (nada muda no chat).
2. Ao abrir a revisão, o sistema **monta o laudo**: extrai as variáveis das respostas, aplica as regras e gera as tabelas.
3. O especialista/IAM vê o laudo montado numa aba **"Laudo"**, com cada campo faltante marcado como `[CONFIRMAR: ...]` em destaque, e pode editar textos, quantidades e linhas das tabelas.
4. Só então gera o PDF final, no layout do documento anexo.

## Extração de variáveis (híbrida)

- Cada pergunta ganha um campo opcional **"chave do laudo"** no editor de formulários (ex. `nome_cliente`, `bitola_bico`, `terminal_atual`, `comunicacao_tipos`, `nivel_servico`, `marca_veiculo`, `vazao`, `rfid`, `cliente_ja_tem_saaf`, `qtd_bicos`, `tipo_objeto`, `ids_objetos`, `compartimento_dimensao`).
- Onde houver chave, o valor vai direto (determinístico) e é considerado confiável.
- Onde faltar, uma passada de IA (OpenAI, já configurado) lê todas as respostas do caso e propõe o valor com um nível de confiança.
- **Confiança baixa nunca vira valor no laudo.** Abaixo do limiar (0,8), o campo entra como `[CONFIRMAR: <campo>]` mesmo que a IA tenha proposto algo; a sugestão fica visível só na tela de revisão, como sugestão a aceitar, nunca impressa direto no PDF. A IA não "chuta" bitola, nível, dimensão ou código de produto.
- Toda variável de origem IA fica marcada com origem e confiança no JSON salvo, para a revisão distinguir o que veio do formulário do que foi inferido.
- O que sobrar sem valor vira `[CONFIRMAR: <campo>]` no documento — nunca é omitido em silêncio.
- O JSON de variáveis fica salvo no caso, para o laudo ser reprodutível e editável.


## Estrutura do documento gerada

Capa/cabeçalho com Empresa/Unidade, data, analista, especialista e agente (ou "Atendimento Remoto"), código/revisão do formulário.

1. **Introdução** — template com `nome_cliente`, `modalidade`, `tipo_acao`, `objeto_escopo` + parágrafo fixo.
2. **Requisitos de infraestrutura**
   - 2.1 Equipamentos de TI e banco de dados — 4 variantes (A: specs completas + tabelas de servidor/PC/bancos; B reduzida; B completa com slot GSM; D "já dispõe de automação"), com a omissão prevista para posto fixo + SAAF existente.
   - 2.2 Transferência de dados: 2.2.1 WiFi (fixo), 2.2.2 GSM/4G (condicional), 2.2.3 Rádio 2.4GHz (fixo).
   - 2.3 Objeto do mapeamento — repetível: um bloco por grupo de terminal (2.3.1, 2.3.2, …) com título dinâmico, parágrafo técnico do veículo/pista, tabela de Produtos e tabela de Materiais próprias; numeração automática.
   - 2.4 Bicos de abastecimento — texto completo no Nível 2, reduzido/omitido no Nível 1; tabela fixa de dimensões e parágrafo fixo de homologação.
3. **Instruções gerais** — fixo, com `nome_solucao`; rodapé IAM fixo.

Condicionais técnicas aplicadas no texto e nas tabelas: bico 1" + Nível 2 → recomendar 3/4" e adicionar niple/luva; T850 → nota de upgrade GPS; conversor 24/12VCC → alerta de bloqueio (não homologado); item que o cliente já possui → marcado como "verificar se já possui"; RFID → nota de compatibilidade do T1000. Notas de rodapé com marcadores `*`, `#`, `@`, `º`.

## Tabelas

**Produtos IONICS** — catálogo fixo no código, com as regras que você definiu:
- Terminal: T1000 `2.0.08.00.00S`, T1000 GPS `2.0.08.00.00T`, T1000 Multi BW `2.0.08.00.00V` (RFID ou múltiplos bicos).
- Comunicação: WIFI `2.0.02.02.001`; 4G WIFI Antena Externa `2.0.02.02.004`.
- NLDIV Wireless **somente no Nível 2**: 1/2" `2.0.03.01.025`, 3/4" `2.0.03.01.026`, 1" `2.0.03.01.027` (o NLDIV é o que define o nível).
- Válvula solenoide 1" 12V TPL `2.2.08.04.00F` — sempre.
- Sensor: industrial `2.0.01.03.008` (posto/pista) ou bloco medidor `2.0.01.03.015` (comboio).
- Fonte chaveada, repetidor, caixa de painel `2.2.0D.02.01M` e base modem para posto/pista, conforme o caso.
- A variante 24V "CMB" **não entra** até sua confirmação.

**Materiais de infraestrutura** — tabela de catálogo **editável em tela** (nova área em Configurações): código, descrição, aplicação, unidade, regra de inclusão (bitola, nível, tipo de objeto, área classificada) e quantidade padrão. Populada inicialmente com niples, luva de redução, cotovelo, cabos, contator, prensa-cabo e luva EX. O motor gera as linhas a partir dessa tabela, sem deploy para mudanças.

## Detalhes técnicos

- Banco: `laudo_variaveis` (jsonb) + `laudo_conteudo` (jsonb com o documento montado e as edições) em `casos`; nova tabela `catalogo_materiais` com RLS (leitura autenticada, escrita para super_admin/IAM/especialista) e grants; coluna `chave_laudo` em `perguntas`.
- Novo módulo `src/lib/laudo/` (server-only): `variaveis.ts` (extração híbrida), `catalogo-produtos.ts` (seed fixo + regras), `regras.ts` (condicionais), `template.ts` (blocos e slots) e `montar.ts` — devolve uma árvore de blocos tipada (`heading`, `paragraph`, `bullets`, `table`, `notes`, `alert`).
- Novo renderer `src/lib/pdf-laudo.server.ts` usando pdf-lib (mesmo padrão do atual): capa, numeração automática, tabelas com bordas, notas de rodapé, rodapé IAM. O gerador atual de pergunta/resposta continua disponível como "PDF de respostas (bruto)".
- Server fns em `src/lib/laudo.functions.ts`: `montarLaudo`, `salvarLaudo`, `gerarPdfLaudo` — todas com `requireSupabaseAuth`.
- UI: aba "Laudo" em `app.review.$id.tsx` com editor por bloco e destaque dos `[CONFIRMAR]`; tela de catálogo de materiais em Configurações.

## Entrega em etapas

1. Banco + catálogo de materiais editável + `chave_laudo` nas perguntas.
2. Motor de template (seções, condicionais, repetição, tabelas) + extração híbrida.
3. Renderer PDF no padrão FR-31-10.
4. Tela de revisão do laudo com edição e geração final.
