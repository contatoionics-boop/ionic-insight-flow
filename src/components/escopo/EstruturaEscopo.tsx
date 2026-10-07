import { Plus, Trash2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  LIMITES,
  pad2,
  resumoArvore,
  type ArvoreEscopo,
  type IlhaArvore,
  type PostoArvore,
} from "@/lib/escopo/tipos";

/**
 * Editor da estrutura física do Escopo (Posto › Ilha › Bomba › Bico, comboios e
 * frota/DIV). Componente controlado: só edita uma `ArvoreEscopo`; não acessa o
 * banco. Um wizard futuro pode substituí-lo produzindo o mesmo objeto.
 */
export function EstruturaEscopo({
  value,
  onChange,
  disabled,
}: {
  value: ArvoreEscopo;
  onChange: (v: ArvoreEscopo) => void;
  disabled?: boolean;
}) {
  const set = (patch: Partial<ArvoreEscopo>) => onChange({ ...value, ...patch });

  const redimensionar = <T,>(lista: T[], n: number, novo: () => T, max: number): T[] => {
    const alvo = Math.max(0, Math.min(max, n));
    if (alvo <= lista.length) return lista.slice(0, alvo);
    return [...lista, ...Array.from({ length: alvo - lista.length }, novo)];
  };

  const setPosto = (pi: number, posto: PostoArvore) =>
    set({ postos: value.postos.map((p, i) => (i === pi ? posto : p)) });

  const resumo = resumoArvore(value);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          {/* Pista */}
          <section className="rounded-md border border-border p-3">
            <QuantidadeField
              label="Quantidade de postos"
              value={value.postos.length}
              max={LIMITES.postos}
              disabled={disabled}
              onChange={(n) =>
                set({ postos: redimensionar(value.postos, n, () => ({ ilhas: [] }), LIMITES.postos) })
              }
            />
            {value.postos.length > 0 && (
              <Accordion type="multiple" className="mt-2">
                {value.postos.map((posto, pi) => {
                  const r = resumoArvore({ ...value, postos: [posto] });
                  return (
                    <AccordionItem key={pi} value={`posto-${pi}`}>
                      <AccordionTrigger className="text-sm">
                        <span>
                          Posto {pad2(pi + 1)}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {r.ilhas} ilha(s) · {r.bombas} bomba(s) · {r.bicos} bico(s)
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pl-2">
                        <QuantidadeField
                          label="Quantidade de ilhas"
                          value={posto.ilhas.length}
                          max={LIMITES.ilhas}
                          disabled={disabled}
                          onChange={(n) =>
                            setPosto(pi, {
                              ilhas: redimensionar(posto.ilhas, n, () => ({ bombas: [] }), LIMITES.ilhas),
                            })
                          }
                        />
                        {posto.ilhas.length > 0 && (
                          <Accordion type="multiple">
                            {posto.ilhas.map((ilha, ii) => (
                              <AccordionItem key={ii} value={`ilha-${pi}-${ii}`}>
                                <AccordionTrigger className="text-sm">
                                  <span>
                                    Ilha {pad2(ii + 1)}
                                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                                      {ilha.bombas.length} bomba(s)
                                    </span>
                                  </span>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-2 pl-2">
                                  <IlhaEditor
                                    ilha={ilha}
                                    disabled={disabled}
                                    onChange={(nova) =>
                                      setPosto(pi, {
                                        ilhas: posto.ilhas.map((x, k) => (k === ii ? nova : x)),
                                      })
                                    }
                                    redimensionar={redimensionar}
                                  />
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </section>

          {/* Comboios */}
          <section className="rounded-md border border-border p-3">
            <QuantidadeField
              label="Quantidade de comboios"
              value={value.comboios}
              max={LIMITES.comboios}
              disabled={disabled}
              onChange={(n) => set({ comboios: n })}
            />
          </section>

          {/* Frota / DIV */}
          <section className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Possui frota / DIV</span>
              <Switch
                checked={value.frota.ativo}
                disabled={disabled}
                onCheckedChange={(ativo) => set({ frota: { ...value.frota, ativo } })}
              />
            </div>
            {value.frota.ativo && (
              <div className="mt-3 space-y-2">
                {value.frota.itens.length > 0 && (
                  <div className="grid grid-cols-[1fr_90px_1fr_36px] gap-2 text-xs text-muted-foreground">
                    <span>Modelo do veículo</span>
                    <span>Qtd.</span>
                    <span>Informação adicional</span>
                    <span />
                  </div>
                )}
                {value.frota.itens.map((it, k) => (
                  <div key={k} className="grid grid-cols-[1fr_90px_1fr_36px] gap-2">
                    <Input
                      value={it.modelo}
                      disabled={disabled}
                      placeholder="Ex.: Scania R450"
                      onChange={(e) => atualizarFrota(k, { modelo: e.target.value })}
                    />
                    <Input
                      type="number"
                      min={1}
                      value={it.quantidade}
                      disabled={disabled}
                      onChange={(e) => atualizarFrota(k, { quantidade: Number(e.target.value) || 1 })}
                    />
                    <Input
                      value={it.info ?? ""}
                      disabled={disabled}
                      onChange={(e) => atualizarFrota(k, { info: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={disabled}
                      aria-label="Remover linha"
                      onClick={() =>
                        set({ frota: { ...value.frota, itens: value.frota.itens.filter((_, i) => i !== k) } })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() =>
                    set({
                      frota: { ...value.frota, itens: [...value.frota.itens, { modelo: "", quantidade: 1 }] },
                    })
                  }
                >
                  <Plus className="mr-1 h-4 w-4" /> Adicionar modelo
                </Button>
              </div>
            )}
          </section>
        </div>

        {/* Resumo vivo */}
        <aside className="rounded-md border border-border bg-muted/30 p-3 text-xs">
          <p className="mb-2 font-medium text-foreground">Resumo da estrutura</p>
          <p className="mb-2 text-muted-foreground">
            {resumo.postos} posto(s) · {resumo.ilhas} ilha(s) · {resumo.bombas} bomba(s) · {resumo.bicos} bico(s)
            · {resumo.comboios} comboio(s){resumo.frota ? " · frota/DIV" : ""}
          </p>
          <ul className="space-y-0.5 font-mono">
            {value.postos.map((p, pi) => (
              <li key={pi}>
                Posto {pad2(pi + 1)}
                <ul className="ml-3 border-l border-border pl-2">
                  {p.ilhas.map((il, ii) => (
                    <li key={ii}>
                      Ilha {pad2(ii + 1)}
                      <ul className="ml-3 border-l border-border pl-2">
                        {il.bombas.map((b, bi) => (
                          <li key={bi}>
                            Bomba {pad2(bi + 1)} — {b.bicos} bico(s)
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {value.comboios > 0 && (
              <li>
                Comboios
                <ul className="ml-3 border-l border-border pl-2">
                  {Array.from({ length: value.comboios }, (_, i) => (
                    <li key={i}>Comboio {pad2(i + 1)}</li>
                  ))}
                </ul>
              </li>
            )}
            {value.frota.ativo && <li>Frota / DIV — {value.frota.itens.length} modelo(s)</li>}
          </ul>
        </aside>
      </div>
    </div>
  );

  function atualizarFrota(k: number, patch: Partial<{ modelo: string; quantidade: number; info: string }>) {
    set({
      frota: {
        ...value.frota,
        itens: value.frota.itens.map((it, i) => (i === k ? { ...it, ...patch } : it)),
      },
    });
  }
}

function IlhaEditor({
  ilha,
  onChange,
  disabled,
  redimensionar,
}: {
  ilha: IlhaArvore;
  onChange: (i: IlhaArvore) => void;
  disabled?: boolean;
  redimensionar: <T>(lista: T[], n: number, novo: () => T, max: number) => T[];
}) {
  return (
    <>
      <QuantidadeField
        label="Quantidade de bombas"
        value={ilha.bombas.length}
        max={LIMITES.bombas}
        disabled={disabled}
        onChange={(n) =>
          onChange({ bombas: redimensionar(ilha.bombas, n, () => ({ bicos: 1 }), LIMITES.bombas) })
        }
      />
      {ilha.bombas.map((b, bi) => (
        <div key={bi} className="flex items-center justify-between gap-3 rounded border border-border px-3 py-2">
          <span className="text-sm">Bomba {pad2(bi + 1)}</span>
          <QuantidadeField
            inline
            label="Bicos"
            value={b.bicos}
            max={LIMITES.bicos}
            disabled={disabled}
            onChange={(n) =>
              onChange({ bombas: ilha.bombas.map((x, k) => (k === bi ? { bicos: n } : x)) })
            }
          />
        </div>
      ))}
    </>
  );
}

function QuantidadeField({
  label,
  value,
  max,
  onChange,
  disabled,
  inline,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  inline?: boolean;
}) {
  return (
    <label className={inline ? "flex items-center gap-2 text-sm" : "flex items-center justify-between gap-3 text-sm"}>
      <span className="font-medium">{label}</span>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={value}
        disabled={disabled}
        className="w-24"
        onChange={(e) => onChange(Math.max(0, Math.min(max, Math.floor(Number(e.target.value) || 0))))}
      />
    </label>
  );
}
