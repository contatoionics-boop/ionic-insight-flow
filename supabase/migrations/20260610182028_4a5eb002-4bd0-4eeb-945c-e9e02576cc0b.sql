
CREATE TABLE IF NOT EXISTS public.chat_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id uuid NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  parts jsonb NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.chat_mensagens TO service_role;

ALTER TABLE public.chat_mensagens ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS chat_mensagens_caso_idx
  ON public.chat_mensagens (caso_id, criado_em);
