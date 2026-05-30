import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Save, Upload } from "lucide-react";

import { Button, Card, Input, Label } from "@/components/ui-bits";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { ConfiguracoesNav } from "@/components/ConfiguracoesNav";

export const Route = createFileRoute("/app/configuracoes")({
  component: ConfiguracoesPage,
});

type Config = {
  id: string;
  nome_empresa: string;
  logo_url: string;
  cnpj: string;
  telefone: string;
  email_contato: string;
  endereco: string;
  cidade_estado: string;
  site: string;
  texto_rodape: string;
};

const empty: Config = {
  id: "",
  nome_empresa: "",
  logo_url: "",
  cnpj: "",
  telefone: "",
  email_contato: "",
  endereco: "",
  cidade_estado: "",
  site: "",
  texto_rodape: "",
};

function ConfiguracoesPage() {
  const auth = useAuth();
  const [c, setC] = useState<Config>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("configuracoes_empresa")
      .select("*")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setC({
            id: data.id,
            nome_empresa: data.nome_empresa ?? "",
            logo_url: data.logo_url ?? "",
            cnpj: data.cnpj ?? "",
            telefone: data.telefone ?? "",
            email_contato: data.email_contato ?? "",
            endereco: data.endereco ?? "",
            cidade_estado: data.cidade_estado ?? "",
            site: data.site ?? "",
            texto_rodape: data.texto_rodape ?? "",
          });
        }
        setLoading(false);
      });
  }, []);

  if (auth.status === "authenticated" && auth.role !== "super_admin") {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">Você não tem permissão para acessar esta página.</p>
      </Card>
    );
  }

  const set = (k: keyof Config, v: string) => setC((p) => ({ ...p, [k]: v }));

  const handleLogoUpload = async (file: File) => {
    setUploading(true);
    setErr(null);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("empresa-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("empresa-logos").getPublicUrl(path);
      set("logo_url", pub.publicUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    setMsg(null);
    const payload = {
      nome_empresa: c.nome_empresa || null,
      logo_url: c.logo_url || null,
      cnpj: c.cnpj || null,
      telefone: c.telefone || null,
      email_contato: c.email_contato || null,
      endereco: c.endereco || null,
      cidade_estado: c.cidade_estado || null,
      site: c.site || null,
      texto_rodape: c.texto_rodape || null,
      atualizado_em: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("configuracoes_empresa")
      .update(payload)
      .eq("id", "00000000-0000-0000-0000-000000000001");
    if (error) setErr(error.message);
    else {
      setMsg("Configurações salvas.");
      setTimeout(() => setMsg(null), 2000);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <Card>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Configurações da empresa</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Dados que aparecem no cabeçalho do formulário e no documento final.
        </p>
      </div>

      <Card>
        <div className="space-y-6">
          <div>
            <Label>Logo da empresa</Label>
            <div className="mt-2 flex items-center gap-4">
              {c.logo_url ? (
                <img src={c.logo_url} alt="Logo" className="h-16 w-16 rounded border border-border object-contain bg-white" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded border border-dashed border-border text-xs text-muted-foreground">
                  sem logo
                </div>
              )}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Enviando…" : "Trocar logo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Nome da empresa</Label>
              <Input value={c.nome_empresa} onChange={(e) => set("nome_empresa", e.target.value)} />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={c.cnpj} onChange={(e) => set("cnpj", e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={c.telefone} onChange={(e) => set("telefone", e.target.value)} />
            </div>
            <div>
              <Label>E-mail de contato</Label>
              <Input type="email" value={c.email_contato} onChange={(e) => set("email_contato", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Endereço</Label>
              <Input value={c.endereco} onChange={(e) => set("endereco", e.target.value)} />
            </div>
            <div>
              <Label>Cidade / Estado</Label>
              <Input value={c.cidade_estado} onChange={(e) => set("cidade_estado", e.target.value)} />
            </div>
            <div>
              <Label>Site</Label>
              <Input value={c.site} onChange={(e) => set("site", e.target.value)} placeholder="https://" />
            </div>
            <div className="sm:col-span-2">
              <Label>Texto de rodapé</Label>
              <Input value={c.texto_rodape} onChange={(e) => set("texto_rodape", e.target.value)} />
            </div>
          </div>

          {err && <p className="text-sm text-destructive">{err}</p>}
          {msg && <p className="text-sm text-success">{msg}</p>}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Salvando…" : "Salvar configurações"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
