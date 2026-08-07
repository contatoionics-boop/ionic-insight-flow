ALTER TABLE public.chat_mensagens ADD COLUMN IF NOT EXISTS client_message_id text;
CREATE UNIQUE INDEX IF NOT EXISTS chat_mensagens_caso_client_message_uniq
  ON public.chat_mensagens (caso_id, client_message_id)
  WHERE client_message_id IS NOT NULL;