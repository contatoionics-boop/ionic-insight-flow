# Especialista também executa mapeamentos

## Objetivo
Permitir que usuários com perfil **Especialista** sejam responsáveis por um agendamento e executem o mapeamento completo, com as mesmas ações operacionais hoje disponíveis ao Agente Técnico.

## Alterações
- Incluir especialistas na lista de profissionais disponíveis ao criar, atribuir ou reagendar um mapeamento.
- Mostrar **Meus mapeamentos** no menu do especialista, sem remover a fila de revisão e o histórico.
- Liberar para o especialista atribuído as ações de aceitar/recusar o agendamento, abrir, iniciar, salvar respostas e anexos, retomar e finalizar o mapeamento.
- Manter a execução vinculada ao responsável atribuído: um especialista não poderá preencher o mapeamento de outro usuário apenas por possuir esse perfil.
- Registrar no histórico o especialista autenticado que iniciou ou finalizou o trabalho, em vez de inferir o autor somente pelo cadastro do agendamento.
- Preservar as permissões atuais de revisão e gestão do especialista.

## Segurança e dados
- Ajustar as validações no servidor para aceitar os papéis `agente_tecnico` e `especialista` como executores.
- Revisar as políticas de acesso aos casos, respostas e arquivos; aplicar uma migração somente onde as regras atuais limitarem explicitamente o acesso ao papel de agente técnico.
- Não conceder essa capacidade ao IAM ou a outros perfis sem atribuição ao mapeamento.

## Validação
- Confirmar que um especialista aparece como opção de responsável no agendamento.
- Confirmar que o especialista atribuído visualiza o trabalho em **Meus mapeamentos**, aceita, inicia, salva respostas/anexos, recarrega e continua, e finaliza.
- Confirmar que um especialista não atribuído não consegue alterar o mapeamento.
- Confirmar que o Agente Técnico continua com o fluxo atual e que a fila de revisão do especialista permanece disponível.
