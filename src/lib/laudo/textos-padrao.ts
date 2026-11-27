// Textos padrão do documento com versões ("slots"), client-safe, funções puras.
//
// Cada texto fixo do Resultado de Mapeamento (Introdução, Instruções gerais…) é um SLOT. O especialista
// guarda várias versões de cada slot em Configurações › Textos do documento e o sistema escolhe uma:
//   1. a versão escolhida para o mapeamento (troca manual);
//   2. a versão marcada como padrão cuja condição (solução, nível, itens do Escopo) o caso atende
//      (empate: a mais específica, depois a ordem);
//   3. o texto original do sistema (o que o gerador sempre produziu).
// A versão fica em `blocos_padrao`: `escopo` = { slot, padrao, solucao?, nivel?, exige? } e `blocos` = parágrafos/listas
// com campos `{{cliente}}`. Campo sem dado vira [CONFIRMAR]; o PDF continua bloqueado enquanto houver pendência.

import { condicoesAtendidas, lerExtras, lerRegra, qtdCondicoesExtras, type AvaliacaoRegra, type BlocoPadraoAuto, type RegraBlocoPadrao } from "./blocos-padrao-regras";
import { blocos24 } from "./blocos-nivel2";
import { FIGURA_N2_BICO, FIGURA_N2_PONTEIRA, FIGURA_N2_SUPORTE, type FiguraLaudo } from "./figuras";
import { pendencia, type BlocoLaudo } from "./tipos";
import { escaparMarcas, type Alinhamento } from "./texto-formatado";

/** Na ordem em que aparecem no documento. */
export const SLOTS_TEXTO = ["introducao", "ti_bd", "wifi", "gsm", "radio", "nivel2", "rfid", "div", "tx", "instrucoes_gerais", "consideracoes_finais"] as const;
export type SlotTexto = (typeof SLOTS_TEXTO)[number];

export const INFO_SLOT: Record<SlotTexto, { rotulo: string; descricao: string }> = {
  introducao: { rotulo: "Introdução", descricao: "Abre o documento, logo abaixo do título 1. Introdução." },
  ti_bd: { rotulo: "TI e banco de dados (texto)", descricao: "Texto dos requisitos de TI e banco de dados (2.1). As tabelas de especificação continuam editáveis no documento." },
  wifi: {
    rotulo: "Transferência de dados — Wi-Fi",
    descricao: "Texto do Wi-Fi. Sem versão, o texto técnico é gerado das respostas do mapeamento; com versão, ela o substitui. A tabela de condições, as velocidades e os prints continuam.",
  },
  gsm: { rotulo: "Transferência de dados — GSM / 4G", descricao: "Texto do GSM/4G. Mesma regra do Wi-Fi; o print do sinal da operadora continua." },
  radio: { rotulo: "Transferência de dados — Rádio 2.4GHz", descricao: "Texto do rádio entre o terminal e os periféricos sem fio." },
  nivel2: { rotulo: "Bicos de abastecimento (Nível 2 / NLDIV)", descricao: "Textos e desenhos da seção de bicos do Nível 2. Os desenhos entram com [figura:bico], [figura:ponteira] e [figura:suporte]." },
  rfid: { rotulo: "Cartão RFID", descricao: "Texto da seção de Cartão RFID (só aparece quando o Escopo tem RFID)." },
  div: { rotulo: "DIV (texto)", descricao: "Texto da seção de DIV, acima da tabela de tipos (Nível 2 com frota no Escopo). A tabela continua automática." },
  tx: { rotulo: "Telemetria TX", descricao: "Texto da Telemetria TX (só aparece quando o Escopo tem TX). Sem versão, fica o espaço a confirmar." },
  instrucoes_gerais: { rotulo: "Instruções gerais", descricao: "Texto da seção de Instruções gerais, no final dos requisitos." },
  consideracoes_finais: { rotulo: "Considerações finais", descricao: "Seção extra no fim do documento. Só aparece quando existe uma versão aplicável." },
};

export const ehSlotTexto = (valor: unknown): valor is SlotTexto => typeof valor === "string" && (SLOTS_TEXTO as readonly string[]).includes(valor);

/** Campos automáticos que o texto pode usar: `{{chave}}`. */
export const CAMPOS_TEXTO = [
  { chave: "cliente", rotulo: "Nome do cliente" },
  { chave: "unidade", rotulo: "Unidade" },
  { chave: "solucao", rotulo: "Solução (SSGFrota ou On-premise)" },
  { chave: "nivel", rotulo: "Nível de automação (ex.: Nível 2)" },
  { chave: "modalidade", rotulo: "Modalidade do mapeamento (remoto/presencial)" },
  { chave: "tipo_acao", rotulo: "Tipo de ação (instalação ou upgrade)" },
  { chave: "objeto_escopo", rotulo: "Objeto do escopo" },
  { chave: "data", rotulo: "Data do mapeamento" },
  { chave: "agente", rotulo: "Agente do mapeamento" },
  { chave: "origem_dados", rotulo: "Frase sobre quem informou os dados (pode vir vazia)" },
  { chave: "aplicacao", rotulo: "Nome da aplicação (SAAF ou SSGFrota)" },
  { chave: "frequencia_wifi", rotulo: "Frequência do Wi-Fi informada" },
  { chave: "potencia_wifi", rotulo: "Potência do sinal Wi-Fi informada" },
  { chave: "operadora_gsm", rotulo: "Operadora GSM informada" },
  { chave: "rfid_quantidade", rotulo: "Quantidade de cartões RFID (ex.: 10 cartões RFID)" },
  { chave: "rfid_tecnologia", rotulo: "Tecnologia do cartão RFID (Mifare/Melexis)" },
  { chave: "div_total", rotulo: "Total de DIV do Escopo" },
  { chave: "tx_quantidade", rotulo: "Quantidade de TX do Escopo" },
] as const;

const CAMPOS_BASE = ["cliente", "unidade", "solucao", "aplicacao", "nivel", "modalidade", "tipo_acao", "objeto_escopo", "data", "agente"];
const EXTRAS_DO_SLOT: Partial<Record<SlotTexto, string[]>> = {
  introducao: ["origem_dados"],
  wifi: ["frequencia_wifi", "potencia_wifi"],
  gsm: ["operadora_gsm"],
  rfid: ["rfid_quantidade", "rfid_tecnologia"],
  div: ["div_total"],
  tx: ["tx_quantidade"],
};
/** Campos que fazem sentido em cada texto (os botões de inserir na tela de edição). */
export const camposDoSlot = (slot: SlotTexto) => {
  const chaves = new Set([...CAMPOS_BASE, ...(EXTRAS_DO_SLOT[slot] ?? [])]);
  return CAMPOS_TEXTO.filter((c) => chaves.has(c.chave));
};

export type CamposTexto = Record<string, string | null | undefined>;

/** Troca `{{campo}}` pelo valor. Valor ausente (null) ou campo desconhecido vira [CONFIRMAR]; "" é válido (some). */
export function renderizarCampos(texto: string, campos: CamposTexto, opcoes: { escapar?: boolean } = {}): string {
  return texto.replace(/\{\{\s*([A-Za-z_]\w*)\s*\}\}/g, (_inteiro, chave: string) => {
    if (!(chave in campos)) return pendencia(chave, `campo desconhecido {{${chave}}}`);
    const valor = campos[chave];
    if (valor === null || valor === undefined) return pendencia(chave, CAMPOS_TEXTO.find((c) => c.chave === chave)?.rotulo ?? chave);
    // texto com formatação: um valor com "*" ou "+" (ex.: nome do cliente) não pode virar negrito/itálico por acaso
    return opcoes.escapar ? escaparMarcas(valor) : valor;
  });
}

// ------------------------------------------------------------------ conteúdo do texto

/** Desenhos padrão que o texto pode incluir com `[figura:nome]` (Nível 2). */
export const FIGURAS_TEXTO = { bico: FIGURA_N2_BICO, ponteira: FIGURA_N2_PONTEIRA, suporte: FIGURA_N2_SUPORTE } satisfies Record<string, FiguraLaudo>;
export type NomeFigura = keyof typeof FIGURAS_TEXTO;
const ehNomeFigura = (v: string): v is NomeFigura => Object.prototype.hasOwnProperty.call(FIGURAS_TEXTO, v);

/** Imagem da biblioteca (Configurações › Blocos padrão › Biblioteca de imagens), referenciada por `[imagem:<id>]`. */
export type ImagemBiblioteca = { id: string; nome: string; url: string; alt: string; legenda: string; larguraMax: number };
export type ImagensBiblioteca = Record<string, ImagemBiblioteca>;

/**
 * Conteúdo editável: parágrafo (destaque de revisão, formatação e alinhamento), lista, desenho do sistema ou
 * imagem da biblioteca. `rico` = o texto traz marcas `**negrito**`, `*itálico*`, `++sublinhado++`.
 */
export type ItemTexto =
  | { tipo: "paragraph"; texto: string; destaque?: boolean; rico?: boolean; alinhamento?: Alinhamento; caixaAlta?: boolean }
  | { tipo: "bullets"; itens: string[]; rico?: boolean }
  | { tipo: "figura"; nome: NomeFigura }
  | { tipo: "imagem"; id: string }
  /** tabela editável: o documento nasce com estas colunas e linhas (as células aceitam `{{campos}}`) e o especialista preenche na revisão */
  | { tipo: "tabela"; titulo?: string; colunas: string[]; linhas: string[][] };

/** Modelos de tabela do editor de textos: as mesmas colunas das tabelas de produtos e de materiais do documento, ou uma tabela nova. */
export const MODELOS_TABELA = {
  produtos: { rotulo: "Produtos IONICS", titulo: "Produtos IONICS", colunas: ["Código", "Descrição", "Qtd."] },
  materiais: { rotulo: "Materiais de infraestrutura", titulo: "Materiais de infraestrutura", colunas: ["Código", "Descrição", "Aplicação", "Un.", "Qtd."] },
  livre: { rotulo: "Tabela nova", titulo: "", colunas: ["Coluna 1", "Coluna 2"] },
} as const;
export type ModeloTabela = keyof typeof MODELOS_TABELA;

/** Tabela pronta para preencher: colunas do modelo e 3 linhas em branco. */
export function novaTabela(modelo: ModeloTabela): Extract<ItemTexto, { tipo: "tabela" }> {
  const m = MODELOS_TABELA[modelo];
  return { tipo: "tabela", ...(m.titulo ? { titulo: m.titulo } : {}), colunas: [...m.colunas], linhas: Array.from({ length: 3 }, () => m.colunas.map(() => "")) };
}

/**
 * Corpo em texto → itens. Cada linha é um parágrafo; "- " ou "• " no começo vira item de lista;
 * "!" no começo marca o parágrafo como campo de revisão (amarelo só no editor, PDF limpo);
 * "[figura:bico]" numa linha sozinha insere um desenho padrão (bico, ponteira, suporte).
 */
export function corpoParaItens(corpo: string): ItemTexto[] {
  const itens: ItemTexto[] = [];
  let lista: string[] = [];
  const fechar = () => {
    if (lista.length) itens.push({ tipo: "bullets", itens: lista });
    lista = [];
  };
  for (const bruta of corpo.split(/\r?\n/)) {
    const l = bruta.trim();
    if (!l) {
      fechar();
      continue;
    }
    if (l.startsWith("- ") || l.startsWith("• ")) {
      lista.push(l.slice(2).trim());
      continue;
    }
    fechar();
    const fig = l.match(/^\[figura:\s*(\w+)\s*\]$/i);
    if (fig && ehNomeFigura(fig[1].toLowerCase())) {
      itens.push({ tipo: "figura", nome: fig[1].toLowerCase() as NomeFigura });
      continue;
    }
    const img = l.match(/^\[imagem:\s*([\w-]+)\s*\]$/i);
    if (img) {
      itens.push({ tipo: "imagem", id: img[1] });
      continue;
    }
    if (l.startsWith("!")) itens.push({ tipo: "paragraph", texto: l.slice(1).trim(), destaque: true });
    else itens.push({ tipo: "paragraph", texto: l });
  }
  fechar();
  return itens;
}

/** Itens → corpo em texto (inverso de `corpoParaItens`). */
export function itensParaCorpo(itens: ItemTexto[]): string {
  return itens
    .map((i) => (i.tipo === "bullets" ? i.itens.map((x) => `- ${x}`).join("\n") : i.tipo === "figura" ? `[figura:${i.nome}]` : i.tipo === "imagem" ? `[imagem:${i.id}]` : i.tipo === "tabela" ? "[tabela]" : `${i.destaque ? "!" : ""}${i.texto}`))
    .filter(Boolean)
    .join("\n\n");
}

/** Blocos gravados na versão → itens (só parágrafo e lista; o resto é ignorado). */
export function blocosParaItens(blocos: BlocoLaudo[]): ItemTexto[] {
  const itens: ItemTexto[] = [];
  for (const b of blocos ?? []) {
    if (b.tipo === "paragraph")
      itens.push({
        tipo: "paragraph",
        texto: b.texto,
        ...(b.destaque ? { destaque: true } : {}),
        ...(b.rico ? { rico: true } : {}),
        ...(b.alinhamento ? { alinhamento: b.alinhamento } : {}),
        ...(b.caixaAlta ? { caixaAlta: true } : {}),
      });
    else if (b.tipo === "bullets") itens.push({ tipo: "bullets", itens: b.itens, ...(b.rico ? { rico: true } : {}) });
    else if (b.tipo === "table")
      itens.push({ tipo: "tabela", ...(b.titulo ? { titulo: b.titulo } : {}), colunas: b.colunas, linhas: b.linhas.map((l) => l.celulas.map((c) => String(c ?? ""))) });
    else if (b.tipo === "image") {
      if (b.bibliotecaId) itens.push({ tipo: "imagem", id: b.bibliotecaId });
      else {
        const nome = (Object.keys(FIGURAS_TEXTO) as NomeFigura[]).find((n) => FIGURAS_TEXTO[n].url === b.url);
        if (nome) itens.push({ tipo: "figura", nome });
      }
    }
  }
  return itens;
}

/** Itens → blocos para gravar na versão (o texto ainda traz os `{{campos}}`). */
export function itensParaBlocos(itens: ItemTexto[]): BlocoLaudo[] {
  const rnd = () => Math.random().toString(36).slice(2, 10);
  return itens.map((i) => {
    if (i.tipo === "bullets") return { id: `tx-bl-${rnd()}`, tipo: "bullets", itens: i.itens, ...(i.rico ? { rico: true } : {}) } as BlocoLaudo;
    if (i.tipo === "tabela") return { id: `tx-t-${rnd()}`, tipo: "table", titulo: i.titulo?.trim() || null, colunas: i.colunas, linhas: i.linhas.map((celulas) => ({ celulas })) } as BlocoLaudo;
    if (i.tipo === "figura") {
      const f = FIGURAS_TEXTO[i.nome];
      return { id: `tx-img-${rnd()}`, tipo: "image", url: f.url, alt: f.alt, legenda: f.legendaBase, larguraMax: f.larguraMax } as BlocoLaudo;
    }
    // imagem da biblioteca: guarda só a referência (a URL vem da biblioteca na hora de gerar o documento)
    if (i.tipo === "imagem") return { id: `tx-img-${rnd()}`, tipo: "image", url: "", alt: "", legenda: null, bibliotecaId: i.id } as BlocoLaudo;
    return {
      id: `tx-p-${rnd()}`,
      tipo: "paragraph",
      ...(i.destaque ? { destaque: "editavel" } : {}),
      ...(i.rico ? { rico: true } : {}),
      ...(i.alinhamento ? { alinhamento: i.alinhamento } : {}),
      ...(i.caixaAlta ? { caixaAlta: true } : {}),
      texto: i.texto,
    } as BlocoLaudo;
  });
}

// ------------------------------------------------------------------ texto original do sistema

const NOME_SOLUCAO_ORIGINAL = "{{solucao}}";

/**
 * O que o gerador produz quando não há versão. Serve de ponto de partida para "Nova versão".
 * Introdução e Instruções gerais são o texto oficial; TI/BD é o texto do cenário padrão (servidor + consulta);
 * Considerações finais não existe no original (vazio).
 */
/** Itens a partir dos blocos que o gerador produz (títulos não entram: o título da seção é do documento). */
function itensDosBlocos(blocos: BlocoLaudo[]): ItemTexto[] {
  return blocosParaItens(blocos.filter((b) => b.tipo !== "heading"));
}

export const TEXTO_ORIGINAL: Record<SlotTexto, ItemTexto[]> = {
  wifi: [
    {
      tipo: "paragraph",
      texto: "A transferência por WiFi exige cobertura de sinal estável no ponto de abastecimento, com rede dedicada ou liberação das portas de comunicação utilizadas pela aplicação.",
    },
  ],
  gsm: [
    {
      tipo: "paragraph",
      texto: "Onde não houver cobertura WiFi, a comunicação será feita por GSM/4G, com chip de dados fornecido pelo cliente e antena externa instalada em ponto de boa recepção.",
    },
  ],
  radio: [
    {
      tipo: "paragraph",
      texto: "A comunicação entre o terminal e os periféricos sem fio ocorre em rádio 2.4GHz, com alcance sujeito a obstruções metálicas e à distância entre os módulos.",
    },
  ],
  // o mesmo conteúdo que o gerador usa (blocos24), com o nome da solução como campo
  nivel2: itensDosBlocos(blocos24({ solucao: "{{solucao}}", id: (p) => p })),
  rfid: [
    { tipo: "paragraph", texto: "As liberações de abastecimento contarão com identificação por cartão: {{rfid_quantidade}}, tecnologia {{rfid_tecnologia}}." },
    { tipo: "paragraph", texto: "O terminal T1000 deverá ser compatível com a tecnologia do cartão RFID utilizado pelo cliente." },
  ],
  div: [
    { tipo: "paragraph", texto: "Estão previstos {{div_total}} DIV para a identificação dos veículos e equipamentos abastecidos, conforme a tabela a seguir." },
  ],
  tx: [],
  introducao: [
    {
      tipo: "paragraph",
      destaque: true,
      texto:
        "Este documento apresenta o resultado do mapeamento técnico realizado para {{cliente}}, em atendimento {{modalidade}}, " +
        `referente à {{tipo_acao}} da solução ${NOME_SOLUCAO_ORIGINAL} no escopo: {{objeto_escopo}}.{{origem_dados}}`,
    },
    {
      tipo: "paragraph",
      texto:
        "As informações a seguir descrevem os requisitos de infraestrutura, os produtos IONICS e os materiais necessários para a execução do serviço. " +
        "Itens sinalizados como pendentes de confirmação dependem de validação antes da emissão definitiva do documento.",
    },
  ],
  instrucoes_gerais: [
    {
      tipo: "paragraph",
      texto:
        "A IONICS orienta e auxilia em questões de infraestrutura relacionadas à instalação da sua automação; porém, não se responsabiliza pelos materiais empregados e serviços a serem executados. Sendo assim, cabe ao cliente que as obras de adequação sejam realizadas por pessoal especializado, de modo que atendam as normas de segurança (Mapeamento de risco) e de acordo / em conformidade com a legislação vigente (Instalações em Áreas Classificadas / Atmosferas Explosivas).",
    },
    {
      tipo: "paragraph",
      texto:
        "Se houver necessidade de alteração nos requisitos de infraestrutura solicitados neste documento é importante que seja comunicado imediatamente; dispomos de técnicos que darão o seu parecer e as devidas orientações para viabilizar a implantação da automação; caso contrário a IONICS não responderá por danos, redução da vida útil dos equipamentos e/ou falhas no funcionamento da solução SAAF.",
    },
    {
      tipo: "paragraph",
      texto: "A IONICS coloca o MInfra-001_SAAF e a sua equipe à disposição para auxiliá-los no que for necessário e juntos prosseguir com o projeto de implantação.",
    },
  ],
  consideracoes_finais: [],
  ti_bd: [
    {
      tipo: "bullets",
      itens: [
        "Para operação da automação SAAF é importante que seja disponibilizado um servidor local conectado à rede de internet estável e sem restrições, de modo que possa ser acessado mediante o uso dos aplicativos TeamViewer ou AnyDesk.",
        "Para consultas da automação SAAF é necessário que seja disponibilizado um computador com conexão à rede de internet estável e sem restrições, acessível pelos mesmos aplicativos.",
        "A criação do banco de dados SAAF é pré-requisito para a instalação das aplicações da automação; o script será disponibilizado pela equipe SW/IAM - IONICS de acordo com o cronograma de implantação.",
        "A integração com ERPs também é requisito para operação com o SAAF; a equipe SW/IAM - IONICS dará as instruções para criação das views de importação e exportação de dados.",
      ],
    },
  ],
};

// ------------------------------------------------------------------ escolha da versão

export type VersaoTexto = BlocoPadraoAuto;
/** mapeamento específico: `{ slot: idDaVersao | "sistema" }` ("sistema" = texto original) */
export type EscolhasTexto = Record<string, string>;

/** Slot e "usar como padrão" gravados em `escopo` da versão. */
export function lerSlot(escopo: Record<string, any> | null | undefined): { slot: SlotTexto | null; padrao: boolean } {
  const e = escopo ?? {};
  return { slot: ehSlotTexto(e.slot) ? e.slot : null, padrao: e.padrao === true };
}

/** Monta o `escopo` de uma versão de texto: slot, padrão e as condições (campos vazios não são gravados). */
export function escopoDaVersao(slot: SlotTexto, padrao: boolean, regra: Pick<RegraBlocoPadrao, "solucao" | "nivel" | "exige" | "extras">): Record<string, any> {
  return {
    slot,
    padrao,
    ...(regra.solucao.length ? { solucao: regra.solucao } : {}),
    ...(regra.nivel.length ? { nivel: regra.nivel } : {}),
    ...(regra.exige.length ? { exige: regra.exige } : {}),
    ...(qtdCondicoesExtras(regra) ? { extras: lerExtras(regra.extras) } : {}),
  };
}

const especificidade = (r: RegraBlocoPadrao) => r.solucao.length + r.nivel.length + r.exige.length + qtdCondicoesExtras(r);

/**
 * Versão a usar no slot, ou null para o texto original do sistema.
 * A escolha manual vale mesmo que a condição não seja atendida; versão apagada/inativa cai no padrão.
 */
export function escolherVersao(slot: SlotTexto, versoes: VersaoTexto[], escolhas: EscolhasTexto | null | undefined, a: AvaliacaoRegra): VersaoTexto | null {
  const doSlot = versoes.filter((v) => lerSlot(v.escopo).slot === slot && (v.blocos ?? []).length > 0);
  const escolhida = escolhas?.[slot];
  if (escolhida === "sistema") return null;
  if (escolhida) {
    const manual = doSlot.find((v) => v.id === escolhida);
    if (manual) return manual;
  }
  const candidatas = doSlot
    .filter((v) => lerSlot(v.escopo).padrao && condicoesAtendidas(lerRegra(v.escopo), a))
    .sort((x, y) => especificidade(lerRegra(y.escopo)) - especificidade(lerRegra(x.escopo)) || (x.ordem ?? 0) - (y.ordem ?? 0) || x.nome.localeCompare(y.nome));
  return candidatas[0] ?? null;
}

// ------------------------------------------------------------------ geração dos blocos

type Meta = { chave?: string; origem?: "dynamic"; editavel?: true; removivel?: true };

function blocoDoItem(
  item: ItemTexto,
  campos: CamposTexto,
  id: string,
  meta: Meta,
  proximaFigura?: (() => number) | null,
  imagens?: ImagensBiblioteca | null,
): BlocoLaudo {
  if (item.tipo === "tabela") {
    const r = (t: string) => renderizarCampos(t, campos);
    return {
      id,
      tipo: "table",
      titulo: item.titulo?.trim() ? r(item.titulo) : null,
      colunas: item.colunas.map(r),
      linhas: item.linhas.map((l) => ({ celulas: l.map(r) })),
      origem: "dynamic",
      editavel: true,
      ...meta,
    } as BlocoLaudo;
  }
  if (item.tipo === "figura") {
    const f = FIGURAS_TEXTO[item.nome];
    const n = proximaFigura ? proximaFigura() : null;
    return { id, tipo: "image", url: f.url, alt: f.alt, legenda: n ? `Figura ${n} — ${f.legendaBase}` : f.legendaBase, larguraMax: f.larguraMax, ...meta } as BlocoLaudo;
  }
  if (item.tipo === "imagem") {
    const img = imagens?.[item.id];
    // imagem apagada da biblioteca: nunca some em silêncio (o PDF fica bloqueado até o especialista resolver)
    if (!img?.url) return { id, tipo: "paragraph", texto: pendencia("imagem_biblioteca", "imagem removida da biblioteca — escolha outra ou apague este item"), ...meta } as BlocoLaudo;
    const n = proximaFigura ? proximaFigura() : null;
    const legenda = img.legenda?.trim() || img.nome;
    return { id, tipo: "image", url: img.url, alt: img.alt || img.nome, legenda: n ? `Figura ${n} — ${legenda}` : legenda, larguraMax: img.larguraMax, bibliotecaId: img.id, ...meta } as BlocoLaudo;
  }
  // ordem dos campos preservada (a mescla compara o conteúdo gerado com o salvo)
  if (item.tipo === "bullets") return { id, tipo: "bullets", itens: item.itens.map((x) => renderizarCampos(x, campos, { escapar: !!item.rico })), ...(item.rico ? { rico: true } : {}), ...meta } as BlocoLaudo;
  const texto = renderizarCampos(item.texto, campos, { escapar: !!item.rico });
  return {
    id,
    tipo: "paragraph",
    ...(item.destaque ? { destaque: "editavel" } : {}),
    ...(item.rico ? { rico: true } : {}),
    ...(item.alinhamento ? { alinhamento: item.alinhamento } : {}),
    ...(item.caixaAlta ? { caixaAlta: true } : {}),
    texto,
    ...meta,
  } as BlocoLaudo;
}

const prefixoId = (item: ItemTexto) => (item.tipo === "bullets" ? "bl" : item.tipo === "tabela" ? "t" : item.tipo === "figura" || item.tipo === "imagem" ? "img" : "p");

/** Blocos de uma versão cadastrada: chave estável `texto:<slot>:<versão>:<posição>` (a edição manual sobrevive ao regerar). */
export function blocosDaVersao(entrada: {
  slot: SlotTexto;
  versao: VersaoTexto;
  campos: CamposTexto;
  id: (prefixo: string) => string;
  /** numeração das figuras do documento (desenhos `[figura:…]` e imagens `[imagem:…]`) */
  proximaFigura?: (() => number) | null;
  /** biblioteca de imagens (para resolver `[imagem:<id>]`) */
  imagens?: ImagensBiblioteca | null;
}): BlocoLaudo[] {
  const { slot, versao, campos, id, proximaFigura, imagens } = entrada;
  return blocosParaItens(versao.blocos).map((item, i) =>
    blocoDoItem(item, campos, id(prefixoId(item)), { chave: `texto:${slot}:${versao.id}:${i}`, origem: "dynamic", editavel: true, removivel: true }, proximaFigura, imagens),
  );
}

/**
 * Texto do slot: a versão escolhida ou, sem ela, o texto original do sistema.
 * `chaveSistema` mantém as chaves que o texto original já tinha (documentos antigos continuam casando na mescla).
 */
export function blocosDoSlot(entrada: {
  slot: SlotTexto;
  versao: VersaoTexto | null;
  campos: CamposTexto;
  id: (prefixo: string) => string;
  chaveSistema?: (posicao: number) => string;
  proximaFigura?: (() => number) | null;
  imagens?: ImagensBiblioteca | null;
}): BlocoLaudo[] {
  const { slot, versao, campos, id, chaveSistema, proximaFigura, imagens } = entrada;
  if (versao) return blocosDaVersao({ slot, versao, campos, id, proximaFigura, imagens });
  return TEXTO_ORIGINAL[slot].map((item, i) =>
    blocoDoItem(item, campos, id(prefixoId(item)), chaveSistema ? { chave: chaveSistema(i), origem: "dynamic", editavel: true } : {}),
  );
}

/** Prefixo das chaves dos blocos de um slot no documento (para avisar sobre edições manuais ao trocar de versão). */
export const prefixosDoSlot = (slot: SlotTexto): string[] => [`texto:${slot}:`, ...(slot === "instrucoes_gerais" ? ["instrucoes:"] : [])];

/** Nome da próxima versão: "Introdução" → "Introdução v2"; "Introdução v2" → "Introdução v3" (sem repetir nome existente). */
export function nomeDaNovaVersao(nome: string, existentes: string[]): string {
  const m = nome.trim().match(/^(.*?)\s+v(\d+)$/i);
  const base = m ? m[1] : nome.trim();
  let n = m ? Number(m[2]) + 1 : 2;
  while (existentes.some((e) => e.trim().toLowerCase() === `${base} v${n}`.toLowerCase())) n++;
  return `${base} v${n}`;
}
