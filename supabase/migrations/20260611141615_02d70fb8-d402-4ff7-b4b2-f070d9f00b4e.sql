
DROP POLICY IF EXISTS "agente uploads vistoriador insert" ON storage.objects;
DROP POLICY IF EXISTS "agente uploads vistoriador update" ON storage.objects;
DROP POLICY IF EXISTS "agente uploads anon insert" ON storage.objects;
DROP POLICY IF EXISTS "agente uploads anon select" ON storage.objects;
DROP POLICY IF EXISTS "agente uploads auth select" ON storage.objects;

CREATE POLICY "agente uploads auth select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'agente-uploads');

CREATE POLICY "agente uploads vistoriador insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'agente-uploads'
  AND EXISTS (
    SELECT 1 FROM public.casos c
    WHERE c.id::text = (storage.foldername(objects.name))[2]
      AND (c.agente_id = auth.uid() OR c.criado_por = auth.uid()
           OR public.has_role(auth.uid(), 'super_admin')
           OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "agente uploads vistoriador update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'agente-uploads'
  AND EXISTS (
    SELECT 1 FROM public.casos c
    WHERE c.id::text = (storage.foldername(objects.name))[2]
      AND (c.agente_id = auth.uid() OR c.criado_por = auth.uid()
           OR public.has_role(auth.uid(), 'super_admin')
           OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "agente uploads anon insert"
ON storage.objects FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'agente-uploads'
  AND EXISTS (
    SELECT 1 FROM public.links_agente l
    WHERE l.caso_id::text = (storage.foldername(objects.name))[2]
      AND (l.expira_em IS NULL OR l.expira_em > now())
  )
);

CREATE POLICY "agente uploads anon select"
ON storage.objects FOR SELECT TO anon
USING (
  bucket_id = 'agente-uploads'
  AND EXISTS (
    SELECT 1 FROM public.links_agente l
    WHERE l.caso_id::text = (storage.foldername(objects.name))[2]
  )
);
