-- prompts_ia
CREATE TABLE public.prompts_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  conteudo text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);
ALTER TABLE public.prompts_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompts super admin all" ON public.prompts_ia
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "prompts authenticated read" ON public.prompts_ia
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'especialista')
  );

CREATE TRIGGER trg_prompts_ia_atualizado_em
  BEFORE UPDATE ON public.prompts_ia
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

-- configuracoes_saida
CREATE TABLE public.configuracoes_saida (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT false,
  destinatarios text[] NOT NULL DEFAULT '{}',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.configuracoes_saida ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saida super admin all" ON public.configuracoes_saida
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "saida admin read" ON public.configuracoes_saida
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_configuracoes_saida_atualizado_em
  BEFORE UPDATE ON public.configuracoes_saida
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

-- Seed prompts
INSERT INTO public.prompts_ia (chave, nome, descricao, conteudo) VALUES
('validacao_imagem', 'Validação de imagem',
 'Usado pela IA para analisar cada foto enviada pelo agente técnico e determinar se ela é utilizável para o laudo. Define os critérios de aprovação e reprovação.',
 'Você é um especialista em análise de imagens técnicas. Avalie a foto enviada e determine se ela é adequada para compor um laudo técnico. Critérios de reprovação: foto desfocada, muito escura, muito clara, ângulo que não permite identificar o equipamento, objeto principal fora do enquadramento. Retorne: status (aprovada/reprovada) e motivo em uma frase curta e direta para o agente técnico.'),
('feedback_agente', 'Feedback para o agente',
 'Mensagem que a IA exibe para orientar o agente durante o preenchimento de cada etapa. Deve ser curta, clara e no tom de um assistente prestativo.',
 'Você é um assistente de campo da IONICS. Sua função é orientar o agente técnico durante o preenchimento do roteiro. Seja direto, use linguagem simples. Quando pedir áudio, explique exatamente o que ele deve descrever nessa etapa. Máximo 2 frases por orientação.'),
('transcricao_tecnica', 'Transcrição para linguagem técnica',
 'Transforma o relato de áudio do agente (linguagem simples, de campo) em texto técnico e profissional para compor o laudo. O conteúdo original é preservado, apenas o tom e a estrutura mudam.',
 'Você receberá a transcrição de um relato de um agente técnico de campo. Sua função é reescrever esse relato em linguagem técnica e profissional, adequada para um laudo de mapeamento. Preserve todas as informações originais. Não invente dados. Corrija apenas o tom, a gramática e a estrutura. Use terminologia técnica de instalação veicular quando aplicável.'),
('geracao_laudo', 'Geração do laudo',
 'Prompt principal usado para gerar o relatório final a partir de todas as informações coletadas (fotos aprovadas, transcrições, respostas de texto). O laudo gerado será revisado pelo especialista antes do envio.',
 'Você é um especialista em mapeamento técnico de frotas veiculares. Com base nas informações coletadas em campo (fotos, transcrições de áudio e respostas do roteiro), gere um laudo técnico completo e estruturado seguindo o template padrão IONICS. O laudo deve ser claro, objetivo e profissional. Organize as informações por seção conforme o roteiro preenchido. Destaque pendências ou inconsistências encontradas.');

-- Seed configurações de saída
INSERT INTO public.configuracoes_saida (chave, ativo, destinatarios) VALUES
('email', false, '{}'),
('asana', false, '{}'),
('tiflux', false, '{}');