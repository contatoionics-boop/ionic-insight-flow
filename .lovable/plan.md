# Editor do Resultado de Mapeamento Técnico (camada sobre o laudo gerado)

O gerador atual permanece intacto. Adicionamos uma etapa de revisão editável entre a geração automática e a emissão do PDF.

## O que já existe hoje (verificado no código)

- `src/lib/laudo/template.ts` monta o documento como **lista de blocos tipados** (`heading`, `paragraph`, `bullets`, `table`, `notes`, `alert`, `image`) — já é estrutura por blocos, não HTML.
- Regras e catálogos: `regras.ts`, `catalogo-produtos.ts`, `figuras.ts`; variáveis extraídas em `extrair.server.ts` com precedência manual > formulário > proposta > cadastro > IA.
- Montagem e persistência: `montar.server.ts` grava `casos.laudo_variaveis` e `casos.laudo_conteudo` (jsonb com `{ gerado_em, blocos }`).
- Emissão: `pdf-laudo.server.ts` percorre os blocos por tipo; `laudo.functions.ts` expõe `gerarLaudo`, `carregarLaudo`, `salvarVariaveisLaudo`, `confirmarAlertaLaudo`, `gerarPdfLaudo`.
- Revisão atual: `LaudoPanel.tsx` só permite preencher variáveis pendentes e remontar; hoje **toda remontagem sobrescreve o conteúdo inteiro**.
- Numeração das seções é fixa no template (`"2.1"`, `"2.3.1"`…) e os ids dos blocos são sequenciais por geração (`h-1`, `p-2`), portanto não sobrevivem a mudanças de estrutura.

Aproveitamos tudo isso; nada é reescrito.

## O que muda

### 1. Blocos ganham metadados de edição
Cada bloco passa a ter, além do que já tem: `chave` (identidade estável), `origem` (`automatic` | `dynamic` | `manual`), `editado_manualmente`, `conteudo_original`, `editavel`, `removivel`, `oculto`, e `parent` (chave do heading pai) para hierarquia e drag-and-drop. Blocos gerados recebem esses campos na montagem, sem alterar a lógica de regras.

A `chave` estável é derivada do conteúdo gerado (tipo + numeração/título + ordinal), para que a mesma seção seja reconhecida entre gerações mesmo mudando de posição.

### 2. Mesclagem em vez de sobrescrita
Novo módulo `src/lib/laudo/mesclar.ts`: ao remontar, compara os blocos recém-gerados com os salvos.

- Bloco automático não tocado → atualizado com o valor novo.
- Bloco com `editado_manualmente` → **mantém a edição**; se o valor gerado mudou, registra um conflito (valor do formulário × conteúdo atual) exibido na tela com as opções Manter edição / Atualizar com formulário / Comparar.
- Blocos criados pelo especialista → preservados na posição relativa (ancorados na chave do bloco anterior).
- Blocos removidos pelo especialista → permanecem ocultos, não ressuscitam.

Isso resolve o ponto crítico: correção de formulário não destrói 30 minutos de ajuste.

### 3. Numeração automática e hierarquia
A numeração deixa de ser string fixa: passa a ser recalculada por `src/lib/laudo/numeracao.ts` a partir do nível de cada heading, na ordem final dos blocos (inclusive os manuais). Inserir "Instalação elétrica" depois de 2.4 gera 2.5 automaticamente; inserir entre 2.2 e 2.3 renumera o resto. Subníveis até 4 dígitos (2.1.1.1). O template continua emitindo os títulos; a numeração é derivada.

### 4. Editor (aba "Documento" na revisão)
Sobre o painel atual, dois modos:

- **Editar**: cada bloco mostra, ao passar o mouse, ações discretas — editar, adicionar abaixo, mover, duplicar, excluir (quando permitido). Entre blocos, um botão `+` com o menu: Texto, Tópico, Subtópico, Subnível, Tabela, Imagem, Observação técnica, Lista, Quebra de página.
- **Visualizar**: render limpo, idêntico à emissão, sem controles.

Edição de texto é conteúdo puro (sem escolha de fonte, cor, tamanho ou margem) — a identidade visual continua no template/PDF.

Novos tipos de bloco: `observacao` (caixa padronizada "OBSERVAÇÃO TÉCNICA") e `pagebreak`. `image` e `table` ganham edição.

### 5. Blocos de imagem e tabela
- Imagem: upload para o bucket existente, substituir, remover, legenda, descrição abaixo, alinhamento e largura (limitada a presets do template). Imagens vindas do formulário aparecem por regra; alterá-las no documento não altera o arquivo original da resposta.
- Tabela: editar células, adicionar/remover linha e coluna, inserir nova tabela. Só dados — o desenho é do template.

### 6. Campos [CONFIRMAR]
Continuam sendo gerados. No modo edição ficam destacados como "Informação pendente" com campo inline; ao preencher, grava a variável (fluxo atual de `salvarVariaveisLaudo`) e o marcador some. No modo visualização, um aviso no topo: "Existem N informações pendentes de confirmação".

### 7. Árvore lateral e drag-and-drop
Painel lateral com a árvore de seções (incluindo as criadas manualmente), clicável para navegar. Reordenação por arrastar respeitando hierarquia: mover um heading leva junto seus blocos filhos até o próximo heading de nível igual ou superior.

### 8. Emissão
`gerarPdfLaudo` passa a usar o conteúdo mesclado e a numeração recalculada, ignorando blocos ocultos e renderizando os novos tipos. O DOCX fica preparado (mesma árvore de blocos), mas não entra nesta entrega.

## Detalhes técnicos

- Sem nova tabela: o documento continua em `casos.laudo_conteudo`, com o schema de bloco estendido (campos novos opcionais, retrocompatível com laudos já salvos).
- Novos módulos: `src/lib/laudo/numeracao.ts`, `src/lib/laudo/mesclar.ts`; tipos estendidos em `src/lib/laudo/tipos.ts`.
- Novas server fns em `src/lib/laudo.functions.ts`: `salvarDocumento` (blocos editados), `resolverConflito`, `restaurarBloco`. Todas com `requireSupabaseAuth`. `gerarLaudo`/`montarESalvarLaudo` passam a mesclar em vez de sobrescrever.
- UI: `src/components/laudo/` ganha `DocumentoEditor.tsx`, `BlocoEditavel.tsx`, `AdicionarBloco.tsx`, `ArvoreDocumento.tsx`, `ConflitoDialog.tsx`; `LaudoPanel.tsx` continua responsável por variáveis e alertas.
- `pdf-laudo.server.ts` ganha os casos `observacao` e `pagebreak` e usa a numeração derivada.

## Entrega em etapas

1. Tipos estendidos + numeração automática + mesclagem (sem UI nova) — laudos atuais continuam idênticos.
2. Editor de blocos: texto, tópicos/subtópicos, observação, lista, exclusão/duplicação, modos editar/visualizar.
3. Tabela e imagem editáveis, incluindo upload e legenda.
4. Conflitos com o formulário, árvore lateral e drag-and-drop.
5. Emissão do PDF a partir do documento revisado, com aviso de pendências.
