// Monta a árvore de blocos do laudo no padrão FR-31-10.

import { normalizarBitola } from "./catalogo-produtos";
import type { ProdutoProposta } from "./produtos-proposta";

import {
  alertasDoContexto,
  materiaisAplicaveis,
  type ContextoRegras,
  type MaterialCatalogo,
} from "./regras";
import { blocosNivel2, ehNivel2 } from "./blocos-nivel2";
import { analisarMapeamento, achadosDaSecao, type Achado } from "./analise/achados";
import { blocosDosAchados, resetSequenciaRedacao } from "./analise/redacao";
import { pendencia, type BlocoLaudo, type VariaveisLaudo } from "./tipos";
import { limparTexto, objetosValidos, pareceLixo } from "@/lib/texto";

export type CabecalhoLaudo = {
  cliente: string;
  unidade: string;
  data: string;
  agente: string;
  especialista: string;
  modalidade: string | null;
};

export type EntradaTemplate = {
  variaveis: VariaveisLaudo;
  materiais: MaterialCatalogo[];
  cabecalho: CabecalhoLaudo;
  /** achados de análise técnica descartados pelo especialista */
  achadosDescartados?: string[];
  /** produtos contratados, extraídos da proposta comercial do caso */
  produtosProposta?: ProdutoProposta[];
};

/** chaves de texto livre onde valores sem sentido não podem ir para o documento */
const CHAVES_TEXTO_LIVRE = new Set([
  "marca_veiculo",
  "objeto_escopo",
  "nome_solucao",
  "nome_cliente",
  "compartimento_dimensao",
]);

function v(vars: VariaveisLaudo, chave: string, rotulo?: string): string {
  const item = vars[chave];
  const valor = limparTexto(item?.valor);
  if (!valor) return pendencia(chave, rotulo);
  if (CHAVES_TEXTO_LIVRE.has(chave) && pareceLixo(valor)) return pendencia(chave, rotulo);
  return valor;
}

function raw(vars: VariaveisLaudo, chave: string): string | null {
  return limparTexto(vars[chave]?.valor) || null;
}


function bool(vars: VariaveisLaudo, chave: string): boolean | null {
  const val = (raw(vars, chave) ?? "").toLowerCase().trim();
  if (!val) return null;
  if (["sim", "s", "true", "yes", "1"].includes(val)) return true;
  if (["nao", "não", "n", "false", "no", "0"].includes(val)) return false;
  return null;
}

function num(vars: VariaveisLaudo, chave: string): number | null {
  const val = raw(vars, chave);
  if (!val) return null;
  const n = parseInt(val.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function idsObjetos(vars: VariaveisLaudo): string[] {
  const val = raw(vars, "ids_objetos");
  if (!val) return [];
  return objetosValidos(val.split(/[,;\n]/));
}


let seq = 0;
const bid = (p: string) => `${p}-${++seq}`;

let figSeq = 0;
const proximaFigura = () => ++figSeq;

export function montarBlocos(entrada: EntradaTemplate): BlocoLaudo[] {
  return montarBlocosEAnalise(entrada).blocos;
}

export function montarBlocosEAnalise(entrada: EntradaTemplate): {
  blocos: BlocoLaudo[];
  achados: Achado[];
} {
  seq = 0;
  figSeq = 0;
  resetSequenciaRedacao();
  const vars = entrada.variaveis;
  const blocos: BlocoLaudo[] = [];

  const nivel = raw(vars, "nivel_servico");
  const bitola = normalizarBitola(raw(vars, "bitola_bico"));
  const tipoObjeto = (raw(vars, "tipo_objeto") ?? "").toLowerCase() || null;
  const ctxRegras: ContextoRegras = {
    nivel,
    bitola,
    tipoObjeto,
    areaClassificada: bool(vars, "area_classificada"),
    usaConversor: bool(vars, "usa_conversor_24_12"),
    terminalAtual: raw(vars, "terminal_atual"),
    rfid: bool(vars, "rfid"),
  };

  // Camada de análise técnica: os dados do FR-29-10 viram conclusões e
  // recomendações. O especialista pode descartar achados na revisão.
  const descartados = new Set(entrada.achadosDescartados ?? []);
  const achados = analisarMapeamento({ variaveis: vars, bitola, nivel });
  const achadosAtivos = achados.filter((a) => !descartados.has(a.chave));
  const secao = (s: "2.1" | "2.2" | "2.3" | "2.4") =>
    blocosDosAchados(achadosDaSecao(achadosAtivos, s));

  // ---------- 1. Introdução ----------
  blocos.push({ id: bid("h"), tipo: "heading", numero: "1", texto: "Introdução", nivel: 1 });
  blocos.push({
    id: bid("p"),
    tipo: "paragraph",
    texto:
      `Este documento apresenta o resultado do mapeamento técnico realizado para ${v(vars, "nome_cliente", "nome do cliente")}, ` +
      `em atendimento ${v(vars, "modalidade", "modalidade")}, referente à ${v(vars, "tipo_acao", "tipo de ação (instalação ou upgrade)")} ` +
      `da solução ${v(vars, "nome_solucao", "nome da solução")} no escopo: ${v(vars, "objeto_escopo", "objeto do escopo")}.`,
  });
  blocos.push({
    id: bid("p"),
    tipo: "paragraph",
    texto:
      "As informações a seguir descrevem os requisitos de infraestrutura, os produtos IONICS e os materiais necessários para a execução do serviço. " +
      "Itens sinalizados como [CONFIRMAR: ...] dependem de validação antes da emissão definitiva do documento.",
  });

  // ---------- Observações técnicas relevantes (após a introdução) ----------
  const alertas = alertasDoContexto(ctxRegras);
  if (alertas.length) {
    blocos.push({
      id: bid("h"),
      tipo: "heading",
      numero: null,
      texto: "Observações técnicas relevantes",
      nivel: 2,
    });
    for (const a of alertas) blocos.push(a);
  }


  // ---------- 2. Requisitos de infraestrutura ----------
  blocos.push({
    id: bid("h"),
    tipo: "heading",
    numero: "2",
    texto: "Requisitos de infraestrutura",
    nivel: 1,
  });

  // 2.1 TI — a seção existe sempre; a especificação é revisada/preenchida pelo especialista
  const jaTemSaaf = bool(vars, "cliente_ja_tem_saaf") === true;
  const variante = (raw(vars, "infra_ti_variante") ?? (jaTemSaaf ? "D" : "A")).toUpperCase();
  blocos.push({
    id: bid("h"),
    tipo: "heading",
    numero: "2.1",
    texto: "Equipamentos de TI e banco de dados",
    nivel: 2,
  });
  if (variante === "D") {
    blocos.push({
      id: bid("bl"),
      tipo: "bullets",
      itens: [
        "O cliente já dispõe da Solução SAAF em operação; serão utilizados os equipamentos e o banco de dados existentes.",
        "O computador no qual estão conectados os equipamentos da automação precisará dispor de entrada USB livre para conexão da Base Modem Amplificada Antena Externa (a ser adquirida caso não disponha).",
        "A criação/atualização do banco de dados SAAF é pré-requisito para a instalação das aplicações; o script será disponibilizado pela equipe SW/IAM - IONICS.",
      ],
    });
  } else if (variante === "B_REDUZIDA") {
    blocos.push({
      id: bid("bl"),
      tipo: "bullets",
      itens: [
        "É necessário um microcomputador dedicado à aplicação, com acesso à rede local e ao ponto de comunicação do terminal, mantido ligado durante a operação.",
        "A criação do banco de dados SAAF é pré-requisito para a instalação das aplicações da automação; o script será disponibilizado pela equipe SW/IAM - IONICS.",
      ],
    });
  } else {
    blocos.push({
      id: bid("bl"),
      tipo: "bullets",
      itens: [
        "Para operação da automação SAAF é importante que seja disponibilizado um servidor local conectado à rede de internet estável e sem restrições, de modo que possa ser acessado mediante o uso dos aplicativos TeamViewer ou AnyDesk.",
        "Para consultas da automação SAAF é necessário que seja disponibilizado um computador com conexão à rede de internet estável e sem restrições, acessível pelos mesmos aplicativos.",
        "A criação do banco de dados SAAF é pré-requisito para a instalação das aplicações da automação; o script será disponibilizado pela equipe SW/IAM - IONICS de acordo com o cronograma de implantação.",
        "A integração com ERPs também é requisito para operação com o SAAF; a equipe SW/IAM - IONICS dará as instruções para criação das views de importação e exportação de dados.",
      ],
    });
  }

  // Bloco de equipamentos: sempre presente, para ajuste/preenchimento pelo especialista.
  blocos.push({
    id: bid("t"),
    tipo: "table",
    titulo: "Especificação do servidor (a validar pelo especialista)",
    colunas: ["Item", "Especificação mínima"],
    origem: "dynamic",
    editavel: true,
    linhas: [
      { celulas: ["Processador", "Intel Core i5 ou superior"] },
      { celulas: ["Memória", "8 GB RAM"] },
      { celulas: ["Armazenamento", "256 GB SSD"] },
      { celulas: ["Sistema operacional", "Windows 10/11 ou Windows Server"] },
      { celulas: ["Banco de dados", "SQL Server / PostgreSQL conforme projeto"] },
      { celulas: ["Rede", "Ethernet 100/1000 Mbps com acesso ao ponto de comunicação do terminal"] },
      ...(variante === "B_COMPLETA"
        ? [{ celulas: ["Expansão", "Slot disponível para módulo GSM"] }]
        : []),
    ],
  });
  blocos.push({
    id: bid("t"),
    tipo: "table",
    titulo: "Especificação do computador de consulta (a validar pelo especialista)",
    colunas: ["Item", "Especificação mínima"],
    origem: "dynamic",
    editavel: true,
    linhas: [
      { celulas: ["Processador", "Intel Core i3 ou superior"] },
      { celulas: ["Memória", "8 GB RAM"] },
      { celulas: ["Armazenamento", "256 GB SSD"] },
      { celulas: ["Sistema operacional", "Windows 10/11"] },
      { celulas: ["Rede", "Acesso à internet estável e sem restrições (TeamViewer / AnyDesk)"] },
    ],
  });
  blocos.push({
    id: bid("o"),
    tipo: "observacao",
    titulo: "OBSERVAÇÃO TÉCNICA",
    texto:
      "As especificações de TI acima são o padrão IONICS e devem ser conferidas/ajustadas pelo especialista em automação conforme o porte da operação do cliente.",
    origem: "dynamic",
    editavel: true,
  });


  // 2.2 Transferência de dados — numeração sequencial conforme o que é incluído
  blocos.push({
    id: bid("h"),
    tipo: "heading",
    numero: "2.2",
    texto: "Transferência de dados",
    nivel: 2,
  });
  let sub22 = 0;
  const num22 = () => `2.2.${++sub22}`;
  const achadosComunicacao = achadosDaSecao(achadosAtivos, "2.2");
  const achadoWifi = achadosComunicacao.filter((a) => a.chave === "comunicacao_wifi");
  const achadoGsm = achadosComunicacao.filter((a) => a.chave === "comunicacao_gsm");

  blocos.push({ id: bid("h"), tipo: "heading", numero: num22(), texto: "WiFi", nivel: 3 });
  if (achadoWifi.length) {
    // A conclusão técnica derivada dos dados substitui o texto genérico.
    blocos.push(...blocosDosAchados(achadoWifi));
  } else {
    blocos.push({
      id: bid("p"),
      tipo: "paragraph",
      texto:
        "A transferência por WiFi exige cobertura de sinal estável no ponto de abastecimento, com rede dedicada ou liberação das portas de comunicação utilizadas pela aplicação.",
    });
  }
  const comunicacao = (raw(vars, "comunicacao_tipos") ?? "").toLowerCase();
  if (achadoGsm.length || comunicacao.includes("4g") || comunicacao.includes("gsm")) {
    blocos.push({ id: bid("h"), tipo: "heading", numero: num22(), texto: "GSM / 4G", nivel: 3 });
    if (achadoGsm.length) {
      blocos.push(...blocosDosAchados(achadoGsm));
    } else {
      blocos.push({
        id: bid("p"),
        tipo: "paragraph",
        texto:
          "Onde não houver cobertura WiFi, a comunicação será feita por GSM/4G, com chip de dados fornecido pelo cliente e antena externa instalada em ponto de boa recepção.",
      });
    }
  }
  blocos.push({ id: bid("h"), tipo: "heading", numero: num22(), texto: "Rádio 2.4GHz", nivel: 3 });
  blocos.push({
    id: bid("p"),
    tipo: "paragraph",
    texto:
      "A comunicação entre o terminal e os periféricos sem fio ocorre em rádio 2.4GHz, com alcance sujeito a obstruções metálicas e à distância entre os módulos.",
  });

  // 2.3 Objeto do mapeamento — repetível
  blocos.push({
    id: bid("h"),
    tipo: "heading",
    numero: "2.3",
    texto: "Objeto do mapeamento",
    nivel: 2,
  });

  const ids = idsObjetos(vars);
  const grupos = ids.length
    ? ids
    : [raw(vars, "objeto_escopo") ?? pendencia("ids_objetos", "identificação dos objetos")];
  const materiais = materiaisAplicaveis(entrada.materiais, ctxRegras);
  // Produtos IONICS vêm EXCLUSIVAMENTE da proposta comercial do caso.
  // Regras técnicas não geram produtos contratados.
  const produtos = entrada.produtosProposta ?? [];


  const varios = grupos.length > 1;
  // Quando a análise técnica já descreve o objeto (bomba e/ou pista), o
  // parágrafo genérico do template antigo é suprimido para não duplicar
  // nem contradizer as conclusões derivadas dos dados.
  const achados23 = achadosDaSecao(achadosAtivos, "2.3");
  const descreveObjeto = achados23.some(
    (a) => a.chave === "bomba_identificacao" || a.chave === "pista_abastecimento",
  );
  grupos.forEach((grupo, i) => {
    const numero = varios ? `2.3.${i + 1}` : null;
    blocos.push({ id: bid("h"), tipo: "heading", numero, texto: grupo, nivel: 3 });
    if (descreveObjeto) return;
    blocos.push({
      id: bid("p"),
      tipo: "paragraph",
      texto:
        `Objeto ${grupo} — ${v(vars, "marca_veiculo", "marca/modelo do objeto")}, ` +
        `com ${v(vars, "qtd_bicos", "quantidade de bicos")} bico(s) de abastecimento, bitola ${v(vars, "bitola_bico", "bitola do bico")}, ` +
        `vazão de ${v(vars, "vazao", "vazão")} e tensão disponível de ${v(vars, "tensao_veiculo", "tensão do objeto")}. ` +
        `O terminal T1000 será instalado em compartimento de ${v(vars, "compartimento_dimensao", "dimensão do compartimento")}.`,
    });
  });

  // Análise técnica do cenário físico (bomba, registrador, bloco medidor, pista).
  blocos.push(...blocosDosAchados(achados23));

  // Produtos e materiais são idênticos para todos os objetos: uma tabela só.
  if (varios) {
    blocos.push({
      id: bid("h"),
      tipo: "heading",
      numero: `2.3.${grupos.length + 1}`,
      texto: "Produtos e materiais aplicáveis",
      nivel: 3,
    });
  }
  blocos.push({
    id: bid("t"),
    tipo: "table",
    titulo: "Produtos IONICS",
    colunas: ["Código", "Descrição", "Qtd."],
    origem: "dynamic",
    editavel: true,
    // Sem proposta com itens identificados a tabela nasce vazia, para o
    // especialista incluir manualmente os produtos contratados.
    linhas: produtos.map((p) => ({
      celulas: [p.codigo ?? "—", p.descricao, p.quantidade ?? "—"],
    })),
  });
  blocos.push({
    id: bid("t"),
    tipo: "table",
    titulo: "Materiais de infraestrutura",
    colunas: ["Código", "Descrição", "Aplicação", "Un.", "Qtd."],
    linhas: materiais.length
      ? materiais.map((m) => ({
          celulas: [
            m.codigo,
            m.descricao,
            m.aplicacao ?? "—",
            m.unidade,
            String(m.quantidade_padrao),
          ],
        }))
      : [
          {
            celulas: [
              "—",
              `Nenhum material aplicável às regras atuais ${pendencia("materiais", "materiais de infraestrutura")}`,
              "—",
              "—",
              "—",
            ],
          },
        ],
  });

  if (!produtos.length) {
    blocos.push({
      id: bid("n"),
      tipo: "notes",
      origem: "dynamic",
      editavel: true,
      itens: [
        "Nenhum produto identificado na proposta comercial anexada. O especialista deve incluir os produtos contratados nesta tabela.",
      ],
    });
  }


  // 2.4 Bicos de abastecimento
  // No Nível 2 o conteúdo dos bicos é o bloco estrutural da seção VII
  // (2.4 / 2.4.1). Aqui só entra o texto genérico dos demais níveis, para
  // não duplicar título nem desenho.
  const nivel2 = ehNivel2(nivel);
  if (!nivel2) {
    blocos.push({
      id: bid("h"),
      tipo: "heading",
      numero: "2.4",
      texto: "Bicos de abastecimento",
      nivel: 2,
    });
    blocos.push({
      id: bid("p"),
      tipo: "paragraph",
      texto:
        "No nível de serviço contratado não há instalação de medidor de vazão na linha; o controle é feito pelo terminal e pelos sensores de acionamento.",
    });
    blocos.push(...secao("2.4"));
    blocos.push({
      id: bid("t"),
      tipo: "table",
      titulo: "Dimensões de referência",
      colunas: ["Bitola", "Faixa de vazão", "Conexão"],
      linhas: [
        { celulas: ['1/2"', "5 a 40 L/min", "Rosca BSP"] },
        { celulas: ['3/4"', "10 a 90 L/min", "Rosca BSP"] },
        { celulas: ['1"', "20 a 150 L/min", "Rosca BSP"] },
      ],
    });
    blocos.push({
      id: bid("p"),
      tipo: "paragraph",
      texto:
        "Somente componentes homologados pela IONICS devem ser utilizados na linha de abastecimento. O uso de itens não homologados invalida a garantia do equipamento.",
    });
  }

  // ---------- VII. Blocos padrão condicionais (Nível 2 / Comboio) ----------
  blocos.push(...blocosNivel2({ nivel, variaveis: vars, bid, proximaFigura }));
  if (nivel2) {
    // conclusões da análise técnica sobre bicos seguem após a seção estrutural
    blocos.push(...secao("2.4"));
  }


  // ---------- 3. Instruções gerais ----------

  blocos.push({
    id: bid("h"),
    tipo: "heading",
    numero: "3",
    texto: "Instruções gerais",
    nivel: 1,
  });
  blocos.push({
    id: bid("bl"),
    tipo: "bullets",
    itens: [
      `A infraestrutura elétrica e hidráulica é de responsabilidade do cliente e deve estar concluída antes da instalação da solução ${v(vars, "nome_solucao", "nome da solução")}.`,
      "O local de instalação deve permitir acesso seguro ao terminal e aos sensores para manutenção.",
      "Alterações de escopo após a emissão deste documento exigem novo mapeamento técnico.",
      "A IONICS não se responsabiliza por instalações executadas fora das especificações deste documento.",
    ],
  });

  return { blocos, achados };
}
