// Biblioteca de peças do desenho técnico (projeto "Marcação em Foto"). Arquivos em /public/marcacao/biblioteca.
export type PecaBiblioteca = {
  id: string;
  /** nome curto, para o botão */
  curto: string;
  /** nome completo, usado na legenda */
  completo: string;
  grupo: string;
  /** largura ÷ altura da figura */
  proporcao: number;
  arquivo: string;
  /** altura inicial, em fração da foto (peças pequenas, como relé e conexões, nascem menores). Padrão: 26%. */
  alturaInicial?: number;
};

export const BIBLIOTECA: PecaBiblioteca[] = [
  { id: "ilha", curto: "Ilha", completo: "Ilha (base das bombas)", grupo: "Ilha e base", proporcao: 7.227, arquivo: "ilha.png" },
  { id: "eletronica", curto: "Bomba eletrônica", completo: "Bomba eletrônica", grupo: "Bombas e medição", proporcao: 0.497, arquivo: "eletronica.png" },
  { id: "mecanica", curto: "Bomba mecânica", completo: "Bomba mecânica", grupo: "Bombas e medição", proporcao: 0.664, arquivo: "mecanica.png" },
  { id: "altavazao", curto: "Alta vazão · LCR", completo: "Bomba eletrônica de alta vazão (Medidor LCR)", grupo: "Bombas e medição", proporcao: 0.495, arquivo: "altavazao.png" },
  { id: "mecalta", curto: "Alta vazão · mec.", completo: "Bomba mecânica de alta vazão (Registrador)", grupo: "Bombas e medição", proporcao: 0.516, arquivo: "mecalta.png" },
  { id: "kit", curto: "Kit / baixa vazão", completo: "Kit de abastecimento (bomba elétrica de baixa vazão)", grupo: "Bombas e medição", proporcao: 1.108, arquivo: "kit.png" },
  { id: "totem400", curto: "Totem · painel 400", completo: "Totem com caixa-painel (400x300x200) frontal", grupo: "Totens", proporcao: 0.403, arquivo: "totem400.png" },
  { id: "totem600", curto: "Totem · painel 600", completo: "Totem com caixa-painel (600x600x200) frontal", grupo: "Totens", proporcao: 0.458, arquivo: "totem600.png" },
  { id: "totem600_400", curto: "Totem · 600+400", completo: "Totem com caixa-painel (600x600x200) frontal e (400x300x200) traseira", grupo: "Totens", proporcao: 0.442, arquivo: "totem600_400.png" },
  { id: "totemT1000", curto: "Totem · T1000", completo: "Totem com T1000 frontal e caixa-painel (400x300x200) traseira", grupo: "Totens", proporcao: 0.472, arquivo: "totemT1000.png" },
  { id: "pilar400", curto: "Pilar · painel 400", completo: "Pilar/coluna com caixa-painel (400x300x200) frontal", grupo: "Pilares e colunas", proporcao: 0.489, arquivo: "pilar400.png" },
  { id: "pilar600", curto: "Pilar · painel 600", completo: "Pilar/coluna com caixa-painel (600x600x200) frontal", grupo: "Pilares e colunas", proporcao: 0.767, arquivo: "pilar600.png" },
  { id: "pilar600_400", curto: "Pilar · 600+400", completo: "Pilar/coluna com caixa-painel (600x600x200) frontal e (400x300x200) traseira", grupo: "Pilares e colunas", proporcao: 0.753, arquivo: "pilar600_400.png" },
  { id: "pilarT1000", curto: "Pilar · T1000", completo: "Pilar/coluna com T1000 frontal e caixa-painel (400x300x200) traseira", grupo: "Pilares e colunas", proporcao: 0.819, arquivo: "pilarT1000.png" },
  { id: "sump", curto: "Sump da bomba", completo: "Sump da bomba", grupo: "Instruções / montagem", proporcao: 1.261, arquivo: "sump.png" },
  { id: "tubulacao", curto: "Tubulação · cabeamento", completo: "Tubulação e acessórios para o cabeamento da automação", grupo: "Instruções / montagem", proporcao: 2.8, arquivo: "tubulacao.png" },
  { id: "eletroduto_curva", curto: "Eletroduto (curva)", completo: "Eletroduto com curva 90°", grupo: "Infra / eletrocalha", proporcao: 0.899, arquivo: "eletroduto_curva.svg" },
  { id: "eletroduto_reto", curto: "Eletroduto (reto)", completo: "Eletroduto reto com luvas", grupo: "Infra / eletrocalha", proporcao: 4.091, arquivo: "eletroduto_reto.svg" },
  { id: "seladora", curto: "Unidade seladora", completo: "Unidade seladora", grupo: "Infra / eletrocalha", proporcao: 0.432, arquivo: "seladora.svg" },
  { id: "caixa_passagem", curto: "Caixa de passagem", completo: "Caixa de passagem", grupo: "Infra / eletrocalha", proporcao: 1.151, arquivo: "caixa_passagem.svg" },
  { id: "gabinete_fechado", curto: "Gabinete fechado", completo: "Gabinete/caixa painel com porta (600x600x200)", grupo: "Gabinetes e módulos", proporcao: 1.0, arquivo: "gabinete_fechado.svg", alturaInicial: 0.32 },
  { id: "gabinete_aberto", curto: "Gabinete aberto", completo: "Gabinete/caixa painel aberto, com T1000 instalado", grupo: "Gabinetes e módulos", proporcao: 1.68, arquivo: "gabinete_aberto.svg", alturaInicial: 0.34 },
  { id: "t1000", curto: "Terminal T1000", completo: "Terminal T1000", grupo: "Gabinetes e módulos", proporcao: 1.19, arquivo: "t1000.svg", alturaInicial: 0.22 },
  { id: "modulo_comunicacao", curto: "Módulo de comunicação", completo: "Módulo de comunicação", grupo: "Gabinetes e módulos", proporcao: 1.25, arquivo: "modulo_comunicacao.svg", alturaInicial: 0.16 },
  { id: "antena", curto: "Antena", completo: "Antena (T1000 / CMB)", grupo: "Gabinetes e módulos", proporcao: 0.3, arquivo: "antena.svg", alturaInicial: 0.2 },
  { id: "rele_auxiliar", curto: "Relé auxiliar", completo: "Relé auxiliar (interrupção da energia da bomba)", grupo: "Gabinetes e módulos", proporcao: 1.0, arquivo: "rele_auxiliar.svg", alturaInicial: 0.14 },
  { id: "fonte_cmb", curto: "CMB e fonte", completo: "CMB e fonte chaveada industrial", grupo: "Gabinetes e módulos", proporcao: 1.53, arquivo: "fonte_cmb.svg", alturaInicial: 0.16 },
  { id: "valvula_solenoide", curto: "Válvula solenoide", completo: "Válvula solenoide 1\" 12V", grupo: "Abastecimento", proporcao: 1.11, arquivo: "valvula_solenoide.svg", alturaInicial: 0.2 },
  { id: "medidor_pulso", curto: "Medidor de pulso", completo: "Medidor de pulso (Piusi K600)", grupo: "Abastecimento", proporcao: 1.4, arquivo: "medidor_pulso.svg", alturaInicial: 0.22 },
  { id: "bico_nldiv", curto: "Bico + NLDIV", completo: "Bico automatizado com NLDIV Wireless", grupo: "Abastecimento", proporcao: 1.63, arquivo: "bico_nldiv.svg", alturaInicial: 0.22 },
  { id: "carretel", curto: "Carretel", completo: "Carretel de mangueira", grupo: "Abastecimento", proporcao: 0.97, arquivo: "carretel.svg", alturaInicial: 0.3 },
  { id: "div", curto: "DIV", completo: "DIV (dispositivo de identificação veicular)", grupo: "Abastecimento", proporcao: 1.07, arquivo: "div.svg", alturaInicial: 0.1 },
  { id: "cotovelo_90", curto: "Cotovelo 90°", completo: "Cotovelo/curva 90° galvanizado", grupo: "Conexões", proporcao: 1.0, arquivo: "cotovelo_90.svg", alturaInicial: 0.1 },
  { id: "niple_luva", curto: "Niple + luva", completo: "Niple duplo com luva", grupo: "Conexões", proporcao: 3.3, arquivo: "niple_luva.svg", alturaInicial: 0.07 },
];

export const PECAS: Record<string, PecaBiblioteca> = Object.fromEntries(BIBLIOTECA.map((p) => [p.id, p]));

/** Grupos na ordem em que aparecem na biblioteca. */
export const GRUPOS_BIBLIOTECA: string[] = [...new Set(BIBLIOTECA.map((p) => p.grupo))];

export const urlDaPeca = (p: PecaBiblioteca) => `/marcacao/biblioteca/${p.arquivo}`;
