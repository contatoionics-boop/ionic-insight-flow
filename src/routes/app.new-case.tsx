import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Card, Label, Input, Select, Button, Modal } from "@/components/ui-bits";
import { DatePicker } from "@/components/ui/date-picker";
import { supabase } from "@/integrations/supabase/client";
import { listTechnicalAgents } from "@/lib/admin-users.functions";
import { agendarMapeamento } from "@/lib/casos.functions";
import { verificarConflitoAgente } from "@/lib/agendamentos.functions";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/app/new-case")({
  component: NewCasePage,
});

type Empresa = { id: string; nome: string; codigo_ionics: string | null };
type EnderecoBase = {
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
};
type Matriz = { id: string; empresa_id: string; nome: string; cnpj: string | null } & EnderecoBase;
type Unidade = { id: string; matriz_id: string; nome: string; codigo_ionics: string | null } & EnderecoBase;
type Form = { id: string; nome: string };
type Agente = { id: string; nome: string; user_id: string };

function formatEndereco(u?: EnderecoBase | null) {
  if (!u) return "";
  const parts = [
    [u.logradouro, u.numero].filter(Boolean).join(", "),
    u.bairro,
    [u.cidade, u.estado].filter(Boolean).join("/"),
  ].filter(Boolean);
  return parts.join(" - ");
}

function temEndereco(e?: EnderecoBase | null) {
  return !!(e && (e.logradouro || e.cidade || e.bairro));
}

function NewCasePage() {
  const navigate = useNavigate();
  const loadAgents = useServerFn(listTechnicalAgents);
  const agendar = useServerFn(agendarMapeamento);
  const registrar = useServerFn(registrarProposta);
  const [proposta, setProposta] = useState<File | null>(null);

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [matrizes, setMatrizes] = useState<Matriz[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [agents, setAgents] = useState<Agente[]>([]);

  const [empresaId, setEmpresaId] = useState("");
  const [matrizId, setMatrizId] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [formIds, setFormIds] = useState<string[]>([]);
  const [agentId, setAgentId] = useState("");
  const [agenteNomeManual, setAgenteNomeManual] = useState("");
  const [tipoSolicitacao, setTipoSolicitacao] = useState<"instalacao" | "upgrade">("instalacao");
  const [modalidade, setModalidade] = useState<"presencial" | "remoto">("presencial");
  const [nivel, setNivel] = useState<"nivel_1" | "nivel_2" | "nivel_3">("nivel_1");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("09:00");
  const [endereco, setEndereco] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [conflito, setConflito] = useState<{ agenteNome?: string | null; clienteNome?: string | null; dataConflito?: string | null } | null>(null);
  const verificar = useServerFn(verificarConflitoAgente);

  useEffect(() => {
    (async () => {
      const [e, m, u, f, ag] = await Promise.all([
        supabase.from("empresas").select("id, nome, codigo_ionics" as any).order("nome"),
        supabase
          .from("matrizes")
          .select("id, empresa_id, nome, cnpj, logradouro, numero, bairro, cidade, estado")
          .order("nome"),
        supabase
          .from("unidades")
          .select("id, matriz_id, nome, codigo_ionics, logradouro, numero, bairro, cidade, estado" as any)
          .order("nome"),
        supabase.from("formularios").select("id, nome").eq("ativo", true).order("nome"),
        loadAgents(),
      ]);
      setEmpresas(((e.data ?? []) as unknown) as Empresa[]);
      setMatrizes((m.data ?? []) as Matriz[]);
      setUnidades(((u.data ?? []) as unknown) as Unidade[]);
      setForms((f.data ?? []) as Form[]);
      setAgents((ag ?? []) as Agente[]);
    })();
  }, [loadAgents]);

  const matrizesDaEmpresa = useMemo(
    () => matrizes.filter((m) => m.empresa_id === empresaId),
    [matrizes, empresaId],
  );
  const unidadesDaMatriz = useMemo(
    () => unidades.filter((u) => u.matriz_id === matrizId),
    [unidades, matrizId],
  );

  // Auto-seleciona matriz/unidade quando há só uma
  useEffect(() => {
    if (matrizesDaEmpresa.length === 1 && !matrizId) {
      setMatrizId(matrizesDaEmpresa[0].id);
    } else if (matrizesDaEmpresa.length === 0) {
      setMatrizId("");
    }
  }, [matrizesDaEmpresa, matrizId]);

  useEffect(() => {
    if (unidadesDaMatriz.length === 1 && !unidadeId) {
      setUnidadeId(unidadesDaMatriz[0].id);
    } else if (unidadesDaMatriz.length === 0) {
      setUnidadeId("");
    }
  }, [unidadesDaMatriz, unidadeId]);

  // Auto-preenche endereço a partir da unidade, ou matriz como fallback
  useEffect(() => {
    if (endereco) return;
    const u = unidades.find((x) => x.id === unidadeId);
    if (temEndereco(u)) {
      setEndereco(formatEndereco(u));
      return;
    }
    const m = matrizes.find((x) => x.id === matrizId);
    if (temEndereco(m)) setEndereco(formatEndereco(m));
  }, [unidadeId, matrizId, unidades, matrizes, endereco]);

  const onChangeEmpresa = (v: string) => {
    setEmpresaId(v);
    setMatrizId("");
    setUnidadeId("");
    setEndereco("");
  };
  const onChangeMatriz = (v: string) => {
    setMatrizId(v);
    setUnidadeId("");
    setEndereco("");
  };
  const onChangeUnidade = (v: string) => {
    setUnidadeId(v);
    setEndereco("");
  };

  // Verifica conflito em tempo real quando agente + data estão preenchidos
  useEffect(() => {
    if (!agentId || !data) { setConflito(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const agendadoEm = new Date(`${data}T${hora || "09:00"}:00`).toISOString();
        const res = await verificar({ data: { agenteId: agentId, data: agendadoEm, duracaoMin: 60 } });
        if (cancelled) return;
        if (res.conflito) {
          setConflito({ agenteNome: res.agenteNome, clienteNome: res.clienteNome, dataConflito: res.dataConflito });
        } else {
          setConflito(null);
        }
      } catch {
        // ignora
      }
    })();
    return () => { cancelled = true; };
  }, [agentId, data, hora, verificar]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formIds.length === 0) {
      setError("Selecione ao menos um formulário.");
      return;
    }
    if (modalidade === "presencial" && !agentId) {
      setError("Selecione o agente técnico para atendimento presencial.");
      return;
    }
    if (conflito) {
      // Bloqueia completamente
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const agendadoEm = new Date(`${data}T${hora}:00`).toISOString();
      const res = await agendar({
        data: {
          unidadeId: unidadeId || null,
          matrizId: matrizId || null,
          formIds,
          agenteId: agentId || null,
          agenteNomeManual: agentId ? null : agenteNomeManual.trim() || null,
          tipoSolicitacao,
          modalidade,
          nivel,
          agendadoEm,
          duracaoMin: 60,
          enderecoVistoria: endereco || null,
          observacoes: observacoes || null,
        },
      });

      if (proposta && res?.casos?.length) {
        try {
          for (const c of res.casos as { id: string }[]) {
            const path = `casos/${c.id}/${Date.now()}-${proposta.name.replace(/[^\w.-]+/g, "_")}`;
            const up = await supabase.storage.from("propostas").upload(path, proposta, {
              contentType: "application/pdf",
              upsert: false,
            });
            if (up.error) throw new Error(up.error.message);
            await registrar({
              data: {
                casoId: c.id,
                arquivoNome: proposta.name,
                arquivoPath: path,
                tamanhoBytes: proposta.size,
              },
            });
          }
        } catch (errProposta: any) {
          setError(
            `Mapeamento agendado, mas a proposta não pôde ser processada: ${errProposta?.message ?? "erro desconhecido"}. Anexe-a novamente na tela de revisão.`,
          );
          setWorking(false);
          return;
        }
      }

      navigate({ to: "/app/agenda" });
    } catch (err: any) {
      setError(err?.message ?? "Erro ao agendar mapeamento.");
    } finally {
      setWorking(false);
    }
  };

  const toggleForm = (id: string) => {
    setFormIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const empresaSel = empresas.find((x) => x.id === empresaId);
  const unidadeSel = unidades.find((x) => x.id === unidadeId);


  return (
    <div>
      <PageHeader
        title="Agendar mapeamento"
        description="Escolha a unidade do cliente, o agente técnico e a data."
      />

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Empresa</Label>
              <Select value={empresaId} onChange={(e) => onChangeEmpresa(e.target.value)} required>
                <option value="">Selecione a empresa</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}{e.codigo_ionics ? ` · ${e.codigo_ionics}` : ""}
                  </option>
                ))}
              </Select>
              {empresaSel?.codigo_ionics && (
                <p className="mt-1 font-mono text-xs text-primary">{empresaSel.codigo_ionics}</p>
              )}
            </div>
            <div>
              <Label>Matriz</Label>
              <Select
                value={matrizId}
                onChange={(e) => onChangeMatriz(e.target.value)}
                required
                disabled={!empresaId}
              >
                <option value="">{empresaId ? "Selecione a matriz" : "Selecione a empresa antes"}</option>
                {matrizesDaEmpresa.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                    {m.cnpj ? ` · ${m.cnpj}` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Unidade</Label>
              {matrizId && unidadesDaMatriz.length === 0 ? (
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Sem unidades cadastradas — o mapeamento será agendado na sede (endereço da matriz).
                </div>
              ) : (
                <Select
                  value={unidadeId}
                  onChange={(e) => onChangeUnidade(e.target.value)}
                  required={unidadesDaMatriz.length > 0}
                  disabled={!matrizId}
                >
                  <option value="">{matrizId ? "Selecione a unidade" : "Selecione a matriz antes"}</option>
                  {unidadesDaMatriz.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}{u.codigo_ionics ? ` · ${u.codigo_ionics}` : ""}
                    </option>
                  ))}
                </Select>
              )}
              {unidadeSel?.codigo_ionics && (
                <p className="mt-1 font-mono text-xs text-primary">{unidadeSel.codigo_ionics}</p>
              )}
            </div>

          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Tipo de solicitação</Label>
              <Select value={tipoSolicitacao} onChange={(e) => setTipoSolicitacao(e.target.value as any)} required>
                <option value="instalacao">Instalação</option>
                <option value="upgrade">Upgrade</option>
              </Select>
            </div>
            <div>
              <Label>Modalidade</Label>
              <Select
                value={modalidade}
                onChange={(e) => {
                  const v = e.target.value as "presencial" | "remoto";
                  setModalidade(v);
                  if (v === "presencial") setAgenteNomeManual("");
                }}
                required
              >
                <option value="presencial">Presencial</option>
                <option value="remoto">Remoto</option>
              </Select>
            </div>
            <div>
              <Label>Nível do mapeamento</Label>
              <Select value={nivel} onChange={(e) => setNivel(e.target.value as any)} required>
                <option value="nivel_1">Nível 1</option>
                <option value="nivel_2">Nível 2</option>
                <option value="nivel_3">Nível 3</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Formulários ({formIds.length} selecionado{formIds.length === 1 ? "" : "s"})</Label>
              <div className="mt-1 max-h-48 space-y-1 overflow-auto rounded-md border border-border bg-background p-2">
                {forms.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-muted-foreground">Nenhum formulário ativo.</p>
                ) : (
                  forms.map((f) => (
                    <label
                      key={f.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={formIds.includes(f.id)}
                        onChange={() => toggleForm(f.id)}
                        className="h-4 w-4 rounded border-border"
                      />
                      <span className="text-foreground">{f.nome}</span>
                    </label>
                  ))
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Cada formulário gera um mapeamento independente dentro deste agendamento.</p>
            </div>
            <div>
              <Label>Agente técnico{modalidade === "remoto" ? " (opcional)" : ""}</Label>
              <Select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                required={modalidade === "presencial"}
                className={conflito ? "border-destructive ring-1 ring-destructive" : undefined}
              >
                <option value="">
                  {modalidade === "remoto" ? "Selecione ou deixe em branco" : "Selecione o agente técnico"}
                </option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.nome || "(sem nome)"}</option>)}
              </Select>
              {modalidade === "remoto" && !agentId && (
                <>
                  <Input
                    className="mt-2"
                    value={agenteNomeManual}
                    onChange={(e) => setAgenteNomeManual(e.target.value)}
                    placeholder="Ou digite o nome do agente (opcional)"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    No atendimento remoto o nome pode ser digitado manualmente ou definido depois.
                  </p>
                </>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label>Data</Label>
                <div className={conflito ? "rounded-md border border-destructive ring-1 ring-destructive" : undefined}>
                  <DatePicker value={data} onChange={setData} />
                </div>
              </div>
              <div>
                <Label>Hora</Label>
                <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} required />
              </div>
            </div>
            <div className="md:col-span-2">
              <Label>Endereço do mapeamento</Label>
              <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Auto-preenchido pela unidade ou matriz" />
            </div>
            <div className="md:col-span-2">
              <Label>Observações para o agente técnico</Label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="Instruções, ponto de referência, contato no local..."
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            {conflito && (
              <span className="text-xs text-destructive">Conflito detectado — escolha outro agente ou data.</span>
            )}
            <Button type="submit" disabled={working || !matrizId || !!conflito}>
              {working ? "Agendando..." : "Agendar mapeamento"}
            </Button>
          </div>
        </form>
      </Card>

      <Modal open={!!conflito} onClose={() => setConflito(null)} title="Conflito de agenda">
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              O agente <strong>{conflito?.agenteNome ?? ""}</strong> já está agendado em{" "}
              <strong>
                {conflito?.dataConflito ? new Date(conflito.dataConflito).toLocaleString("pt-BR") : ""}
              </strong>{" "}
              para <strong>{conflito?.clienteNome ?? "outro cliente"}</strong>. Escolha outro agente ou outra data para continuar.
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setConflito(null)}>Entendido</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
