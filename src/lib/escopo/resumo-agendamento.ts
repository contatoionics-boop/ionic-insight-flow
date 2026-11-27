import { pluralDoTipo, rotuloDoTipo, type TipoCatalogo } from "./catalogo-tipos";
import { CONEXOES_DADOS, resumoArvore, totalRfid, type ArvoreEscopo } from "./tipos";
import { rotuloOpcao, type OpcaoAgendamento } from "@/lib/opcoes-agendamento";

export type LinhaResumoEscopo = { grupo: string; itens: string[] };

const quantidade = (n: number, singular: string, plural: string) => n > 0 ? n + " " + (n === 1 ? singular : plural) : "";

export function resumoEscopoAgendamento(
  arvore: ArvoreEscopo,
  catalogo: TipoCatalogo[],
  opcoes: OpcaoAgendamento[],
): LinhaResumoEscopo[] {
  const r = resumoArvore(arvore);
  const c = arvore.config ?? {};
  const linhas: LinhaResumoEscopo[] = [];
  const adicionar = (grupo: string, itens: string[]) => {
    const preenchidos = itens.filter(Boolean);
    if (preenchidos.length) linhas.push({ grupo, itens: preenchidos });
  };
  const contarTipo = (chave: string, n: number) => quantidade(n, rotuloDoTipo(catalogo, chave).toLocaleLowerCase("pt-BR"), pluralDoTipo(catalogo, chave).toLocaleLowerCase("pt-BR"));

  adicionar("Pista", [contarTipo("posto", r.postos), contarTipo("ilha", r.ilhas), contarTipo("bomba", r.bombas), contarTipo("bico", r.bicos)]);
  adicionar("Comboios", [contarTipo("comboio", r.comboios), contarTipo("tanque", r.tanquesComboio), contarTipo("bico", r.bicosComboio)]);
  adicionar("Outros itens a mapear", [
    contarTipo("tanque_lubrificante", r.tanques),
    contarTipo("sonda", r.sondas),
    ...Object.entries(r.extras).map(([chave, n]) => contarTipo(chave, n)),
    r.frota ? quantidade(arvore.frota.itens.filter((item) => item.modelo.trim()).length, "modelo de veículo", "modelos de veículo") || "Frota / DIV" : "",
  ]);
  adicionar("Solução", [rotuloOpcao("solucao", c.solucao, opcoes) ?? ""]);
  adicionar("Equipamentos contratados", [quantidade(c.equipamentos?.filter((item) => item.descricao.trim() || item.codigo?.trim()).length ?? 0, "item", "itens")]);
  const conexao = (valor: string | null | undefined) => CONEXOES_DADOS.find((item) => item.value === valor)?.label ?? "";
  const posto = r.postos ? conexao(c.comunicacao_posto ?? c.comunicacao) : "";
  const comboio = r.comboios ? conexao(c.comunicacao_comboio ?? c.comunicacao) : "";
  adicionar("Conexão de dados", [posto && posto + " na pista", comboio && comboio + " nos comboios"]);
  adicionar("Dispositivos", [
    c.rfid?.ativo ? quantidade(totalRfid(c.rfid.itens), "cartão RFID", "cartões RFID") || "RFID" : "",
    c.tx?.ativo ? quantidade(c.tx.itens.reduce((total, item) => total + item.quantidade, 0), "transmissor TX", "transmissores TX") || "TX" : "",
    quantidade(c.outros?.filter((item) => item.nome.trim()).length ?? 0, "outro tipo de dispositivo", "outros tipos de dispositivo"),
  ]);
  return linhas;
}
