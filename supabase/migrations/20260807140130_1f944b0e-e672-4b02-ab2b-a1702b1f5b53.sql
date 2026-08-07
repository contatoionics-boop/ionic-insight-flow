DROP INDEX IF EXISTS public.chat_mensagens_caso_client_message_uniq;
CREATE UNIQUE INDEX chat_mensagens_caso_client_message_uniq
  ON public.chat_mensagens (caso_id, client_message_id);