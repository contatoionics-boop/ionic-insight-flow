ALTER TABLE public.casos
  ADD CONSTRAINT casos_formulario_id_fkey
  FOREIGN KEY (formulario_id) REFERENCES public.formularios(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';