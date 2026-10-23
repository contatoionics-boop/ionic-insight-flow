import { useMemo, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui-bits";
import type { Resposta } from "@/components/agent/FormFields";
import { BadgeEstado } from "@/components/agent/checklist/BadgeEstado";
import { PerguntasDoGrupo } from "@/components/agent/checklist/PerguntasDoGrupo";
import { IconeTipo, corDoTipo } from "@/components/escopo/ResumoEscopo";
import { cn } from "@/lib/utils";
import { toPerguntaUI } from "@/lib/vistoria-checklist";
import type { EstadoEquip, ItemNav } from "@/lib/escopo/navegacao-entidades";
import type { ChecklistEtapaDTO, ChecklistPerguntaDTO } from "@/lib/vistoria-agent.functions";

/** Um bloco do equipamento: os dados próprios ou uma sub-entidade (Bico 01...). */
export type SecaoEquip = {
  chave: string;
  /** null = sem cabeçalho (equipamento sem sub-entidades). */
  titulo: string | null;
  /** Tipo da entidade (ícone do cabeçalho). */
  tipo?: string;
  itens: ItemNav[];
};

export type IndicePerguntas = Map<string, { pergunta: ChecklistPerguntaDTO; etapa: ChecklistEtapaDTO }>;

type Props = {
  /** Breadcrumb: "Posto 01 › Ilha 01 › Bomba 02" (sem o último, que vai no título). */
  caminho: string[];
  titulo: string;
  tipo?: string;
  estado: EstadoEquip;
  respondidas: number;
  total: number;
  obrigatoriasFaltando: ItemNav[];
  secoes: SecaoEquip[];
  indice: IndicePerguntas;
  state: Record<string, Resposta>;
  update: (perguntaId: string, patch: Partial<Resposta>) => void;
  casoId: string;
  token: string;
  destaque?: string | null;
  /** Fala para várias perguntas do equipamento (ditar vários campos). */
  fala?: (perguntas: ChecklistPerguntaDTO[]) => ReactNode;
  salvando: boolean;
  salvoEm: Date | null;
  /** Mensagem logo acima das ações (ex.: pendências ao tentar concluir). */
  aviso?: string | null;
  marcada: boolean;
  podeMarcar: boolean;
  /** Rótulo do botão principal: "Salvar e ir para Bomba 03" ou "Salvar e voltar à lista". */
  rotuloProxima: string;
  onSalvar: () => void;
  onSalvarEContinuar: () => void;
  /** Sem esta função o botão "Marcar concluído" não aparece (ex.: informações gerais). */
  onMarcar?: () => void;
  onVoltar: () => void;
  onIrParaPergunta: (perguntaId: string) => void;
};

/** Nível 3: preenchimento de um único equipamento (e seus filhos), com contexto sempre visível. */
export function PreencherEquipamento({
  caminho,
  titulo,
  tipo,
  estado,
  respondidas,
  total,
  obrigatoriasFaltando,
  secoes,
  indice,
  state,
  update,
  casoId,
  token,
  destaque,
  fala,
  salvando,
  salvoEm,
  aviso,
  marcada,
  podeMarcar,
  rotuloProxima,
  onSalvar,
  onSalvarEContinuar,
  onMarcar,
  onVoltar,
  onIrParaPergunta,
}: Props) {
  const pct = total ? Math.round((respondidas / total) * 100) : 0;

  const todasDTO = useMemo(
    () =>
      secoes
        .flatMap((s) => s.itens)
        .map((i) => indice.get(i.id)?.pergunta)
        .filter((p): p is ChecklistPerguntaDTO => !!p),
    [secoes, indice],
  );

  /** Categorias (etapas) dentro de uma seção, na ordem do formulário. */
  const categorias = (itens: ItemNav[]) => {
    const mapa = new Map<string, { etapa: ChecklistEtapaDTO; ordem: number; perguntas: ChecklistPerguntaDTO[] }>();
    for (const i of itens) {
      const r = indice.get(i.id);
      if (!r) continue;
      const g = mapa.get(r.etapa.id) ?? { etapa: r.etapa, ordem: r.etapa.ordem, perguntas: [] };
      g.perguntas.push(r.pergunta);
      mapa.set(r.etapa.id, g);
    }
    return [...mapa.values()].sort((a, b) => a.ordem - b.ordem);
  };

  return (
    <div className="pb-40">
      {/* Contexto sempre visível, logo abaixo do cabeçalho do aplicativo */}
      <div
        className="sticky z-20 -mx-3 border-b border-border bg-background/95 px-3 pb-2 pt-2 backdrop-blur"
        style={{ top: "calc(3.85rem + max(env(safe-area-inset-top), 0.5rem) - 0.5rem)" }}
      >
        {caminho.length > 0 && (
          <p className="truncate text-[11px] text-muted-foreground">{caminho.join(" › ")}</p>
        )}
        <div className="flex items-start gap-2">
          {tipo && (
            <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", corDoTipo(tipo))}>
              <IconeTipo tipo={tipo} className="h-4 w-4" />
            </span>
          )}
          <h2 className="min-w-0 flex-1 text-base font-semibold leading-snug text-foreground">{titulo}</h2>
          <BadgeEstado estado={estado} />
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {respondidas} de {total} campos
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="shrink-0">
            {salvando ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Salvando
              </span>
            ) : salvoEm ? (
              `Salvo às ${salvoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
            ) : (
              "Salvo no aparelho"
            )}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-5">
        {fala && todasDTO.length > 0 && fala(todasDTO)}

        {secoes.map((s) => {
          const cats = categorias(s.itens);
          return (
            <section key={s.chave} className={cn("space-y-3", s.titulo && "rounded-2xl border border-border bg-muted/20 p-3")}>
              {s.titulo && (
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {s.tipo && (
                    <span className={cn("flex h-6 w-6 items-center justify-center rounded-md border", corDoTipo(s.tipo))}>
                      <IconeTipo tipo={s.tipo} className="h-3.5 w-3.5" />
                    </span>
                  )}
                  {s.titulo}
                </h3>
              )}
              {cats.map((c) => (
                <div key={c.etapa.id} className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {c.etapa.titulo}
                  </p>
                  <PerguntasDoGrupo
                    etapa={c.etapa}
                    perguntas={c.perguntas}
                    state={state}
                    update={update}
                    casoId={casoId}
                    token={token}
                    destaque={destaque}
                    siblings={{
                      perguntas: c.perguntas.map((p) => toPerguntaUI(p, c.etapa.id)),
                      state,
                      updateById: update,
                    }}
                  />
                </div>
              ))}
            </section>
          );
        })}

        <section className="space-y-3 rounded-2xl border border-border bg-card p-3">
          {obrigatoriasFaltando.length > 0 ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Faltam {obrigatoriasFaltando.length}{" "}
                {obrigatoriasFaltando.length === 1 ? "campo obrigatório" : "campos obrigatórios"}
              </p>
              <ul className="space-y-0.5">
                {obrigatoriasFaltando.slice(0, 5).map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => onIrParaPergunta(i.id)}
                      className="min-h-9 w-full truncate text-left text-sm text-primary underline"
                    >
                      {i.texto}
                    </button>
                  </li>
                ))}
                {obrigatoriasFaltando.length > 5 && (
                  <li className="text-xs text-muted-foreground">+{obrigatoriasFaltando.length - 5} campo(s)</li>
                )}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {marcada ? "Marcado como concluído." : "Todos os campos obrigatórios foram preenchidos."}
            </p>
          )}
          <div className={cn("grid gap-2", onMarcar ? "grid-cols-2" : "grid-cols-1")}>
            <Button variant="secondary" className="min-h-11" onClick={onSalvar} disabled={salvando}>
              Salvar
            </Button>
            {onMarcar && (
              <Button
                variant="secondary"
                className="min-h-11"
                onClick={onMarcar}
                disabled={salvando}
                title={podeMarcar ? undefined : "Preencha os campos obrigatórios"}
              >
                <Check className="h-4 w-4" /> {marcada ? "Reabrir" : "Marcar concluído"}
              </Button>
            )}
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-3 py-3 backdrop-blur [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]">
        {aviso && (
          <p className="mx-auto mb-2 max-w-6xl rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-800">{aviso}</p>
        )}
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <Button variant="secondary" className="min-h-11 shrink-0" onClick={onVoltar} aria-label="Voltar à lista">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <Button variant="primary" className="min-h-11 flex-1" onClick={onSalvarEContinuar} disabled={salvando}>
            <span className="truncate">{rotuloProxima}</span> <ArrowRight className="h-4 w-4 shrink-0" />
          </Button>
        </div>
      </div>
    </div>
  );
}
