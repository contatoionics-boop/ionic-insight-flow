import { Plus, Trash2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Switch } from "@/components/ui/switch";
import { parsearItemProposta } from "@/lib/laudo/produtos-proposta";
import {
  LIMITES,
  SOLUCOES_ESCOPO,
  pad2,
  resumoRfid,
  rotuloEntidade,
  resumoArvore,
  totalRfid,
  type ArvoreEscopo,
  type ConfigEscopo,
  type IlhaArvore,
  type ItemEquipamento,
  type ItemEscopo,
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
  itensDaProposta,
}: {
  value: ArvoreEscopo;
  onChange: (v: ArvoreEscopo) => void;
  disabled?: boolean;
  /** Itens textuais lidos da proposta (para "Importar da proposta"). */
  itensDaProposta?: string[];
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
  const config: ConfigEscopo = value.config ?? {};
  const setConfig = (patch: Partial<ConfigEscopo>) => set({ config: { ...config, ...patch } });
  const equipamentos = config.equipamentos ?? [];

  /** Acrescenta os itens da proposta que ainda não estão na lista (sem duplicar). */
  function importarDaProposta() {
    const jaTem = new Set(equipamentos.map((e) => `${e.codigo ?? ""}|${e.descricao.toLowerCase()}`));
    const novos: ItemEquipamento[] = [];
    for (const bruto of itensDaProposta ?? []) {
      const p = parsearItemProposta(bruto);
      if (!p) continue;
      const chave = `${p.codigo ?? ""}|${p.descricao.toLowerCase()}`;
      if (jaTem.has(chave)) continue;
      jaTem.add(chave);
      novos.push({ codigo: p.codigo ?? undefined, descricao: p.descricao, quantidade: Number(p.quantidade) || 1 });
    }
    if (novos.length) setConfig({ equipamentos: [...equipamentos, ...novos] });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          {/* Solução contratada */}
          <section className="rounded-md border border-border p-3">
            <label className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="font-medium">Solução</span>
              <select
                value={config.solucao ?? ""}
                disabled={disabled}
                onChange={(e) => setConfig({ solucao: e.target.value || null })}
                className="h-9 w-56 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Não informada</option>
                {SOLUCOES_ESCOPO.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {/* Equipamentos vendidos (proposta) */}
          <section className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-sm font-medium">Equipamentos vendidos (proposta)</span>
                <p className="text-xs text-muted-foreground">
                  Itens contratados. Aparecem para o agente e na tabela "Produtos IONICS" do documento.
                </p>
              </div>
              {(itensDaProposta?.length ?? 0) > 0 && (
                <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={importarDaProposta}>
                  Importar da proposta
                </Button>
              )}
            </div>
            <div className="mt-3 space-y-2">
              {equipamentos.length > 0 && (
                <div className="hidden gap-2 text-xs text-muted-foreground sm:grid sm:grid-cols-[150px_1fr_100px_36px]">
                  <span>Código</span>
                  <span>Descrição do equipamento</span>
                  <span>Qtd.</span>
                  <span />
                </div>
              )}
              {equipamentos.map((it, k) => {
                const atualizar = (patch: Partial<typeof it>) =>
                  setConfig({ equipamentos: equipamentos.map((x, i) => (i === k ? { ...x, ...patch } : x)) });
                return (
                  <div key={k} className="flex flex-wrap items-start gap-2 sm:grid sm:grid-cols-[150px_1fr_100px_36px]">
                    <Input
                      value={it.codigo ?? ""}
                      disabled={disabled}
                      placeholder="Código (opcional)"
                      onChange={(e) => atualizar({ codigo: e.target.value })}
                    />
                    <Input
                      value={it.descricao}
                      disabled={disabled}
                      placeholder="Descrição do equipamento. Ex.: Terminal T1000"
                      onChange={(e) => atualizar({ descricao: e.target.value })}
                    />
                    <div className="w-full sm:w-auto">
                      <span className="mb-0.5 block text-[11px] text-muted-foreground sm:hidden">Quantidade</span>
                      <NumericInput
                      min={1}
                      value={it.quantidade}
                      disabled={disabled}
                      onValueChange={(v) => atualizar({ quantidade: Number(v) || 1 })}
                    />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={disabled}
                      aria-label="Remover equipamento"
                      onClick={() => setConfig({ equipamentos: equipamentos.filter((_, i) => i !== k) })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => setConfig({ equipamentos: [...equipamentos, { descricao: "", quantidade: 1 }] })}
              >
                <Plus className="mr-1 h-4 w-4" /> Adicionar equipamento
              </Button>
            </div>
          </section>

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

          {/* Comboios: cada um com seus tanques e bicos (como a bomba tem bicos) */}
          <section className="rounded-md border border-border p-3">
            <QuantidadeField
              label="Quantidade de comboios"
              value={value.comboios.length}
              max={LIMITES.comboios}
              disabled={disabled}
              onChange={(n) =>
                set({ comboios: redimensionar(value.comboios, n, () => ({ tanques: 0, bicos: 0 }), LIMITES.comboios) })
              }
            />
            {value.comboios.length > 0 && (
              <div className="mt-3 space-y-2">
                {value.comboios.map((c, ci) => (
                  <div key={ci} className="rounded border border-border px-3 py-2">
                    <p className="mb-2 text-sm font-medium">Comboio {pad2(ci + 1)}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <QuantidadeField
                        label="Tanques"
                        value={c.tanques}
                        max={LIMITES.comboioTanques}
                        disabled={disabled}
                        onChange={(n) =>
                          set({ comboios: value.comboios.map((x, k) => (k === ci ? { ...x, tanques: n } : x)) })
                        }
                      />
                      <QuantidadeField
                        label="Bicos"
                        value={c.bicos}
                        max={LIMITES.comboioBicos}
                        disabled={disabled}
                        onChange={(n) =>
                          set({ comboios: value.comboios.map((x, k) => (k === ci ? { ...x, bicos: n } : x)) })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Tanques com lubrificante e Sondas: opcionais e independentes da pista */}
          <ColecaoNomeada
            titulo="tanque_lubrificante"
            tituloPlural="Tanques com lubrificante"
            itens={value.tanquesLubrificante}
            max={LIMITES.tanques}
            disabled={disabled}
            onChange={(tanquesLubrificante) => set({ tanquesLubrificante })}
          />
          <ColecaoNomeada
            titulo="sonda"
            tituloPlural="Sondas"
            itens={value.sondas}
            max={LIMITES.sondas}
            disabled={disabled}
            onChange={(sondas) => set({ sondas })}
          />

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
                  <div className="hidden gap-2 text-xs text-muted-foreground sm:grid sm:grid-cols-[1fr_140px_1fr_36px]">
                    <span>Modelo do veículo</span>
                    <span>Qtd.</span>
                    <span>Informação adicional</span>
                    <span />
                  </div>
                )}
                {value.frota.itens.map((it, k) => (
                  <div key={k} className="flex flex-wrap items-start gap-2 sm:grid sm:grid-cols-[1fr_140px_1fr_36px]">
                    <Input
                      value={it.modelo}
                      disabled={disabled}
                      placeholder="Ex.: Scania R450"
                      onChange={(e) => atualizarFrota(k, { modelo: e.target.value })}
                    />
                    <div className="w-full sm:w-auto">
                      <span className="mb-0.5 block text-[11px] text-muted-foreground sm:hidden">Quantidade</span>
                      <NumericInput
                      min={1}
                      value={it.quantidade}
                      disabled={disabled}
                      onValueChange={(v) => atualizarFrota(k, { quantidade: Number(v) || 1 })}
                    />
                    </div>
                    <Input
                      value={it.info ?? ""}
                      placeholder="Informação adicional"
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

          {/* Cartão RFID: só a quantidade */}
          <section className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Possui cartão RFID</span>
              <Switch
                checked={!!config.rfid?.ativo}
                disabled={disabled}
                onCheckedChange={(ativo) =>
                  setConfig({
                    rfid: {
                      ativo,
                      itens: ativo ? [{ tecnologia: "", quantidade: totalRfid(config.rfid?.itens) || 1 }] : [],
                    },
                  })
                }
              />
            </div>
            {config.rfid?.ativo && (
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Quantidade de cartões</span>
                <div className="w-32">
                  <NumericInput
                    min={1}
                    value={totalRfid(config.rfid.itens) || 1}
                    disabled={disabled}
                    onValueChange={(v) =>
                      setConfig({ rfid: { ativo: true, itens: [{ tecnologia: "", quantidade: Number(v) || 1 }] } })
                    }
                  />
                </div>
              </div>
            )}
          </section>

          {/* TX */}
          <section className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Possui TX</span>
              <Switch
                checked={!!config.tx?.ativo}
                disabled={disabled}
                onCheckedChange={(ativo) =>
                  setConfig({ tx: { ativo, itens: config.tx?.itens ?? [] } })
                }
              />
            </div>
            {config.tx?.ativo && (
              <div className="mt-3 space-y-2">
                {config.tx.itens.length > 0 && (
                  <div className="hidden gap-2 text-xs text-muted-foreground sm:grid sm:grid-cols-[1fr_140px_1fr_36px]">
                    <span>Modelo do TX</span>
                    <span>Qtd.</span>
                    <span>Informação adicional</span>
                    <span />
                  </div>
                )}
                {config.tx.itens.map((it, k) => {
                  const atualizar = (patch: Partial<typeof it>) =>
                    setConfig({
                      tx: {
                        ativo: true,
                        itens: config.tx!.itens.map((x, i) => (i === k ? { ...x, ...patch } : x)),
                      },
                    });
                  return (
                    <div key={k} className="flex flex-wrap items-start gap-2 sm:grid sm:grid-cols-[1fr_140px_1fr_36px]">
                      <Input
                        value={it.modelo}
                        disabled={disabled}
                        placeholder="Modelo do TX"
                        onChange={(e) => atualizar({ modelo: e.target.value })}
                      />
                      <div className="w-full sm:w-auto">
                        <span className="mb-0.5 block text-[11px] text-muted-foreground sm:hidden">Quantidade</span>
                        <NumericInput
                        min={1}
                        value={it.quantidade}
                        disabled={disabled}
                        onValueChange={(v) => atualizar({ quantidade: Number(v) || 1 })}
                      />
                      </div>
                      <Input
                        value={it.info ?? ""}
                        placeholder="Informação adicional"
                        disabled={disabled}
                        onChange={(e) => atualizar({ info: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={disabled}
                        aria-label="Remover linha"
                        onClick={() =>
                          setConfig({ tx: { ativo: true, itens: config.tx!.itens.filter((_, i) => i !== k) } })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() =>
                    setConfig({ tx: { ativo: true, itens: [...config.tx!.itens, { modelo: "", quantidade: 1 }] } })
                  }
                >
                  <Plus className="mr-1 h-4 w-4" /> Adicionar modelo
                </Button>
              </div>
            )}
          </section>

          {/* Outros dispositivos: para o que surgir depois, sem precisar programar */}
          <section className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-sm font-medium">Outros dispositivos</span>
                <p className="text-xs text-muted-foreground">
                  Adicione qualquer item do escopo que não tenha um campo próprio.
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {(config.outros ?? []).length > 0 && (
                <div className="hidden gap-2 text-xs text-muted-foreground sm:grid sm:grid-cols-[1fr_1fr_100px_1fr_36px]">
                  <span>Dispositivo</span>
                  <span>Modelo</span>
                  <span>Qtd.</span>
                  <span>Informação adicional</span>
                  <span />
                </div>
              )}
              {(config.outros ?? []).map((it, k) => {
                const lista = config.outros ?? [];
                const atualizar = (patch: Partial<typeof it>) =>
                  setConfig({ outros: lista.map((x, i) => (i === k ? { ...x, ...patch } : x)) });
                return (
                  <div key={k} className="flex flex-wrap items-start gap-2 sm:grid sm:grid-cols-[1fr_1fr_100px_1fr_36px]">
                    <Input
                      value={it.nome}
                      disabled={disabled}
                      placeholder="Ex.: Leitor de placa"
                      onChange={(e) => atualizar({ nome: e.target.value })}
                    />
                    <Input
                      value={it.modelo ?? ""}
                      disabled={disabled}
                      onChange={(e) => atualizar({ modelo: e.target.value })}
                    />
                    <div className="w-full sm:w-auto">
                      <span className="mb-0.5 block text-[11px] text-muted-foreground sm:hidden">Quantidade</span>
                      <NumericInput
                      min={1}
                      value={it.quantidade}
                      disabled={disabled}
                      onValueChange={(v) => atualizar({ quantidade: Number(v) || 1 })}
                    />
                    </div>
                    <Input
                      value={it.info ?? ""}
                      placeholder="Informação adicional"
                      disabled={disabled}
                      onChange={(e) => atualizar({ info: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={disabled}
                      aria-label="Remover dispositivo"
                      onClick={() => setConfig({ outros: lista.filter((_, i) => i !== k) })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() =>
                  setConfig({ outros: [...(config.outros ?? []), { nome: "", quantidade: 1 }] })
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Adicionar dispositivo
              </Button>
            </div>
          </section>
        </div>

        {/* Resumo vivo */}
        <aside className="rounded-md border border-border bg-muted/30 p-3 text-xs">
          <p className="mb-2 font-medium text-foreground">Resumo da estrutura</p>
          {config.solucao && (
            <p className="mb-1 text-foreground">
              Solução: {SOLUCOES_ESCOPO.find((s) => s.value === config.solucao)?.label ?? config.solucao}
            </p>
          )}
          <p className="mb-2 text-muted-foreground">
            {resumo.postos} posto(s) · {resumo.ilhas} ilha(s) · {resumo.bombas} bomba(s) · {resumo.bicos} bico(s)
            · {resumo.tanques} tanque(s) c/ lubrificante · {resumo.sondas} sonda(s) · {resumo.comboios} comboio(s)
            {resumo.comboios > 0 ? ` (${resumo.tanquesComboio} tanque(s), ${resumo.bicosComboio} bico(s))` : ""}
            {resumo.frota ? " · frota/DIV" : ""}
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
            {value.tanquesLubrificante.length > 0 && (
              <li>
                Tanques com lubrificante
                <ul className="ml-3 border-l border-border pl-2">
                  {value.tanquesLubrificante.map((t, i) => (
                    <li key={i}>{rotuloEntidade("tanque_lubrificante", i + 1, t.nome)}</li>
                  ))}
                </ul>
              </li>
            )}
            {value.sondas.length > 0 && (
              <li>
                Sondas
                <ul className="ml-3 border-l border-border pl-2">
                  {value.sondas.map((t, i) => (
                    <li key={i}>{rotuloEntidade("sonda", i + 1, t.nome)}</li>
                  ))}
                </ul>
              </li>
            )}
            {value.comboios.length > 0 && (
              <li>
                Comboios
                <ul className="ml-3 border-l border-border pl-2">
                  {value.comboios.map((c, i) => (
                    <li key={i}>
                      Comboio {pad2(i + 1)} — {c.tanques} tanque(s), {c.bicos} bico(s)
                    </li>
                  ))}
                </ul>
              </li>
            )}
            {value.frota.ativo && <li>Frota / DIV — {value.frota.itens.length} modelo(s)</li>}
            {equipamentos.length > 0 && <li>Equipamentos vendidos — {equipamentos.length} item(ns)</li>}
            {config.rfid?.ativo && (
              <li>
                RFID —{" "}
                {resumoRfid(config.rfid.itens) || "sem itens"}
              </li>
            )}
            {config.tx?.ativo && (
              <li>
                TX —{" "}
                {config.tx.itens.map((i) => `${i.quantidade}× ${i.modelo || "?"}`).join(", ") || "sem itens"}
              </li>
            )}
            {(config.outros ?? []).length > 0 && (
              <li>Outros — {(config.outros ?? []).map((i) => `${i.quantidade}× ${i.nome || "?"}`).join(", ")}</li>
            )}
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

/**
 * Coleção independente (tanques, sondas): quantidade + identificação opcional de
 * cada item. Reduzir a quantidade remove do último para o primeiro, o que preserva
 * a identidade (e as respostas) dos itens que continuam.
 */
function ColecaoNomeada({
  titulo,
  tituloPlural,
  itens,
  max,
  onChange,
  disabled,
}: {
  titulo: "tanque_lubrificante" | "sonda";
  tituloPlural: string;
  itens: ItemEscopo[];
  max: number;
  onChange: (itens: ItemEscopo[]) => void;
  disabled?: boolean;
}) {
  const redimensionar = (n: number) => {
    const alvo = Math.max(0, Math.min(max, n));
    onChange(alvo <= itens.length ? itens.slice(0, alvo) : [...itens, ...Array.from({ length: alvo - itens.length }, () => ({}))]);
  };
  return (
    <section className="rounded-md border border-border p-3">
      <QuantidadeField
        label={`Quantidade de ${tituloPlural.toLowerCase()}`}
        value={itens.length}
        max={max}
        disabled={disabled}
        onChange={redimensionar}
      />
      {itens.length > 0 && (
        <div className="mt-3 space-y-2">
          {itens.map((it, i) => (
            <div key={i} className="grid grid-cols-[110px_1fr] items-center gap-2">
              <span className="text-sm">{rotuloEntidade(titulo, i + 1)}</span>
              <Input
                value={it.nome ?? ""}
                disabled={disabled}
                placeholder="Identificação (opcional). Ex.: Diesel S10"
                onChange={(e) => onChange(itens.map((x, k) => (k === i ? { nome: e.target.value } : x)))}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
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
      <NumericInput
        inputMode="numeric"
        min={0}
        max={max}
        value={value}
        disabled={disabled}
        className="w-36"
        onValueChange={(v) => onChange(Math.max(0, Math.min(max, Math.floor(Number(v) || 0))))}
      />
    </label>
  );
}
