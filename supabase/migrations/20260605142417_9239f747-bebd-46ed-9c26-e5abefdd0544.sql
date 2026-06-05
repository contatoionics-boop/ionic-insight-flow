
ALTER TABLE public.casos DROP CONSTRAINT IF EXISTS casos_unidade_id_fkey;
ALTER TABLE public.casos ADD CONSTRAINT casos_unidade_id_fkey FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) ON DELETE CASCADE;

ALTER TABLE public.unidades DROP CONSTRAINT IF EXISTS unidades_matriz_id_fkey;
ALTER TABLE public.unidades ADD CONSTRAINT unidades_matriz_id_fkey FOREIGN KEY (matriz_id) REFERENCES public.matrizes(id) ON DELETE CASCADE;

ALTER TABLE public.matrizes DROP CONSTRAINT IF EXISTS matrizes_empresa_id_fkey;
ALTER TABLE public.matrizes ADD CONSTRAINT matrizes_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

ALTER TABLE public.links_agente DROP CONSTRAINT IF EXISTS links_agente_caso_id_fkey;
ALTER TABLE public.links_agente ADD CONSTRAINT links_agente_caso_id_fkey FOREIGN KEY (caso_id) REFERENCES public.casos(id) ON DELETE CASCADE;

ALTER TABLE public.respostas_agente DROP CONSTRAINT IF EXISTS respostas_agente_caso_id_fkey;
ALTER TABLE public.respostas_agente ADD CONSTRAINT respostas_agente_caso_id_fkey FOREIGN KEY (caso_id) REFERENCES public.casos(id) ON DELETE CASCADE;
