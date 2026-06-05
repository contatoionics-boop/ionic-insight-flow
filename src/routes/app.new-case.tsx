import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Card, Label, Input, Select, Button } from "@/components/ui-bits";
import { DatePicker } from "@/components/ui/date-picker";
import { supabase } from "@/integrations/supabase/client";
import { listTechnicalAgents } from "@/lib/admin-users.functions";
import { agendarVistoria } from "@/lib/casos.functions";

export const Route = createFileRoute("/app/new-case")({
  component: NewCasePage,
});

type Empresa = { id: string; nome: string };
type EnderecoBase = {
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
};
type Matriz = { id: string; empresa_id: string; nome: string; cnpj: string | null } & EnderecoBase;
type Unidade = { id: string; matriz_id: string; nome: string } & EnderecoBase;
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
  const agendar = useServerFn(agendarVistoria);

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [matrizes, setMatrizes] = useState<Matriz[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [agents, setAgents] = useState<Agente[]>([]);

  const [empresaId, setEmpresaId] = useState("");
  const [matrizId, setMatrizId] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [formId, setFormId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("09:00");
  const [endereco, setEndereco] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    (async () => {
      const [e, m, u, f, ag] = await Promise.all([
        supabase.from("empresas").select("id, nome").order("nome"),
        supabase.from("matrizes").select("id, empresa_id, nome, cnpj").order("nome"),
        supabase
          .from("unidades")
          .select("id, matriz_id, nome, logradouro, numero, bairro, cidade, estado")
          .order("nome"),
        supabase.from("formularios").select("id, nome").eq("ativo", true).order("nome"),
        loadAgents(),
      ]);
      setEmpresas((e.data ?? []) as Empresa[]);
      setMatrizes((m.data ?? []) as Matriz[]);
      setUnidades((u.data ?? []) as Unidade[]);
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorking(true);
    setError(null);
    try {
      const agendadoEm = new Date(`${data}T${hora}:00`).toISOString();
      await agendar({
        data: {
          unidadeId,
          formId,
          agenteId: agentId,
          agendadoEm,
          duracaoMin: 60,
          enderecoVistoria: endereco || null,
          observacoes: observacoes || null,
          gerarLink: false,
          mode: "stepper",
        },
      });
      navigate({ to: "/app/agenda" });
    } catch (err: any) {
      setError(err?.message ?? "Erro ao agendar mapeamento.");
    } finally {
      setWorking(false);
    }
  };

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
                {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </Select>
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
              <Select
                value={unidadeId}
                onChange={(e) => onChangeUnidade(e.target.value)}
                required
                disabled={!matrizId}
              >
                <option value="">{matrizId ? "Selecione a unidade" : "Selecione a matriz antes"}</option>
                {unidadesDaMatriz.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </Select>
              {matrizId && unidadesDaMatriz.length === 0 && (
                <p className="mt-1 text-xs text-destructive">Esta matriz não tem unidade. Cadastre uma em Clientes.</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Formulário</Label>
              <Select value={formId} onChange={(e) => setFormId(e.target.value)} required>
                <option value="">Selecione o formulário</option>
                {forms.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </Select>
            </div>
            <div>
              <Label>Agente técnico</Label>
              <Select value={agentId} onChange={(e) => setAgentId(e.target.value)} required>
                <option value="">Selecione o agente técnico</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.nome || "(sem nome)"}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label>Data</Label>
                <DatePicker value={data} onChange={setData} />
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

          <div className="flex justify-end">
            <Button type="submit" disabled={working || !unidadeId}>
              {working ? "Agendando..." : "Agendar mapeamento"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
