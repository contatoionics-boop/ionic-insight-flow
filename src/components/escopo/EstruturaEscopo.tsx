import { Plus, Trash2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Switch } from "@/components/ui/switch";
import { parsearItemProposta } from "@/lib/laudo/produtos-proposta";
import { useTiposEscopo } from "@/hooks/use-tipos-escopo";
import { useOpcoesAgendamento } from "@/hooks/use-opcoes-agendamento";
import { opcoesDoCampo, rotuloOpcao } from "@/lib/opcoes-agendamento";
import { filhosDoTipo, pluralDoTipo, rotuloDoTipo, tipoVisivel, tiposNovos, tiposRaiz } from "@/lib/escopo/catalogo-tipos";
import {
  CONEXOES_DADOS,
  LIMITES,
  pad2,
  resumoRfid,
  rotuloEntidade,
  resumoArvore,
  totalRfid,
  type ArvoreEscopo,
  type ConexaoDados,
  type ConfigEscopo,
  type IlhaArvore,
  type ItemEquipamento,
  type FilhosArvore,
  type ItemEscopo,
  type PostoArvore,
} from "@/lib/escopo/tipos";
import type { TipoCatalogo } from "@/lib/escopo/catalogo-tipos";

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
  // nomes dos tipos (configuráveis em Configurações › Tipos de item)
  const catalogo = useTiposEscopo();
  const opcoesAg = useOpcoesAgendamento();
  const lab = (chave: string) => rotuloDoTipo(catalogo, chave);
  const plural = (chave: string) => pluralDoTipo(catalogo, chave).toLocaleLowerCase("pt-BR");
  // itens simples dos tipos novos que aparecem no escopo (ativos, ou que já têm itens cadastrados)
  const tiposExtras = tiposNovos(catalogo);
  const tiposDaRaiz = tiposRaiz(catalogo);

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
                {opcoesDoCampo("solucao", { todas: opcoesAg, incluir: [config.solucao] }).map((s) => (
                  <option key={s.valor} value={s.valor}>
                    {s.rotulo}
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
          <SeVisivel mostrar={tipoVisivel(catalogo, "posto", value.postos.length)}>
          <section className="rounded-md border border-border p-3">
            <QuantidadeField
              label={`Quantidade de ${plural("posto")}`}
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
                          {lab("posto")} {pad2(pi + 1)}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {r.ilhas} ilha(s) · {r.bombas} bomba(s) · {r.bicos} bico(s)
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pl-2">
                        <QuantidadeField
                          label={`Quantidade de ${plural("ilha")}`}
                          value={posto.ilhas.length}
                          max={LIMITES.ilhas}
                          disabled={disabled}
                          onChange={(n) =>
                            setPosto(pi, {
                              ...posto,
                              ilhas: redimensionar(posto.ilhas, n, () => ({ bombas: [] }), LIMITES.ilhas),
                            })
                          }
                        />
                        <FilhosEditor
                          tipos={filhosDoTipo(catalogo, "posto")}
                          filhos={posto.filhos}
                          catalogo={catalogo}
                          disabled={disabled}
                          onChange={(filhos) => setPosto(pi, { ...posto, filhos })}
                        />
                        {posto.ilhas.length > 0 && (
                          <Accordion type="multiple">
                            {posto.ilhas.map((ilha, ii) => (
                              <AccordionItem key={ii} value={`ilha-${pi}-${ii}`}>
                                <AccordionTrigger className="text-sm">
                                  <span>
                                    {lab("ilha")} {pad2(ii + 1)}
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
                                        ...posto,
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
          </SeVisivel>

          {/* Comboios: cada um com seus tanques e bicos (como a bomba tem bicos) */}
          <SeVisivel mostrar={tipoVisivel(catalogo, "comboio", value.comboios.length)}>
          <section className="rounded-md border border-border p-3">
            <QuantidadeField
              label={`Quantidade de ${plural("comboio")}`}
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
                    <p className="mb-2 text-sm font-medium">{lab("comboio")} {pad2(ci + 1)}</p>
                    <div className="mb-2 grid grid-cols-[110px_1fr] items-center gap-2">
                      <span className="text-xs text-muted-foreground">Identificação</span>
                      <Input
                        value={c.nome ?? ""}
                        disabled={disabled}
                        placeholder="Opcional. Ex.: Frota 400 (aparece no documento se o agente não informar)"
                        onChange={(e) =>
                          set({ comboios: value.comboios.map((x, k) => (k === ci ? { ...x, nome: e.target.value } : x)) })
                        }
                      />
                    </div>
                    <FilhosEditor
                      tipos={filhosDoTipo(catalogo, "comboio")}
                      filhos={c.filhos}
                      catalogo={catalogo}
                      disabled={disabled}
                      onChange={(filhos) => set({ comboios: value.comboios.map((x, k) => (k === ci ? { ...x, filhos } : x)) })}
                    />
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
          </SeVisivel>

          {/* Tanques com lubrificante e Sondas: opcionais e independentes da pista */}
          <ColecaoNomeada
            titulo="tanque_lubrificante"
            tituloPlural={pluralDoTipo(catalogo, "tanque_lubrificante")}
            catalogo={catalogo}
            oculta={!tipoVisivel(catalogo, "tanque_lubrificante", value.tanquesLubrificante.length)}
            itens={value.tanquesLubrificante}
            max={LIMITES.tanques}
            disabled={disabled}
            onChange={(tanquesLubrificante) => set({ tanquesLubrificante })}
          />
          <ColecaoNomeada
            titulo="sonda"
            tituloPlural={pluralDoTipo(catalogo, "sonda")}
            catalogo={catalogo}
            oculta={!tipoVisivel(catalogo, "sonda", value.sondas.length)}
            itens={value.sondas}
            max={LIMITES.sondas}
            disabled={disabled}
            onChange={(sondas) => set({ sondas })}
          />
          {/* Tipos criados em Configurações › Tipos de item (Prédio, Produto…): itens simples */}
          <FilhosEditor tipos={tiposDaRaiz} filhos={value.extras} catalogo={catalogo} disabled={disabled} onChange={(extras) => set({ extras })} />

          {/* Conexão de dados: posto e comboio podem usar modelos diferentes */}
          <section className="rounded-md border border-border p-3">
            <p className="mb-2 text-sm font-medium">Conexão de dados</p>
            <div className="space-y-2">
              {value.postos.length > 0 && (
                <label className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span>Posto / pista</span>
                  <select
                    value={config.comunicacao_posto ?? config.comunicacao ?? ""}
                    disabled={disabled}
                    onChange={(e) => setConfig({ comunicacao_posto: (e.target.value || null) as ConexaoDados | null })}
                    className="h-9 w-56 rounded-md border border-border bg-background px-3 text-sm"
                    aria-label="Conexão de dados do posto"
                  >
                    <option value="">Não informada</option>
                    {CONEXOES_DADOS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {value.comboios.length > 0 && (
                <label className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span>{lab("comboio")}</span>
                  <select
                    value={config.comunicacao_comboio ?? config.comunicacao ?? ""}
                    disabled={disabled}
                    onChange={(e) => setConfig({ comunicacao_comboio: (e.target.value || null) as ConexaoDados | null })}
                    className="h-9 w-56 rounded-md border border-border bg-background px-3 text-sm"
                    aria-label="Conexão de dados do comboio"
                  >
                    <option value="">Não informada</option>
                    {CONEXOES_DADOS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {value.postos.length === 0 && value.comboios.length === 0 && (
                <p className="text-xs text-muted-foreground">Informe a quantidade de postos ou de comboios para definir a conexão de cada um.</p>
              )}
            </div>
          </section>

          {/* Frota / DIV */}
          <SeVisivel mostrar={tipoVisivel(catalogo, "frota", value.frota.ativo ? 1 : 0)}>
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
          </SeVisivel>

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
                      setConfig({
                        rfid: { ativo: true, itens: [{ tecnologia: config.rfid?.itens?.[0]?.tecnologia ?? "", quantidade: Number(v) || 1 }] },
                      })
                    }
                  />
                </div>
              </div>
            )}
            {config.rfid?.ativo && (
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Tecnologia do cartão (ex.: Mifare, Melexis)</span>
                <div className="w-48">
                  <Input
                    value={config.rfid.itens?.[0]?.tecnologia ?? ""}
                    disabled={disabled}
                    placeholder="Informe a tecnologia"
                    onChange={(e) =>
                      setConfig({
                        rfid: { ativo: true, itens: [{ tecnologia: e.target.value, quantidade: totalRfid(config.rfid?.itens) || 1 }] },
                      })
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
              Solução: {rotuloOpcao("solucao", config.solucao, opcoesAg) ?? config.solucao}
            </p>
          )}
          <p className="mb-2 text-muted-foreground">
            {resumo.postos} posto(s) · {resumo.ilhas} ilha(s) · {resumo.bombas} bomba(s) · {resumo.bicos} bico(s)
            · {resumo.tanques} tanque(s) c/ lubrificante · {resumo.sondas} tanque(s) c/ medidor · {resumo.comboios} comboio(s)
            {resumo.comboios > 0 ? ` (${resumo.tanquesComboio} tanque(s), ${resumo.bicosComboio} bico(s))` : ""}
            {resumo.frota ? " · frota/DIV" : ""}
            {tiposExtras
              .filter((t) => (resumo.extras[t.chave] ?? 0) > 0)
              .map((t) => ` · ${resumo.extras[t.chave]} ${t.plural.toLocaleLowerCase("pt-BR")}`)
              .join("")}
          </p>
          <ul className="space-y-0.5 font-mono">
            {value.postos.map((p, pi) => (
              <li key={pi}>
                {lab("posto")} {pad2(pi + 1)}
                <ResumoFilhos filhos={p.filhos} catalogo={catalogo} />
                <ul className="ml-3 border-l border-border pl-2">
                  {p.ilhas.map((il, ii) => (
                    <li key={ii}>
                      {lab("ilha")} {pad2(ii + 1)}
                      <ResumoFilhos filhos={il.filhos} catalogo={catalogo} />
                      <ul className="ml-3 border-l border-border pl-2">
                        {il.bombas.map((b, bi) => (
                          <li key={bi}>
                            {lab("bomba")} {pad2(bi + 1)} — {b.bicos} bico(s)
                            <ResumoFilhos filhos={b.filhos} catalogo={catalogo} />
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
                {pluralDoTipo(catalogo, "tanque_lubrificante")}
                <ul className="ml-3 border-l border-border pl-2">
                  {value.tanquesLubrificante.map((t, i) => (
                    <li key={i}>
                      {rotuloEntidade("tanque_lubrificante", i + 1, t.nome, catalogo)}
                      <ResumoFilhos filhos={t.filhos} catalogo={catalogo} />
                    </li>
                  ))}
                </ul>
              </li>
            )}
            {value.sondas.length > 0 && (
              <li>
                {pluralDoTipo(catalogo, "sonda")}
                <ul className="ml-3 border-l border-border pl-2">
                  {value.sondas.map((t, i) => (
                    <li key={i}>
                      {rotuloEntidade("sonda", i + 1, t.nome, catalogo)}
                      <ResumoFilhos filhos={t.filhos} catalogo={catalogo} />
                    </li>
                  ))}
                </ul>
              </li>
            )}
            <ResumoFilhos filhos={value.extras} catalogo={catalogo} />
            {value.comboios.length > 0 && (
              <li>
                {pluralDoTipo(catalogo, "comboio")}
                <ul className="ml-3 border-l border-border pl-2">
                  {value.comboios.map((c, i) => (
                    <li key={i}>
                      {lab("comboio")} {pad2(i + 1)}
                      {c.nome?.trim() ? ` (${c.nome.trim()})` : ""} — {c.tanques} tanque(s), {c.bicos} bico(s)
                      <ResumoFilhos filhos={c.filhos} catalogo={catalogo} />
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
  catalogo,
  oculta,
  itens,
  max,
  onChange,
  disabled,
}: {
  /** chave do tipo (tanque_lubrificante, sonda ou um tipo novo) */
  titulo: string;
  tituloPlural: string;
  catalogo?: TipoCatalogo[];
  /** tipo oculto em Configurações › Tipos de item e sem itens: não aparece */
  oculta?: boolean;
  itens: ItemEscopo[];
  max: number;
  onChange: (itens: ItemEscopo[]) => void;
  disabled?: boolean;
}) {
  if (oculta) return null;
  const subtipos = catalogo ? filhosDoTipo(catalogo, titulo) : [];
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
            <div key={i}>
              <div className="grid grid-cols-[110px_1fr] items-center gap-2">
                <span className="text-sm">{rotuloEntidade(titulo, i + 1, undefined, catalogo)}</span>
                <Input
                  value={it.nome ?? ""}
                  disabled={disabled}
                  placeholder={titulo === "tanque_lubrificante" || titulo === "sonda" ? "Identificação (opcional). Ex.: Diesel S10" : "Identificação (opcional). Ex.: A"}
                  onChange={(e) => onChange(itens.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)))}
                />
              </div>
              {subtipos.length > 0 && (
                <div className="ml-3 mt-2 space-y-2 border-l border-border pl-3">
                  <FilhosEditor
                    tipos={subtipos}
                    filhos={it.filhos}
                    catalogo={catalogo!}
                    disabled={disabled}
                    onChange={(filhos) => onChange(itens.map((x, k) => (k === i ? { ...x, filhos } : x)))}
                  />
                </div>
              )}
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
  const catalogo = useTiposEscopo();
  return (
    <>
      <QuantidadeField
        label={`Quantidade de ${pluralDoTipo(catalogo, "bomba").toLocaleLowerCase("pt-BR")}`}
        value={ilha.bombas.length}
        max={LIMITES.bombas}
        disabled={disabled}
        onChange={(n) =>
          onChange({ ...ilha, bombas: redimensionar(ilha.bombas, n, () => ({ bicos: 1 }), LIMITES.bombas) })
        }
      />
      <FilhosEditor
        tipos={filhosDoTipo(catalogo, "ilha")}
        filhos={ilha.filhos}
        catalogo={catalogo}
        disabled={disabled}
        onChange={(filhos) => onChange({ ...ilha, filhos })}
      />
      {ilha.bombas.map((b, bi) => (
        <div key={bi} className="rounded border border-border px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">{rotuloDoTipo(catalogo, "bomba")} {pad2(bi + 1)}</span>
            <QuantidadeField
              inline
              label="Bicos"
              value={b.bicos}
              max={LIMITES.bicos}
              disabled={disabled}
              onChange={(n) =>
                onChange({ ...ilha, bombas: ilha.bombas.map((x, k) => (k === bi ? { ...x, bicos: n } : x)) })
              }
            />
          </div>
          <FilhosEditor
            tipos={filhosDoTipo(catalogo, "bomba")}
            filhos={b.filhos}
            catalogo={catalogo}
            disabled={disabled}
            onChange={(filhos) => onChange({ ...ilha, bombas: ilha.bombas.map((x, k) => (k === bi ? { ...x, filhos } : x)) })}
          />
        </div>
      ))}
    </>
  );
}

/**
 * Itens de tipos novos dentro de um pai (ou na raiz do escopo): uma coleção por tipo, com "Quantidade de …" e a
 * identificação de cada item; cada item mostra os tipos que ficam dentro dele (recursivo). Tipo oculto e vazio some.
 */
function FilhosEditor({
  tipos,
  filhos,
  catalogo,
  disabled,
  onChange,
}: {
  tipos: TipoCatalogo[];
  filhos: FilhosArvore | undefined;
  catalogo: TipoCatalogo[];
  disabled?: boolean;
  onChange: (filhos: FilhosArvore | undefined) => void;
}) {
  const visiveis = tipos.filter((t) => tipoVisivel(catalogo, t.chave, (filhos?.[t.chave] ?? []).length));
  if (!visiveis.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {visiveis.map((t) => (
        <ColecaoNomeada
          key={t.chave}
          titulo={t.chave}
          tituloPlural={t.plural}
          catalogo={catalogo}
          itens={filhos?.[t.chave] ?? []}
          max={LIMITES.extras}
          disabled={disabled}
          onChange={(itens) => {
            const novo: FilhosArvore = { ...(filhos ?? {}) };
            if (itens.length) novo[t.chave] = itens;
            else delete novo[t.chave];
            onChange(Object.keys(novo).length ? novo : undefined);
          }}
        />
      ))}
    </div>
  );
}

/** Resumo lateral: os itens de tipos novos de um pai, com o que há dentro de cada um. */
function ResumoFilhos({ filhos, catalogo }: { filhos: FilhosArvore | undefined; catalogo: TipoCatalogo[] }) {
  const tipos = Object.entries(filhos ?? {}).filter(([, l]) => l.length > 0);
  if (!tipos.length) return null;
  return (
    <ul className="ml-3 border-l border-border pl-2">
      {tipos.map(([tipo, lista]) => (
        <li key={tipo}>
          {pluralDoTipo(catalogo, tipo)}
          <ul className="ml-3 border-l border-border pl-2">
            {lista.map((it, i) => (
              <li key={i}>
                {rotuloEntidade(tipo, i + 1, it.nome, catalogo)}
                <ResumoFilhos filhos={it.filhos} catalogo={catalogo} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function SeVisivel({ mostrar, children }: { mostrar: boolean; children: React.ReactNode }) {
  return mostrar ? <>{children}</> : null;
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
