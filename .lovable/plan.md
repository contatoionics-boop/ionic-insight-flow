# Formulário padrão FR-29-10 — Mapeamento Técnico SSG Frota (Terminal Comboio / Pista)

## Situação atual

Hoje existe apenas um formulário ativo no sistema ("Formulario de Vistoria Técnica - Automação IONICS"), com 6 seções e **15 perguntas**, quase todas do tipo sim/não. O documento FR-29-10 enviado tem cerca de **60 campos** entre dados técnicos, medidas, checkboxes e **21 registros fotográficos obrigatórios com instrução de enquadramento** — praticamente nada disso está no formulário atual. Nenhuma pergunta atual tem `chave_laudo`, então nada alimenta o laudo estruturado automaticamente.

## O que será feito

Criar um novo formulário **padrão** ("FR-29-10 — Mapeamento Técnico SSG Frota — Terminal Comboio / Pista", revisão 00), ativo, contendo **todos** os campos do documento, organizado exatamente na ordem e numeração do original.

### Seção 0 — Cabeçalho / Identificação
Cliente / Unidade, Pista, Data, Responsável, Contato.
(Pré-preenchidos a partir do cadastro do agendamento, como já ocorre hoje; agente só confirma.)

### Seção 1 — Descrição geral do dispositivo de abastecimento (bloco em cartão)
Tipo de bomba (Eletrônica/Mecânica), Marca/Modelo da bomba, Vazão fornecida (L/min), Tensão de alimentação (220VCA/380VCA), Marca/Modelo do Registrador Mecânico, Marca/Modelo do Bloco Medidor, Diâmetro da saída do Bloco Medidor, Diâmetro da mangueira de abastecimento, Marca/Modelo do bico, Diâmetro da ponteira do bico, Comprimento da ponteira do bico, Diâmetro da entrada do corpo do bico.

### Seção 1.1 — Registro fotográfico do dispositivo (bloco de fotos)
12 fotos, cada uma com o texto de instrução do documento como orientação ao agente:
frontal 1 m do registrador; lateral direita 90° 1 m; lateral esquerda 90° 1 m; frontal do dispositivo; lateral direita do dispositivo; lateral esquerda do dispositivo; frontal 1 m do bloco medidor; lateral direita 90° do bloco medidor; lateral esquerda 90° do bloco medidor; bico 70° lateral; conexão da mangueira no bico; conexão da mangueira no bloco medidor.
Mais 2 fotos do descanso/suporte do bico (panorâmica 2 m e aproximada 70 cm).

### Seção 2 — Descrição geral da pista (bloco em matriz)
Área coberta (sim/não), possui controle/automação (sim/não), possui suporte para o bico (sim/não), distância da ilha até a pista, altura do registrador mecânico, e as 4 distâncias do bloco medidor (frente, trás, direita, esquerda) — cada uma com **dois campos**: objeto identificado + distância. Nota fixa: em bomba eletrônica, considerar a bomba no lugar do bloco medidor.

### Seção 2.1 — Registro fotográfico da pista (bloco de fotos)
5 fotos: panorâmica frontal de toda a pista; frontal a 5 m; traseira a 5 m; diagonal direita 45° a 7 m; diagonal esquerda 45° a 7 m.

### Seção 3 — Processo de abastecimento e transferência de dados
Combustível fornecido (Gasolina/Etanol/Diesel S10/Diesel S500), Tipos de veículos que abastece (múltipla: Motos/Leves/Pesados/Máquinas/Comboios), Potência do sinal GPRS/2G, Estabilidade do sinal GPRS/2G, Operadora local (Vivo/Claro/TIM/Oi/Outras + campo livre), Dispõe de Wi-Fi (sim/não), Frequência do Wi-Fi (2.4/5 GHz/Outra), Potência do Wi-Fi, Estabilidade do Wi-Fi, Velocidade da conexão.

### Seção 3.1 — Registro fotográfico de sinal (bloco de fotos)
Print do Aquário Analyzer (sinal da operadora em 2G); print do WiFi Network Analyzer com SSID/Intensidade/Detalhes da rede; print do gráfico "Redes" com legenda. Texto de instrução sobre instalar os apps entra como orientação da seção.

### Seção 4 — Observações finais
Anomalias observadas; recomendações/sugestões (campos livres, mantidos do formulário atual).

## Regras de comportamento

- **Condicionais:** os campos de Wi-Fi (frequência, potência, estabilidade, velocidade e os prints do WiFi Analyzer) só aparecem se "dispõe de Wi-Fi" = Sim. Campos ligados a registrador mecânico ganham a observação de equivalência quando a bomba é eletrônica.
- **Obrigatoriedade:** todos os campos técnicos e todas as fotos são obrigatórios; campos de observação são opcionais.
- **Blocos:** cada seção usa `pergunta_blocos` (cartão para dados, matriz para as distâncias, fotos para os registros) — assim o modo Checklist e o modo Chat já agrupam corretamente, sem perguntar campo a campo.
- **Laudo estruturado:** as perguntas relevantes recebem `chave_laudo` (tipo_bomba, vazao, bitola_bico, qtd_bicos, comunicacao_tipos, qualidade_sinal, responsavel_cliente, nome_cliente, tipo_objeto, comboio etc.), para o PDF FR-31-10 continuar sendo preenchido automaticamente.
- O formulário antigo continua existindo para mapeamentos já em andamento; o novo passa a ser o padrão selecionado ao criar mapeamentos.

## Detalhes técnicos

- Uma migração SQL insere `formularios` (codigo `FR-29-10`, revisão `00`, elaborado/aprovado por Pablo Haun), `secoes`, `pergunta_blocos`, `perguntas` e `opcoes_pergunta`, com `ordem` explícita em tudo.
- Tipos usados: `texto`, `numero`, `data`, `selecao_unica`, `checkbox`, `toggle`, `foto`.
- Condicionais via `condicional_pergunta_id` / `condicional_operador` / `condicional_valor` já suportados pelo schema.
- `validar_imagens_ia` fica desligado (análise de imagem por IA segue desativada, conforme decidido antes).
- Nenhuma mudança de schema é necessária — apenas dados.
