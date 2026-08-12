# Resultado do mapeamento = sempre o laudo estruturado

O PDF em anexo (`mapeamento-cs-0040-ionics.pdf`) é o gerador antigo de pergunta/resposta. Hoje a tela de revisão ainda usa esse gerador no botão principal **Baixar PDF** (`gerarPdfMapeamento`), enquanto o laudo estruturado (FR-31-10, com campos preenchidos dinamicamente) só sai pela aba **Laudo** (`gerarPdfLaudo`). É isso que vamos inverter.

## O que muda

1. **Botão principal passa a gerar o laudo.** Em qualquer lugar onde hoje se baixa "o PDF do mapeamento" (tela de revisão, lista de mapeamentos, fila de revisão), o arquivo entregue é o laudo estruturado, com capa, seções numeradas, textos padrão, tabelas de produtos/materiais e as variáveis já preenchidas.

2. **Se o laudo ainda não foi montado, monta na hora.** Ao pedir o PDF, o sistema verifica `laudo_conteudo`; se estiver vazio (casos antigos, como o CS-0040), ele roda a montagem automaticamente antes de renderizar — ninguém precisa clicar em "Gerar laudo" primeiro.

3. **O PDF bruto vira secundário.** O gerador de pergunta/resposta continua existindo como **"PDF de respostas (bruto)"**, num botão discreto/menu, para conferência interna. Não é mais o resultado do mapeamento.

4. **Regras do laudo continuam valendo.** Campos sem valor saem como `[CONFIRMAR: ...]`, e alerta bloqueante não confirmado continua impedindo a geração do PDF final — com o motivo à vista.

## Detalhes técnicos

- `src/routes/app.review.$id.tsx`: trocar `gerarPdfMapeamento` por `gerarPdfLaudo` no botão "Baixar PDF"; manter o antigo atrás de um botão secundário rotulado "PDF de respostas (bruto)".
- `src/lib/laudo.functions.ts` (`gerarPdfLaudo`): antes de renderizar, se `laudo_conteudo` estiver nulo/sem blocos, chamar `montarESalvarLaudo` (já existe em `src/lib/laudo/montar.server.ts`) e usar o resultado.
- `src/routes/app.cases.tsx` e `src/routes/app.review-queue.tsx`: onde houver ação de PDF, apontar para o laudo.
- Nada de mudança de banco; nenhuma alteração no motor de template ou no renderer `pdf-laudo.server.ts`.
