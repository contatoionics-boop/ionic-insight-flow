## Seed SQL — Formulário BB0001 (FR-12-10)

Executar um script único que insere toda a estrutura (9 seções, perguntas e opções) no formulário cujo `nome = 'BB0001'`.

### Correções obrigatórias no SQL enviado

O SQL que você colou usa nomes de coluna que **não existem** no schema atual e quebraria na execução. Vou corrigir antes de rodar:

| No seu SQL | Coluna real no banco |
|---|---|
| `perguntas.titulo` | `perguntas.texto` |
| `perguntas.obrigatorio` | `perguntas.obrigatoria` |
| `opcoes_pergunta.valor` | `opcoes_pergunta.texto` |

Os `WHERE titulo = ...` nos `INSERT ... SELECT` de opções também serão trocados para `WHERE texto = ...`.

Nenhuma mudança de schema é necessária — todas as tabelas (`secoes`, `perguntas`, `opcoes_pergunta`) e o enum `pergunta_tipo` (com `audio`, `foto`, `selecao_unica`, `data`, `texto`) já existem.

### Pontos a confirmar antes de executar

1. **Formulário alvo**: o `SELECT id FROM formularios WHERE nome = 'BB0001'` precisa achar exatamente um registro. Se já existe, sigo. Se não existir, paro e te aviso (não vou criar formulário/cliente automaticamente).
2. **Idempotência**: o script **não** apaga seções/perguntas existentes do BB0001 antes de inserir. Se rodar duas vezes, duplica tudo. Vou rodar **uma vez só**. Caso o formulário já tenha alguma estrutura, te aviso antes para você decidir se quero limpar (`DELETE FROM secoes WHERE formulario_id = v_form_id`) ou abortar.
3. **Ordem das seções**: mantida exatamente como você passou (1 a 9). A "Seção 0 — Dados Gerais" entra com `ordem = 1` (o título da segunda seção "Descrição Geral…" entra com `ordem = 2`, etc., como no seu script).

### Como vou rodar

Bloco `DO $$ ... END $$` único via `psql` (acesso de insert já habilitado no ambiente), envolvido em transação implícita do bloco — se qualquer INSERT falhar, nada é gravado.

### Não toco em

- Schema do banco, RLS, policies, triggers.
- Outros formulários, clientes, casos.
- Código da aplicação (UI já consome essas tabelas).

Após sua aprovação, executo e confirmo as contagens (`secoes`, `perguntas`, `opcoes_pergunta`) inseridas para o BB0001.