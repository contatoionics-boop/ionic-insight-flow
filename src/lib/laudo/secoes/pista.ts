// Seção PISTA DE ABASTECIMENTO por bomba (Fase 2 do documento mestre). Função pura.
//
// Uma bomba do Escopo = um bloco de descrição, com as respostas DAQUELA bomba (e dos bicos dela).
// A redação reaproveita as regras de análise técnica (`analisarMapeamento`), alimentadas só com os dados
// da bomba, de modo que várias bombas nunca se misturam. Cada bloco tem chave estável pela entidade
// (`bomba:<id>:…`): a identidade nunca depende do texto gerado e a edição manual sobrevive ao regerar.

import type { BombaCtx, ContextoLaudo } from "@/lib/laudo/contexto";
import { analisarMapeamento, achadosDaSecao } from "@/lib/laudo/analise/achados";
import type { BlocoLaudo, VariaveisLaudo } from "@/lib/laudo/tipos";
import { bitolaDosBicos, rotulosDasBombas } from "./projeto";

const sim = (v: string | undefined) => ["sim", "s", "true", "1", "yes"].includes((v ?? "").trim().toLowerCase());

/** As respostas da bomba (e, na falta, as do primeiro bico que as tenha) como variáveis para a análise. */
function variaveisDaBomba(b: BombaCtx): VariaveisLaudo {
  const juntos: Record<string, string> = {};
  for (const bico of b.bicos) for (const [k, v] of Object.entries(bico.atributos)) juntos[k] ??= v;
  const todos = { ...juntos, ...b.atributos };
  return Object.fromEntries(
    Object.entries(todos).map(([chave, valor]) => [chave, { chave, valor, origem: "formulario", confianca: 1 }]),
  ) as VariaveisLaudo;
}

/** Os bicos da bomba, em uma frase; bomba sem bico é dita como tal. */
function frasesDosBicos(b: BombaCtx): string | null {
  if (sim(b.atributos.bico_ausente)) return "A bomba não possui bico de abastecimento.";
  if (!b.qtdBicos) return null;
  const partes = [`A bomba possui ${b.qtdBicos} bico${b.qtdBicos === 1 ? "" : "s"} de abastecimento`];
  const mangueira = [...new Set(b.bicos.map((k) => k.atributos.bitola_mangueira).filter(Boolean))];
  if (mangueira.length) partes.push(`com mangueira de ${mangueira.join(" / ")}`);
  const bitola = bitolaDosBicos(b.bicos);
  if (bitola.length) partes.push(`bitola do bico ${bitola.join(" / ")}`);
  const modelo = [...new Set(b.bicos.map((k) => [k.atributos.marca_bico, k.atributos.modelo_bico].filter(Boolean).join(" ")).filter(Boolean))];
  if (modelo.length) partes.push(`bico ${modelo.join(" / ")}`);
  return `${partes.join(", ")}.`;
}

/** Pontos de atenção deduzíveis só dos dados da bomba (sem texto técnico novo além do óbvio). */
function pontosDeAtencao(b: BombaCtx): string[] {
  const pontos: string[] = [];
  const altaVazao = sim(b.atributos.alta_vazao);
  const semBico = sim(b.atributos.bico_ausente);
  if (altaVazao && semBico)
    pontos.push("Bomba de alta vazão (transferência para comboios) sem bico de abastecimento: confirmar com o cliente como será feito o controle do abastecimento.");
  else if (semBico) pontos.push("Bomba sem bico de abastecimento: confirmar com o cliente como será feito o controle do abastecimento.");
  else if (altaVazao) pontos.push("Bomba de alta vazão (transferência para comboios): conferir a faixa de vazão antes de dimensionar o medidor.");
  return pontos;
}

/**
 * Blocos da pista, um grupo por bomba do Escopo; `null` quando o Escopo não tem bombas
 * (o documento segue com o fluxo anterior, por respostas únicas).
 */
export function blocosPista(entrada: {
  contexto: ContextoLaudo | null;
  nivel: string | null;
  id: (prefixo: string) => string;
}): BlocoLaudo[] | null {
  const { contexto, nivel, id } = entrada;
  if (!contexto?.escopo.temPista || !contexto.bombas.length) return null;
  const rotulos = rotulosDasBombas(contexto.bombas);
  const varias = contexto.bombas.length > 1;
  const blocos: BlocoLaudo[] = [];

  contexto.bombas.forEach((b, i) => {
    const chave = (sufixo: string) => `bomba:${b.id}:${sufixo}`;
    const meta = { origem: "dynamic", editavel: true, removivel: true } as const;
    blocos.push({ id: id("h"), chave: chave("titulo"), tipo: "heading", numero: varias ? `2.3.${i + 1}` : null, texto: rotulos[i], nivel: 3, ...meta } as BlocoLaudo);

    const vars = variaveisDaBomba(b);
    const bitola = bitolaDosBicos(b.bicos)[0] ?? null;
    const achados = achadosDaSecao(analisarMapeamento({ variaveis: vars, bitola, nivel }), "2.3");
    const recomendacoes: string[] = [];
    let resumido = false;
    for (const a of achados) {
      const ehResumo = a.chave === "bomba_identificacao";
      blocos.push({ id: id("p"), chave: chave(ehResumo ? "resumo" : a.chave), tipo: "paragraph", texto: a.conclusao, ...meta } as BlocoLaudo);
      if (ehResumo) {
        resumido = true;
        const bicos = frasesDosBicos(b);
        if (bicos) blocos.push({ id: id("p"), chave: chave("bicos"), tipo: "paragraph", texto: bicos, ...meta } as BlocoLaudo);
      }
      recomendacoes.push(...a.recomendacoes);
    }
    if (!resumido) {
      // sem dados da bomba: o resumo nasce como pendência, nunca em branco
      const bicos = frasesDosBicos(b);
      if (bicos) blocos.push({ id: id("p"), chave: chave("bicos"), tipo: "paragraph", texto: bicos, ...meta } as BlocoLaudo);
    }
    const itens = [...new Set([...pontosDeAtencao(b), ...recomendacoes])];
    if (itens.length) blocos.push({ id: id("bl"), chave: chave("pontos_atencao"), tipo: "bullets", itens, ...meta } as BlocoLaudo);
  });
  return blocos;
}
