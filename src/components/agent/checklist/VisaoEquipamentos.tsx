import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import type { Resposta } from "@/components/agent/FormFields";
import { ListaEquipamentos } from "@/components/agent/checklist/ListaEquipamentos";
import {
  PreencherEquipamento,
  type IndicePerguntas,
  type SecaoEquip,
} from "@/components/agent/checklist/PreencherEquipamento";
import { ResumoMapeamento, type DestinoResumo } from "@/components/agent/checklist/ResumoMapeamento";
import { contarEstados, type ModeloNav, type Unidade } from "@/lib/escopo/navegacao-entidades";
import type { ChecklistPerguntaDTO } from "@/lib/vistoria-agent.functions";

/** Onde o agente está: resumo → lista de equipamentos → preenchimento de um equipamento. */
export type Vista =
  | { tipo: "resumo" }
  | { tipo: "lista"; chave: string }
  | { tipo: "equip"; id: string; origem: Vista }
  | { tipo: "geral" };

const DE: Record<string, string> = {
  bomba: "da bomba",
  comboio: "do comboio",
  tanque_lubrificante: "do tanque",
  sonda: "da sonda",
  frota: "da frota / DIV",
  posto: "do posto",
  ilha: "da ilha",
  tanque: "do tanque",
  bico: "do bico",
};

/** Tipos de equipamento no feminino (concordância das mensagens). */
const FEMININO = new Set(["bomba", "ilha", "sonda"]);

const NOMES_GRUPO: Record<string, { titulo: string; um: string; varios: string; concl: [string, string] }> = {
  comboios: { titulo: "Comboios", um: "comboio", varios: "comboios", concl: ["concluído", "concluídos"] },
  tanques: { titulo: "Tanques com lubrificante", um: "tanque", varios: "tanques", concl: ["concluído", "concluídos"] },
  sondas: { titulo: "Sondas", um: "sonda", varios: "sondas", concl: ["concluída", "concluídas"] },
  outros: { titulo: "Outros", um: "item", varios: "itens", concl: ["concluído", "concluídos"] },
};

type Props = {
  modelo: ModeloNav;
  vista: Vista;
  onVista: (v: Vista) => void;
  indice: IndicePerguntas;
  state: Record<string, Resposta>;
  update: (perguntaId: string, patch: Partial<Resposta>) => void;
  casoId: string;
  token: string;
  destaque?: string | null;
  fala?: (perguntas: ChecklistPerguntaDTO[]) => ReactNode;
  salvando: boolean;
  salvoEm: Date | null;
  /** Grava o que está pendente (mesmo caminho do autosave). Retorna false se falhou. */
  persistir: () => Promise<boolean>;
  /** Tentou sair/concluir com obrigatória faltando: o equipamento passa a "Com pendências". */
  onTentou: (entidadeId: string) => void;
  /** Marca/desmarca como concluído (confirmação operacional). */
  onMarcar: (entidadeId: string, concluida: boolean) => Promise<void>;
  onIrParaPergunta: (perguntaId: string) => void;
};

const topo = () => window.scrollTo({ top: 0, behavior: "smooth" });

function resumoGrupo(unidades: Unidade[], um: string, varios: string, concl: [string, string]) {
  const c = contarEstados(unidades);
  return `${c.concluidas} de ${c.total} ${c.total === 1 ? um : varios} ${c.total === 1 ? concl[0] : concl[1]}`;
}

export function VisaoEquipamentos({
  modelo,
  vista,
  onVista,
  indice,
  state,
  update,
  casoId,
  token,
  destaque,
  fala,
  salvando,
  salvoEm,
  persistir,
  onTentou,
  onMarcar,
  onIrParaPergunta,
}: Props) {
  const [aviso, setAviso] = useState<string | null>(null);

  // O aviso vale só para a tela em que foi dado.
  useEffect(() => {
    setAviso(null);
  }, [vista]);

  const ir = (v: Vista) => {
    onVista(v);
    topo();
  };

  const abrirDoResumo = (d: DestinoResumo) => {
    if (d.tipo === "geral") return ir({ tipo: "geral" });
    if (d.tipo === "equip") return ir({ tipo: "equip", id: d.id, origem: { tipo: "resumo" } });
    // Só um equipamento no grupo: vai direto, sem a lista de um item só.
    const chave = d.tipo === "ilha" ? `ilha:${d.ilhaId}` : d.grupo;
    const lista = listaDa(chave);
    if (lista && lista.unidades.length === 1) {
      return ir({ tipo: "equip", id: lista.unidades[0]!.id, origem: { tipo: "resumo" } });
    }
    return ir({ tipo: "lista", chave });
  };

  const listaDa = (chave: string): { titulo: string; caminho?: string; unidades: Unidade[]; resumo: string } | null => {
    if (chave.startsWith("ilha:")) {
      const ilhaId = chave.slice(5);
      for (const no of modelo.pista) {
        const il = no.ilhas.find((x) => x.ilha.id === ilhaId);
        if (!il) continue;
        const unidades = [...(il.dados ? [il.dados] : []), ...il.equipamentos];
        const tipo = il.equipamentos[0]?.entidade.tipo ?? "bomba";
        return {
          titulo: il.ilha.rotulo,
          caminho: no.posto.rotulo,
          unidades,
          resumo: resumoGrupo(il.equipamentos, tipo === "bomba" ? "bomba" : "equipamento", tipo === "bomba" ? "bombas" : "equipamentos", [
            tipo === "bomba" ? "concluída" : "concluído",
            tipo === "bomba" ? "concluídas" : "concluídos",
          ]),
        };
      }
      return null;
    }
    const g = NOMES_GRUPO[chave];
    const unidades = chave === "comboios" ? modelo.comboios : chave === "tanques" ? modelo.tanques : chave === "sondas" ? modelo.sondas : modelo.outros;
    if (!g) return null;
    return { titulo: g.titulo, unidades, resumo: resumoGrupo(unidades, g.um, g.varios, g.concl) };
  };

  const invalida =
    (vista.tipo === "lista" && !listaDa(vista.chave)) ||
    (vista.tipo === "geral" && !modelo.geral) ||
    (vista.tipo === "equip" && !modelo.porId.get(vista.id));
  useEffect(() => {
    if (invalida) onVista({ tipo: "resumo" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalida]);

  // --- Nível 1 ---
  if (vista.tipo === "resumo" || invalida) {
    return <ResumoMapeamento modelo={modelo} onAbrir={abrirDoResumo} />;
  }

  // --- Nível 2 ---
  if (vista.tipo === "lista") {
    const lista = listaDa(vista.chave)!;
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => ir({ tipo: "resumo" })}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Resumo do mapeamento
        </button>
        <ListaEquipamentos
          titulo={lista.titulo}
          caminho={lista.caminho}
          unidades={lista.unidades}
          resumoDe={lista.resumo}
          onAbrir={(id) => ir({ tipo: "equip", id, origem: vista })}
        />
      </div>
    );
  }

  // --- Nível 3: informações gerais ---
  if (vista.tipo === "geral") {
    const g = modelo.geral!;
    const secoes: SecaoEquip[] = [{ chave: "geral", titulo: null, itens: g.itens }];
    return (
      <PreencherEquipamento
        caminho={[]}
        titulo="Informações gerais"
        estado={g.estado}
        respondidas={g.respondidas}
        total={g.total}
        obrigatoriasFaltando={g.itens.filter((i) => i.obrigatoria && !i.completa)}
        secoes={secoes}
        indice={indice}
        state={state}
        update={update}
        casoId={casoId}
        token={token}
        destaque={destaque}
        fala={fala}
        salvando={salvando}
        salvoEm={salvoEm}
        aviso={aviso}
        marcada={false}
        podeMarcar={false}
        rotuloProxima="Salvar e voltar ao resumo"
        onSalvar={async () => {
          const ok = await persistir();
          setAviso(ok ? "Salvo." : "Não foi possível salvar agora. Tentaremos de novo automaticamente.");
        }}
        onSalvarEContinuar={async () => {
          await persistir();
          ir({ tipo: "resumo" });
        }}
        onVoltar={() => ir({ tipo: "resumo" })}
        onIrParaPergunta={onIrParaPergunta}
      />
    );
  }

  // --- Nível 3: equipamento ---
  const u = modelo.porId.get(vista.id)!;
  const faltando = u.itens.filter((i) => i.obrigatoria && !i.completa);
  const secoes: SecaoEquip[] = [];
  if (u.proprias.length) {
    secoes.push({
      chave: "proprias",
      titulo: u.subs.length > 0 ? `Dados ${DE[u.entidade.tipo] ?? ""}`.trim() : null,
      tipo: u.subs.length > 0 ? u.entidade.tipo : undefined,
      itens: u.proprias,
    });
  }
  for (const s of u.subs) {
    secoes.push({ chave: s.entidade.id, titulo: s.entidade.rotulo, tipo: s.entidade.tipo, itens: s.itens });
  }

  const proxima = u.soProprias ? null : modelo.proxima(u.id);
  // Próximo equipamento em outra ilha: o rótulo diz a ilha ("Bomba 01 · Ilha 02") e a lista de
  // retorno passa a ser a da nova ilha.
  const ilhaDaProxima = proxima ? proxima.ancestrais[proxima.ancestrais.length - 1] : undefined;
  const mudaDeIlha = !!proxima && !!ilhaDaProxima && ilhaDaProxima.tipo === "ilha" && proxima.entidade.parent_id !== u.entidade.parent_id;
  const destinoSaida: Vista =
    mudaDeIlha && vista.origem.tipo === "lista" && vista.origem.chave.startsWith("ilha:")
      ? { tipo: "lista", chave: `ilha:${ilhaDaProxima!.id}` }
      : vista.origem;
  const rotuloProxima = proxima
    ? `Salvar e ir para ${proxima.titulo}${mudaDeIlha ? ` · ${ilhaDaProxima!.rotulo}` : ""}`
    : destinoSaida.tipo === "lista"
      ? "Salvar e voltar à lista"
      : "Salvar e voltar ao resumo";

  const sair = () => ir(destinoSaida);

  return (
    <PreencherEquipamento
      caminho={u.ancestrais.map((a) => a.rotulo)}
      titulo={u.tituloCompleto}
      tipo={u.entidade.tipo}
      estado={u.estado}
      respondidas={u.respondidas}
      total={u.total}
      obrigatoriasFaltando={faltando}
      secoes={secoes}
      indice={indice}
      state={state}
      update={update}
      casoId={casoId}
      token={token}
      destaque={destaque}
      fala={fala}
      salvando={salvando}
      salvoEm={salvoEm}
      aviso={aviso}
      marcada={u.marcada}
      podeMarcar={u.marcada || faltando.length === 0}
      rotuloProxima={rotuloProxima}
      onSalvar={async () => {
        const ok = await persistir();
        setAviso(ok ? "Salvo." : "Não foi possível salvar agora. Tentaremos de novo automaticamente.");
      }}
      onSalvarEContinuar={async () => {
        const ok = await persistir();
        if (!ok) {
          setAviso("Não foi possível salvar agora. Tentaremos de novo automaticamente.");
          return;
        }
        if (faltando.length > 0) onTentou(u.entidade.id);
        if (proxima) ir({ tipo: "equip", id: proxima.id, origem: destinoSaida });
        else sair();
      }}
      onMarcar={async () => {
        if (u.marcada) {
          await onMarcar(u.entidade.id, false);
          return;
        }
        if (faltando.length > 0) {
          onTentou(u.entidade.id);
          setAviso(`Faltam ${faltando.length} campo(s) obrigatório(s) em ${u.titulo}.`);
          onIrParaPergunta(faltando[0]!.id);
          return;
        }
        const ok = await persistir();
        if (!ok) {
          setAviso("Não foi possível salvar agora. Tentaremos de novo automaticamente.");
          return;
        }
        await onMarcar(u.entidade.id, true);
        setAviso(`${u.titulo} marcad${FEMININO.has(u.entidade.tipo) ? "a" : "o"} como concluíd${FEMININO.has(u.entidade.tipo) ? "a" : "o"}.`);
      }}
      onVoltar={async () => {
        await persistir();
        sair();
      }}
      onIrParaPergunta={onIrParaPergunta}
    />
  );
}

/** Para a revisão: em qual equipamento (id da vista) está a pergunta. */
export function unidadeDaPergunta(modelo: ModeloNav, perguntaId: string): Unidade | null {
  for (const u of modelo.porId.values()) {
    if (u.itens.some((i) => i.id === perguntaId)) return u;
  }
  return null;
}

/** Perguntas gerais (sem equipamento) pertencem à tela "Informações gerais". */
export function ehGeral(modelo: ModeloNav, perguntaId: string): boolean {
  return !!modelo.geral?.itens.some((i) => i.id === perguntaId);
}

export function useIndicePerguntas(
  etapas: { etapa: import("@/lib/vistoria-agent.functions").ChecklistEtapaDTO; visiveis: ChecklistPerguntaDTO[] }[],
): IndicePerguntas {
  return useMemo(() => {
    const m: IndicePerguntas = new Map();
    for (const e of etapas) for (const p of e.visiveis) m.set(p.id, { pergunta: p, etapa: e.etapa });
    return m;
  }, [etapas]);
}
