
CREATE POLICY "agente uploads vistoriador insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'agente-uploads'
  AND EXISTS (
    SELECT 1 FROM public.casos c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.agente_id = auth.uid()
  )
);

CREATE POLICY "agente uploads vistoriador update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'agente-uploads'
  AND EXISTS (
    SELECT 1 FROM public.casos c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND c.agente_id = auth.uid()
  )
);
