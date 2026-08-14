# FR-31-10 como documento derivado (não transcrição do FR-29-10)

Hoje o motor do laudo (`src/lib/laudo/template.ts`) monta o documento substituindo variáveis dentro de textos fixos: onde a variável falta sai `[CONFIRMAR: ...]`, e onde ela existe sai o valor cru. Não existe camada que transforme dado em parecer. É isso que muda.

## Fluxo alvo

```text
PROPOSTA + FR-29-10 PREENCHIDO + FOTOS
        ↓
BASE DE DADOS DO MAPEAMENTO (variáveis já existentes: laudo_variaveis)
        ↓
ANÁLISE / REGRAS TÉCNICAS  ← camada nova
        ↓
RASCUNHO ESTRUTURADO DO FR-31-10 (blocos técnicos, não campos)
        ↓
REVISÃO DO ESPECIALISTA (editor de blocos, já existe)
        ↓
FR-31-10 FINAL (PDF)
```

## 1. Camada de análise técnica (o que falta)

Novo módulo `src/lib/laudo/analise/` que recebe as variáveis + fotos + catálogo e devolve **achados** tipados (`{ chave, conclusao, recomendacoes[], evidencias[], severidade, confianca }`), não frases prontas.

Regras determinísticas primeiro — nada de IA para decisões técnicas:

- **Comunicação**: Wi-Fi presente + 2.4 GHz + sinal bom → conclusão "rede existente com sinal de boa intensidade" + recomendação de canal fixo/modo estático para evitar sobreposição e interferência; sinal fraco/ausente → recomendar GSM/4G com antena externa; ambos → redundância.
- **Bomba / registrador / bloco medidor**: marca+modelo+tipo viram identificação técnica ("bomba eletrônica Gilbarco Veeder Root/PHX-1120, 75 L/min, 380 V") e disparam a lista de interfaces necessárias.
- **Mangueira/bico/ponteira**: bitola + nível decidem NLDIV, adaptadores (niple/luva) e a recomendação de troca de bitola.
- **Pista/área**: cobertura, distância da ilha, área classificada → posicionamento do gabinete, altura de instalação, distâncias mínimas, necessidade de itens EX.
- **Alertas** continuam pelo `regras.ts` atual (informativo x bloqueante).

Cada achado carrega as variáveis que o originaram, para o especialista ver a evidência.

## 2. Redação dos blocos

Os achados viram blocos de texto por *templates de parecer* (um por achado, com frase técnica completa). Onde o achado existir mas a redação for aberta (descrição da pista, descrição do objeto), uma passada de IA **redige apenas com os dados já validados** — proibida de inventar valor: qualquer variável ausente continua `[CONFIRMAR: ...]`. A IA reescreve, nunca decide.

Resultado: seções como "Transferência de Dados", "Pista de Abastecimento" e "Objeto do Mapeamento" passam a ter parágrafos de conclusão + recomendações, em vez de `Wi-Fi = Sim`.

## 3. Blocos que não existem no formulário

Biblioteca de **blocos padrão** inseríveis pelo especialista (nova tabela `blocos_padrao`: título, corpo em blocos, escopo por cliente/tipo de objeto), com os casos reais:

- 2.3.1 Infraestrutura Padronizada (Outras Unidades INPASA)
- Esboços/layouts de instalação, posicionamento, altura, distâncias mínimas, gabinete
- Textos de instruções gerais reutilizáveis

No editor: botão "Inserir bloco padrão", com busca; o bloco entra como `origem: "manual"` (não é sobrescrito na regeração). Blocos sugeridos automaticamente pelo contexto (ex.: cliente INPASA) entram como `origem: "dynamic"`, marcados como sugestão.

## 4. Fotos no documento

As fotos do FR-29-10 passam a estar disponíveis no editor: painel lateral com miniaturas (URL assinada, mesmo mecanismo do checklist), arrastar para inserir como bloco `image` com legenda editável. Onde a regra técnica exige evidência (ex.: pista, bico, quadro elétrico), o rascunho já insere a foto correspondente.

## 5. Revisão do especialista

O editor de blocos atual (`DocumentoEditor.tsx`) já cobre editar/remover/reordenar/criar. Acrescenta-se:

- Painel "Análise técnica": lista dos achados com evidência, permitindo aceitar/descartar antes de virar texto.
- Marcação visual de origem do bloco (automático / regra técnica / especialista).
- Regeração continua preservando edição manual (`mesclar.ts`), agora também sem ressuscitar achados descartados.

## Detalhes técnicos

- Novo `src/lib/laudo/analise/` (`achados.ts` regras puras, `redacao.ts` templates de parecer, `ia.server.ts` só reescrita) consumido por `montarBlocos`.
- `casos.laudo_analise` (jsonb) guarda achados + decisão do especialista; migração com GRANTs.
- Nova tabela `blocos_padrao` (RLS: leitura autenticada, escrita super_admin/IAM/especialista) + tela em Configurações.
- `template.ts` deixa de concatenar variáveis nas seções 2.2/2.3/2.4 e passa a renderizar os achados; textos fixos de norma permanecem.
- PDF (`pdf-laudo.server.ts`) não muda de layout — só recebe mais blocos `paragraph`/`image`.

## Etapas

1. Camada de achados + redação determinística para comunicação, bomba/bico e pista (maior ganho imediato).
2. Painel de análise técnica na revisão + persistência das decisões.
3. Biblioteca de blocos padrão + tela de gestão.
4. Painel de fotos no editor e inserção automática de evidências.
5. Passada de IA apenas para redação das descrições abertas.
