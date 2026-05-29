export type CaseStatus =
  | "rascunho"
  | "enviado"
  | "em_analise"
  | "revisao"
  | "aprovado";

export const statusLabels: Record<CaseStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  em_analise: "Em análise",
  revisao: "Aguardando revisão",
  aprovado: "Aprovado",
};

export const statusTones: Record<CaseStatus, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-accent text-accent-foreground",
  em_analise: "bg-warning/20 text-warning-foreground",
  revisao: "bg-primary/15 text-primary",
  aprovado: "bg-success/15 text-success",
};

export const clients = [
  { id: "c1", name: "TransLog Brasil", cnpj: "12.345.678/0001-90", email: "ops@translog.com.br", createdAt: "2025-02-14", status: "Ativo" },
  { id: "c2", name: "Rodofrota S.A.", cnpj: "98.765.432/0001-10", email: "frota@rodofrota.com", createdAt: "2025-03-02", status: "Ativo" },
  { id: "c3", name: "Cargo Express", cnpj: "44.555.666/0001-77", email: "ti@cargoexpress.com", createdAt: "2025-04-21", status: "Ativo" },
  { id: "c4", name: "Via Norte Transportes", cnpj: "22.111.000/0001-55", email: "contato@vianorte.com", createdAt: "2025-05-10", status: "Inativo" },
];

export const users = [
  { id: "u1", name: "Cledir", email: "cledir@ionics.com.br", role: "Super Admin", active: true },
  { id: "u2", name: "Yan Silva", email: "yan@ionics.com.br", role: "Admin", active: true },
  { id: "u3", name: "Marina Souza", email: "marina@ionics.com.br", role: "Admin", active: true },
  { id: "u4", name: "Pablo Costa", email: "pablo@ionics.com.br", role: "Especialista", active: true },
  { id: "u5", name: "Roberto Lima", email: "roberto@ionics.com.br", role: "Agente Técnico", active: true },
  { id: "u6", name: "Júlia Mendes", email: "julia@ionics.com.br", role: "Agente Técnico", active: false },
];

export const agents = users.filter((u) => u.role === "Agente Técnico");

export const cases: {
  id: string;
  clientId: string;
  clientName: string;
  agent: string;
  status: CaseStatus;
  date: string;
  createdBy: string;
}[] = [
  { id: "CS-1042", clientId: "c1", clientName: "TransLog Brasil", agent: "Roberto Lima", status: "revisao", date: "2026-05-20", createdBy: "Yan Silva" },
  { id: "CS-1041", clientId: "c2", clientName: "Rodofrota S.A.", agent: "Roberto Lima", status: "em_analise", date: "2026-05-19", createdBy: "Yan Silva" },
  { id: "CS-1040", clientId: "c1", clientName: "TransLog Brasil", agent: "Júlia Mendes", status: "aprovado", date: "2026-05-18", createdBy: "Marina Souza" },
  { id: "CS-1039", clientId: "c3", clientName: "Cargo Express", agent: "Roberto Lima", status: "revisao", date: "2026-05-18", createdBy: "Yan Silva" },
  { id: "CS-1038", clientId: "c2", clientName: "Rodofrota S.A.", agent: "Roberto Lima", status: "enviado", date: "2026-05-17", createdBy: "Marina Souza" },
  { id: "CS-1037", clientId: "c4", clientName: "Via Norte Transportes", agent: "Júlia Mendes", status: "rascunho", date: "2026-05-16", createdBy: "Yan Silva" },
  { id: "CS-1036", clientId: "c1", clientName: "TransLog Brasil", agent: "Roberto Lima", status: "aprovado", date: "2026-05-12", createdBy: "Yan Silva" },
];

export type Question = {
  id: string;
  text: string;
  type: "texto" | "foto" | "audio" | "checkbox" | "numero";
  required: boolean;
};

export type Section = {
  id: string;
  title: string;
  questions: Question[];
};

export type FormDef = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  sections: Section[];
};

export const forms: FormDef[] = [
  {
    id: "f1",
    name: "Vistoria padrão — Frota leve",
    clientId: "c1",
    clientName: "TransLog Brasil",
    sections: [
      {
        id: "s1",
        title: "Dados do veículo",
        questions: [
          { id: "q1", text: "Placa do veículo", type: "texto", required: true },
          { id: "q2", text: "Quilometragem atual", type: "numero", required: true },
          { id: "q3", text: "Foto do hodômetro", type: "foto", required: true },
        ],
      },
      {
        id: "s2",
        title: "Equipamento instalado",
        questions: [
          { id: "q4", text: "Foto da instalação do rastreador", type: "foto", required: true },
          { id: "q5", text: "Observações do técnico", type: "audio", required: false },
          { id: "q6", text: "Sensor de combustível instalado?", type: "checkbox", required: true },
        ],
      },
    ],
  },
  {
    id: "f2",
    name: "Vistoria pesada — Caminhões",
    clientId: "c2",
    clientName: "Rodofrota S.A.",
    sections: [
      {
        id: "s1",
        title: "Identificação",
        questions: [
          { id: "q1", text: "Placa", type: "texto", required: true },
          { id: "q2", text: "Foto do chassi", type: "foto", required: true },
        ],
      },
    ],
  },
];

export type PromptDef = {
  key: string;
  name: string;
  description: string;
  content: string;
};

export const aiPrompts: PromptDef[] = [
  {
    key: "validacao_imagem",
    name: "Validação de imagem",
    description:
      "Usado pela IA para analisar cada foto enviada pelo agente técnico e determinar se ela é utilizável para o laudo. Define os critérios de aprovação e reprovação.",
    content:
      "Você é um especialista em análise de imagens técnicas. Avalie a foto enviada e determine se ela é adequada para compor um laudo técnico. Critérios de reprovação: foto desfocada, muito escura, muito clara, ângulo que não permite identificar o equipamento, objeto principal fora do enquadramento. Retorne: status (aprovada/reprovada) e motivo em uma frase curta e direta para o agente técnico.",
  },
  {
    key: "feedback_agente",
    name: "Feedback para o agente",
    description:
      "Mensagem que a IA exibe para orientar o agente durante o preenchimento de cada etapa. Deve ser curta, clara e no tom de um assistente prestativo.",
    content:
      "Você é um assistente de campo da Ionics. Sua função é orientar o agente técnico durante o preenchimento do roteiro. Seja direto, use linguagem simples. Quando pedir áudio, explique exatamente o que ele deve descrever nessa etapa. Máximo 2 frases por orientação.",
  },
  {
    key: "transcricao_tecnica",
    name: "Transcrição para linguagem técnica",
    description:
      "Transforma o relato de áudio do agente (linguagem simples, de campo) em texto técnico e profissional para compor o laudo. O conteúdo original é preservado, apenas o tom e a estrutura mudam.",
    content:
      "Você receberá a transcrição de um relato de um agente técnico de campo. Sua função é reescrever esse relato em linguagem técnica e profissional, adequada para um laudo de mapeamento. Preserve todas as informações originais. Não invente dados. Corrija apenas o tom, a gramática e a estrutura. Use terminologia técnica de instalação veicular quando aplicável.",
  },
  {
    key: "geracao_laudo",
    name: "Geração do laudo",
    description:
      "Prompt principal usado para gerar o relatório final a partir de todas as informações coletadas (fotos aprovadas, transcrições, respostas de texto). O laudo gerado será revisado pelo especialista antes do envio.",
    content:
      "Você é um especialista em mapeamento técnico de frotas veiculares. Com base nas informações coletadas em campo (fotos, transcrições de áudio e respostas do roteiro), gere um laudo técnico completo e estruturado seguindo o template padrão Ionics. O laudo deve ser claro, objetivo e profissional. Organize as informações por seção conforme o roteiro preenchido. Destaque pendências ou inconsistências encontradas.",
  },
];

export const outputConfig = {
  email: { enabled: true, recipients: ["operacoes@ionics.com.br", "qa@ionics.com.br"] },
  asana: { enabled: false },
  tiflux: { enabled: true },
};

// Roteiro público mock para o agente técnico
export const agentScript: Section[] = [
  {
    id: "as1",
    title: "Identificação do veículo",
    questions: [
      { id: "aq1", text: "Foto frontal do veículo", type: "foto", required: true },
      { id: "aq2", text: "Placa do veículo", type: "texto", required: true },
    ],
  },
  {
    id: "as2",
    title: "Equipamento instalado",
    questions: [
      { id: "aq3", text: "Foto do equipamento", type: "foto", required: true },
      { id: "aq4", text: "Áudio explicando a instalação", type: "audio", required: true },
    ],
  },
  {
    id: "as3",
    title: "Finalização",
    questions: [
      { id: "aq5", text: "Foto geral pós-instalação", type: "foto", required: true },
      { id: "aq6", text: "Observações adicionais", type: "texto", required: false },
    ],
  },
];
