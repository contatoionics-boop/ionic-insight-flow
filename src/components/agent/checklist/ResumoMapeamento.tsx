import type { ReactNode } from "react";
import { ChevronRight, ClipboardList } from "lucide-react";

import { BadgeEstado, estadoDoGrupo } from "@/components/agent/checklist/BadgeEstado";
import { IconeTipo, corDoTipo } from "@/components/escopo/ResumoEscopo";
import { cn } from "@/lib/utils";
import { contarEstados, type ModeloNav, type Unidade } from "@/lib/escopo/navegacao-entidades";

export type DestinoResumo =
  | { tipo: "geral" }
  | { tipo: "equip"; id: string }
  | { tipo: "ilha"; postoId: string; ilhaId: string }
  | { tipo: "grupo"; grupo: "comboios" | "tanques" | "sondas" | "outros" };

function Linha({
  onClick,
  icone,
  titulo,
  detalhe,
  badge,
}: {
  onClick: () => void;
  icone: ReactNode;
  titulo: string;
  detalhe: string;
  badge: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left shadow-sm active:bg-muted"
    >
      {icone}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{titulo}</span>
        <span className="block truncate text-xs text-muted-foreground">{detalhe}</span>
      </span>
      {badge}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

function IconeEntidade({ tipo }: { tipo: string }) {
  return (
    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", corDoTipo(tipo))}>
      <IconeTipo tipo={tipo} className="h-4 w-4" />
    </span>
  );
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/** "4 de 7 bombas concluídas" / "3 de 10 comboios concluídos". */
export function frasesOperacionais(modelo: ModeloNav): string[] {
  const frases: string[] = [];
  const linha = (unidades: Unidade[], um: string, varios: string, concluida: string, concluidas: string) => {
    if (!unidades.length) return;
    const c = contarEstados(unidades);
    frases.push(`${c.concluidas} de ${c.total} ${plural(c.total, um, varios)} ${plural(c.concluidas, concluida, concluidas)}`);
  };
  linha(modelo.sequencia("bomba"), "bomba", "bombas", "concluída", "concluídas");
  linha(modelo.comboios, "comboio", "comboios", "concluído", "concluídos");
  linha(modelo.tanques, "tanque com lubrificante", "tanques com lubrificante", "concluído", "concluídos");
  linha(modelo.sondas, "sonda", "sondas", "concluída", "concluídas");
  return frases;
}

/** Nível 1: visão geral do mapeamento, sem perguntas abertas. */
export function ResumoMapeamento({
  modelo,
  onAbrir,
}: {
  modelo: ModeloNav;
  onAbrir: (destino: DestinoResumo) => void;
}) {
  const frases = frasesOperacionais(modelo);
  const grupo = (
    chave: "comboios" | "tanques" | "sondas" | "outros",
    titulo: string,
    tipo: string,
    unidades: Unidade[],
    umaSo: string,
  ) => {
    if (!unidades.length) return null;
    const c = contarEstados(unidades);
    return (
      <Linha
        key={chave}
        icone={<IconeEntidade tipo={tipo} />}
        titulo={titulo}
        detalhe={`${c.concluidas}/${c.total} ${plural(c.total, umaSo, `${umaSo}s`)}`}
        badge={<BadgeEstado estado={estadoDoGrupo(unidades.map((u) => u.estado))} />}
        onClick={() => onAbrir({ tipo: "grupo", grupo: chave })}
      />
    );
  };

  return (
    <div className="space-y-4">
      {frases.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seu progresso</p>
          <ul className="mt-1.5 space-y-0.5">
            {frases.map((f) => (
              <li key={f} className="text-sm font-medium text-foreground">
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {modelo.geral && (
        <Linha
          icone={
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
              <ClipboardList className="h-4 w-4" aria-hidden />
            </span>
          }
          titulo="Informações gerais"
          detalhe={`${modelo.geral.respondidas} de ${modelo.geral.total} campos`}
          badge={<BadgeEstado estado={modelo.geral.estado} />}
          onClick={() => onAbrir({ tipo: "geral" })}
        />
      )}

      {modelo.pista.map((no) => (
        <section key={no.posto.id} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{no.posto.rotulo}</h3>
          {no.dados && (
            <Linha
              icone={<IconeEntidade tipo="posto" />}
              titulo={no.dados.titulo}
              detalhe={`${no.dados.respondidas} de ${no.dados.total} campos`}
              badge={<BadgeEstado estado={no.dados.estado} />}
              onClick={() => onAbrir({ tipo: "equip", id: no.dados!.id })}
            />
          )}
          {no.ilhas.map((il) => {
            const c = contarEstados(il.equipamentos);
            const estados = [...il.equipamentos.map((u) => u.estado), ...(il.dados ? [il.dados.estado] : [])];
            return (
              <Linha
                key={il.ilha.id}
                icone={<IconeEntidade tipo="ilha" />}
                titulo={il.ilha.rotulo}
                detalhe={
                  il.equipamentos.length
                    ? `${c.concluidas} de ${c.total} ${plural(c.total, "equipamento concluído", "equipamentos concluídos")}`
                    : "Somente dados da ilha"
                }
                badge={<BadgeEstado estado={estadoDoGrupo(estados)} />}
                onClick={() => onAbrir({ tipo: "ilha", postoId: no.posto.id, ilhaId: il.ilha.id })}
              />
            );
          })}
          {no.diretos.map((u) => (
            <Linha
              key={u.id}
              icone={<IconeEntidade tipo={u.entidade.tipo} />}
              titulo={u.tituloCompleto}
              detalhe={`${u.respondidas} de ${u.total} campos`}
              badge={<BadgeEstado estado={u.estado} />}
              onClick={() => onAbrir({ tipo: "equip", id: u.id })}
            />
          ))}
        </section>
      ))}

      {[
        grupo("comboios", "Comboios", "comboio", modelo.comboios, "comboio"),
        grupo("tanques", "Tanques com lubrificante", "tanque_lubrificante", modelo.tanques, "tanque"),
        grupo("sondas", "Sondas", "sonda", modelo.sondas, "sonda"),
        grupo("outros", "Outros", "frota", modelo.outros, "item"),
      ]}

      {modelo.frota.map((u) => (
        <Linha
          key={u.id}
          icone={<IconeEntidade tipo="frota" />}
          titulo="Frota / DIV"
          detalhe={`${u.respondidas} de ${u.total} campos`}
          badge={<BadgeEstado estado={u.estado} />}
          onClick={() => onAbrir({ tipo: "equip", id: u.id })}
        />
      ))}
    </div>
  );
}
