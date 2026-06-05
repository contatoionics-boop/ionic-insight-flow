# Plano: Auto-preenchimento da 1ª seção do formulário de mapeamento

## Objetivo
Quando o agente técnico abrir uma vistoria, a 1ª seção (dados do cliente/localização) já vem pronta. O formulário pula direto para a 2ª seção. Quando precisar preencher manualmente, há fluxo guiado por CNPJ + CEP + dropdowns em cascata.

## 1. Pré-preenchimento automático ao abrir o link
- No `agent.$token.tsx`, ao carregar o caso, hidratamos as respostas da 1ª seção (ordem mínima) a partir dos dados já cadastrados em `empresas → matrizes → unidades` vinculados ao caso.
- Mapeamento por **tipo de pergunta + heurística no texto** (CNPJ, Razão Social, CEP, Estado, Cidade, Bairro, Endereço, Número, Unidade). Cada match grava `respostas_agente` com `valor_texto`.
- Se TODAS as perguntas obrigatórias da 1ª seção ficarem preenchidas, o `FormRunner` inicia em `step = 1` (segunda seção). Senão, abre na 1ª normalmente.
- A 1ª seção continua acessível pelo botão "Voltar" para ajustes.

## 2. Auto-preenchimento por CNPJ (Prioridade 1)
Quando o agente digita CNPJ na 1ª seção (caso o pré-preenchimento não tenha rolado):
- **Primeiro**: consulta a tabela `matrizes` por CNPJ. Se achar → puxa razão social, lista as `unidades` da matriz num seletor; ao escolher unidade, preenche CEP/UF/Cidade/Bairro/Endereço/Número.
- **Senão**: consulta o último `caso` finalizado cujo CNPJ bate (via join unidade→matriz). Replica endereço operacional da última vistoria.
- **Senão**: cai no fluxo manual (CEP + cascata).

## 3. Preenchimento manual: CEP + cascata
- CEP: já existe `consultarCep` (ViaCEP). Reaproveitar.
- Cascata Estado → Cidade → Bairro → Rua usando **IBGE Localidades API** (online, sem custo, sem chave):
  - Estados: `GET https://servicodados.ibge.gov.br/api/v1/localidades/estados`
  - Cidades por UF: `GET .../estados/{UF}/municipios`
  - **Bairros e ruas não existem no IBGE**. Para esses dois: campo livre com sugestões vindas do ViaCEP quando o CEP foi consultado. Se UF/Cidade forem trocados manualmente, Bairro e Rua voltam a input livre (sem cascata real). Esta limitação é explicitada na UI.

## 4. Componente novo: `EnderecoCascata`
Reusável, fica em `src/components/agent/EnderecoCascata.tsx`. Encapsula:
- input de CEP com lookup
- selects de UF e Cidade (IBGE, cached em memória)
- inputs de Bairro, Logradouro, Número
Usado tanto pelo runner do agente quanto pelo cadastro de Unidades (`app.clients.$empresaId.tsx`) para consistência.

## 5. Integração no FormRunner / FormChat
- `agent.$token.tsx`: após hidratar `state`, calcular `primeiraSecaoCompleta`; passar `initialStep` ao `FormRunner` e `FormChat`.
- `FormRunner`: aceita prop `initialStep` (default 0).
- `FormChat`: mesma prop; pula primeira seção do roteiro.
- Quando a 1ª seção tem perguntas mapeadas (CNPJ/CEP/etc.), renderiza widgets especiais (CNPJ lookup, EnderecoCascata) em vez do input de texto puro.

## 6. Detecção de campos (heurística)
Helper `src/lib/perguntas-mapeamento.ts`:
```ts
detectarCampo(pergunta) → "cnpj" | "razao_social" | "cep" | "uf" | "cidade" 
                       | "bairro" | "logradouro" | "numero" | "unidade" | null
```
Por regex no `texto` da pergunta (case-insensitive, sem acento). Usado tanto para hidratar quanto para renderizar o widget certo.

## Detalhes técnicos

### Arquivos novos
- `src/components/agent/EnderecoCascata.tsx`
- `src/components/agent/CnpjLookup.tsx` 
- `src/lib/ibge.ts` (helpers fetch + cache de UFs/municípios)
- `src/lib/perguntas-mapeamento.ts` (heurística + hidratação)
- `src/lib/cnpj-cache.functions.ts` (server fn: busca matriz/última vistoria por CNPJ)

### Arquivos alterados
- `src/routes/agent.$token.tsx` — hidratação 1ª seção + `initialStep`
- `src/components/agent/FormRunner.tsx` — prop `initialStep`
- `src/components/agent/FormChat.tsx` — prop `initialStep`
- `src/components/agent/FormFields.tsx` — render condicional dos widgets especiais quando `detectarCampo` retorna match
- `src/routes/app.clients.$empresaId.tsx` — reaproveita `EnderecoCascata`

### Sem mudanças de schema
A heurística por texto evita migração. Se quiser robustez maior depois, adicionamos `perguntas.campo_mapeado` numa fase 2.

### Server function nova
`buscarPorCnpj(cnpj)` (autenticada) retorna:
```
{ matriz?: {...}, unidades?: [...], ultimaVistoria?: { endereco, unidade } }
```

## Fora de escopo
- Banco interno de bairros/ruas acumulado
- Mudança no editor de formulários (criação de perguntas)
- Alteração da estrutura de tabelas (`secoes`/`perguntas`)
