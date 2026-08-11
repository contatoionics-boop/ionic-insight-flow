# Desenho técnico do Suporte do Bico no laudo (Nível 2)

Adicionar suporte a figuras no motor de laudo e incluir, de forma automática, o desenho técnico fixo do Suporte do Bico na seção 2.4 quando o nível de serviço for 2.

## O que muda para o usuário

- Laudos de Nível 2 passam a trazer, na seção 2.4 (Bicos de Abastecimento), o desenho do Suporte do Bico com legenda, logo após o parágrafo de homologação e a tabela de dimensões.
- Laudos de Nível 1 continuam sem esse bloco.
- A imagem é única e institucional (não é por cliente): fica hospedada como asset fixo e é reaproveitada em todo laudo gerado, tanto na prévia da aba "Laudo" quanto no PDF final.

## Etapas

### 1. Novo tipo de bloco `image`
Em `src/lib/laudo/tipos.ts`, acrescentar à união `BlocoLaudo`:

```
{ id: string; tipo: "image"; url: string; legenda: string | null;
  larguraMax?: number; alt: string }
```

Nenhuma alteração nas funções de pendência/alertas (figura não gera pendência).

### 2. Asset fixo
Subir a imagem de referência via Lovable Assets, gerando `src/assets/suporte-bico.png.asset.json`, e expor a URL numa constante (`FIGURA_SUPORTE_BICO`) em `src/lib/laudo/catalogo-produtos.ts` ou num novo `src/lib/laudo/figuras.ts`.

Observação: a imagem anexada nesta conversa é a página do documento com os desenhos do bico automatizado/NLDIV. Se o desenho definitivo da barra chata (suporte) for outro arquivo, basta substituir o asset — a regra e o bloco não mudam.

### 3. Regra condicional na seção 2.4
Em `src/lib/laudo/template.ts`, dentro da montagem de 2.4, após o parágrafo de homologação e a tabela de dimensões, quando `nivel === "nivel_2"`:

```
parágrafo (NLDIV/linha) → tabela "Dimensões de referência"
→ parágrafo de homologação → bloco image (Suporte do Bico)
```

Com legenda do tipo "Figura X — Suporte do Bico (barra chata) para fixação do bico de abastecimento". A numeração das figuras é sequencial e calculada na montagem, no mesmo padrão da numeração dinâmica já existente.

Para Nível 1, o bloco não é emitido.

### 4. Renderização

- Prévia (`src/components/laudo/LaudoPanel.tsx`): novo `case "image"` renderizando `<img>` centralizado com largura máxima e legenda em texto menor.
- PDF (`src/lib/pdf-laudo.server.ts`): novo caso no `switch` de blocos — buscar os bytes da imagem por `fetch` da URL do CDN (cacheando por execução), embutir com `embedPng`/`embedJpg` do pdf-lib, escalar para a largura útil da página, quebrar página se não couber e desenhar a legenda centralizada abaixo.

## Detalhes técnicos

- pdf-lib já é a engine do PDF; `embedPng` funciona no runtime de Worker desde que a imagem venha por `fetch` (sem acesso a filesystem).
- A URL do asset é estável e imutável, então o download pode ser cacheado em memória por invocação.
- Nada é gravado por caso: a figura é parte do template, não uma variável extraída do formulário, portanto não entra em `laudo_variaveis` nem gera `[CONFIRMAR: ...]`.
