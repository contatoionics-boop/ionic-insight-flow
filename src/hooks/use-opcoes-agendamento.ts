import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { camposAtuais, definirCampos, definirOpcoes, opcoesAtuais, type CampoAgendamento, type OpcaoAgendamento } from "@/lib/opcoes-agendamento";

/**
 * Opções do agendamento (tipo de solicitação, modalidade, nível, solução) com os nomes configurados.
 * Lê direto do banco (leitura liberada a todos os autenticados) e atualiza a cópia em memória usada pelas
 * funções de rótulo. Sem a tabela (migration pendente) valem os padrões. Chame `recarregarOpcoesAgendamento()`
 * depois de salvar em Configurações.
 */
let carregado = false;
let carregando: Promise<OpcaoAgendamento[]> | null = null;
const ouvintes = new Set<(o: OpcaoAgendamento[]) => void>();

async function ler(): Promise<OpcaoAgendamento[]> {
  try {
    const { data, error } = await (supabase as any).from("opcoes_agendamento").select("campo, valor, rotulo, ativo, ordem, sistema");
    // campos criados pelo gestor (tabela ausente = só os fixos)
    const campos = await (supabase as any).from("campos_agendamento").select("chave, titulo, descricao, obrigatorio, ativo, ordem");
    definirCampos(campos.error ? null : campos.data);
    return error ? definirOpcoes() : definirOpcoes(data);
  } catch {
    definirCampos();
    return definirOpcoes();
  }
}

export function recarregarOpcoesAgendamento(): Promise<OpcaoAgendamento[]> {
  carregando = ler().then((o) => {
    carregado = true;
    ouvintes.forEach((f) => f(o));
    return o;
  });
  return carregando;
}

/** Os campos do agendamento (os quatro fixos + os criados pelo gestor), atualizados quando as opções carregam. */
export function useCamposAgendamento(): CampoAgendamento[] {
  useOpcoesAgendamento();
  return camposAtuais();
}

export function useOpcoesAgendamento(): OpcaoAgendamento[] {
  const [opcoes, setOpcoes] = useState<OpcaoAgendamento[]>(opcoesAtuais());
  useEffect(() => {
    ouvintes.add(setOpcoes);
    if (!carregado) void (carregando ?? recarregarOpcoesAgendamento());
    else setOpcoes(opcoesAtuais());
    return () => {
      ouvintes.delete(setOpcoes);
    };
  }, []);
  return opcoes;
}
