// Rascunho determinístico (sem IA) das orientações ao agente a partir do que o
// agendador já informou. Código puro (client-safe).

import type { EscopoProposta } from "@/lib/proposta/tipos";
import { resumoArvore, rotuloSolucao, type ArvoreEscopo } from "@/lib/escopo/tipos";

const COMUNICACAO: Record<string, string> = { wifi: "Wi-Fi", "4g": "4G", ambos: "Wi-Fi e 4G" };

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

export function montarOrientacoes(
  escopo: EscopoProposta | null,
  arvore: ArvoreEscopo,
  textoManual?: string,
): string {
  const linhas: string[] = [];

  const solucao = rotuloSolucao(arvore.config?.solucao ?? null) || escopo?.nome_solucao?.valor;
  if (solucao) linhas.push(`Solução: ${solucao}`);
  const cfg = arvore.config;
  if (cfg?.equipamentos?.length)
    linhas.push(
      `Equipamentos vendidos: ${cfg.equipamentos
        .map((e) => `${e.quantidade}× ${e.descricao}${e.codigo ? ` (${e.codigo})` : ""}`)
        .join("; ")}`,
    );
  if (cfg?.rfid?.ativo && cfg.rfid.itens.length)
    linhas.push(`Cartão RFID: ${cfg.rfid.itens.map((i) => `${i.quantidade}× ${i.tecnologia}`).join(", ")}`);
  if (cfg?.tx?.ativo && cfg.tx.itens.length)
    linhas.push(`TX: ${cfg.tx.itens.map((i) => `${i.quantidade}× ${i.modelo}`).join(", ")}`);
  if (cfg?.outros?.length)
    linhas.push(`Outros dispositivos: ${cfg.outros.map((o) => `${o.quantidade}× ${o.nome}`).join(", ")}`);
  const comunicacao = arvore.config?.comunicacao || escopo?.comunicacao_prevista?.valor;
  if (comunicacao) linhas.push(`Comunicação prevista: ${COMUNICACAO[comunicacao] ?? comunicacao}`);

  const r = resumoArvore(arvore);
  const estrutura: string[] = [];
  if (r.postos) estrutura.push(plural(r.postos, "posto", "postos"));
  if (r.ilhas) estrutura.push(plural(r.ilhas, "ilha", "ilhas"));
  if (r.bombas) estrutura.push(plural(r.bombas, "bomba", "bombas"));
  if (r.bicos) estrutura.push(plural(r.bicos, "bico", "bicos"));
  if (r.tanques) estrutura.push(plural(r.tanques, "tanque com lubrificante", "tanques com lubrificante"));
  if (r.sondas) estrutura.push(plural(r.sondas, "sonda", "sondas"));
  if (r.comboios) {
    const detalhe = [
      r.tanquesComboio ? plural(r.tanquesComboio, "tanque", "tanques") : null,
      r.bicosComboio ? plural(r.bicosComboio, "bico", "bicos") : null,
    ].filter(Boolean);
    estrutura.push(plural(r.comboios, "comboio", "comboios") + (detalhe.length ? ` (${detalhe.join(", ")})` : ""));
  }
  if (r.frota) estrutura.push("Frota/DIV");
  if (estrutura.length) linhas.push(`Estrutura a mapear: ${estrutura.join(", ")}.`);

  const naoInclusos = escopo?.itens_nao_inclusos?.valor;
  if (naoInclusos?.length) linhas.push(`Não incluso no escopo: ${naoInclusos.join("; ")}.`);
  const obs = escopo?.observacoes_preliminares?.valor;
  if (obs?.length) linhas.push(`Observações da proposta: ${obs.join("; ")}.`);

  const manual = textoManual?.trim();
  if (manual) linhas.push(`Descrição do escopo: ${manual}`);

  return linhas.join("\n");
}
