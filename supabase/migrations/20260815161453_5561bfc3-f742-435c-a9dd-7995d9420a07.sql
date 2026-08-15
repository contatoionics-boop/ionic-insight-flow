UPDATE public.casos
SET laudo_variaveis = (
      (laudo_variaveis - 'tipo_objeto')
      || jsonb_build_object(
           'wifi_disponivel', jsonb_build_object('chave','wifi_disponivel','valor','sim','origem','formulario','confianca',1),
           'comunicacao_tipos', jsonb_build_object('chave','comunicacao_tipos','valor','WiFi, 4G/GSM','origem','formulario','confianca',0.95),
           'tipos_veiculos_abastecidos', jsonb_build_object('chave','tipos_veiculos_abastecidos','valor','Pesados','origem','formulario','confianca',1)
         )
    ),
    divergencias_proposta = '{}'::jsonb
WHERE codigo = 'CS-0049';