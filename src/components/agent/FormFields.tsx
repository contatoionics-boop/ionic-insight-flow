import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Camera,
  Video,
  Check,
  Loader2,
  Mic,
  Pencil,
  Square,
  X,
} from "lucide-react";

import { Button, Card, Textarea } from "@/components/ui-bits";
import { DatePicker } from "@/components/ui/date-picker";
import { supabase } from "@/integrations/supabase/client";
import { transcreverAudio, validarFoto } from "@/lib/agent-ai.functions";
import { useGravacaoVoz } from "@/components/agent/use-gravacao-voz";
import { fetchUFs, fetchMunicipios, type UF, type Municipio } from "@/lib/ibge";
import { detectarCampo, valorParaCampo, type CampoMapeado } from "@/lib/perguntas-mapeamento";
import { buscarPorCnpj, type BuscarPorCnpjResult } from "@/lib/cnpj-cache.functions";

function MicButton({
  token,
  current,
  onText,
  disabled,
}: {
  token: string;
  current: string;
  onText: (texto: string) => void;
  disabled?: boolean;
}) {
  const { recording, transcrevendo, erro, start, stop, mmss } = useGravacaoVoz({
    token,
    onTranscricao: (txt) => {
      if (!txt) return;
      const base = (current ?? "").trim();
      onText(base ? `${base} ${txt}` : txt);
    },
  });
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={disabled || transcrevendo}
        title={recording ? "Parar gravação" : "Gravar voz"}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md border transition ${
          recording
            ? "border-destructive bg-destructive/10 text-destructive animate-pulse"
            : "border-border bg-background text-muted-foreground hover:bg-muted"
        } ${transcrevendo ? "opacity-60" : ""}`}
      >
        {transcrevendo ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : recording ? (
          <Square className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>
      {recording && <span className="font-mono text-[10px] text-destructive">{mmss}</span>}
      {transcrevendo && <span className="text-[10px] text-muted-foreground">transcrevendo…</span>}
      {erro && <span className="text-[10px] text-destructive">{erro}</span>}
    </div>
  );
}

export type TipoPergunta =
  | "texto"
  | "numero"
  | "foto"
  | "video"
  | "audio"
  | "checkbox"
  | "multipla_escolha"
  | "data"
  | "selecao_unica"
  | "toggle"
  | "cep"
  | "cnpj";

export type Pergunta = {
  id: string;
  secao_id: string;
  texto: string;
  tipo: TipoPergunta;
  obrigatoria: boolean;
  ordem: number;
  instrucao_agente: string | null;
  contexto_ia: string | null;
  opcoes?: { id: string; texto: string }[];
  condicional_pergunta_id?: string | null;
  condicional_operador?: string | null;
  condicional_valor?: string | null;
};

export type IaResultado = {
  status: "aprovada" | "parcial" | "incorreta";
  descricao_encontrada: string;
  problemas: string[];
  orientacao: string;
};

export type Resposta = {
  text?: string;
  filePath?: string;
  fileName?: string;
  filePreview?: string;
  ia?: IaResultado;
  iaConfirmada?: boolean;
  audioPath?: string;
  transcription?: string;
  transcriptionConfirmed?: boolean;
};

export type RendererMode = "live" | "preview";

async function fileToBase64(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function isComplete(
  p: Pergunta,
  r: Resposta,
  mode: RendererMode = "live",
  opts: { validarImagensIa?: boolean } = {},
): boolean {
  if (!p.obrigatoria) return true;
  const validarIa = opts.validarImagensIa ?? false;
  switch (p.tipo) {
    case "foto":
      if (mode === "preview") return !!r.filePreview;
      if (!r.filePath) return false;
      if (!validarIa) return true;
      // Se a análise por IA não retornou (falha/indisponível), a confirmação
      // manual do usuário libera o avanço — a foto já está no storage.
      if (!r.ia) return !!r.iaConfirmada;
      if (r.ia.status === "incorreta") return false;
      if (r.ia.status === "parcial" && !r.iaConfirmada) return false;
      return true;

    case "video":
      return mode === "preview" ? !!r.filePreview : !!r.filePath;
    case "audio":
      if (mode === "preview") return !!r.transcription?.trim() || !!r.audioPath;
      return !!r.transcription?.trim() && !!r.transcriptionConfirmed;
    default:
      return !!r.text?.trim();
  }
}

export type Siblings = {
  perguntas: Pergunta[];
  state: Record<string, Resposta>;
  updateById: (perguntaId: string, patch: Partial<Resposta>) => void;
};

export function PerguntaBloco({
  pergunta,
  casoId,
  token,
  resposta,
  update,
  mode,
  siblings,
  validarImagensIa = false,
}: {
  pergunta: Pergunta;
  casoId: string;
  token: string;
  resposta: Resposta;
  update: (patch: Partial<Resposta>) => void;
  mode: RendererMode;
  siblings?: Siblings;
  validarImagensIa?: boolean;
}) {
  const campo = detectarCampo(pergunta);
  // Renderers especiais para perguntas tipo "texto" detectadas como estado/cidade
  const renderEspecial = pergunta.tipo === "texto" && (campo === "estado" || campo === "cidade");

  return (
    <Card>
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">
          {pergunta.texto}
          {pergunta.obrigatoria && <span className="ml-1 text-destructive">*</span>}
        </h3>
      </div>
      {pergunta.instrucao_agente && (
        <p className="mb-3 text-xs text-muted-foreground">{pergunta.instrucao_agente}</p>
      )}
      {mode === "preview" && pergunta.contexto_ia && (pergunta.tipo === "foto" || pergunta.tipo === "audio") && (
        <p className="mb-3 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Contexto IA:</span> {pergunta.contexto_ia}
        </p>
      )}

      {renderEspecial && campo === "estado" && (
        <CampoEstado resposta={resposta} update={update} />
      )}
      {renderEspecial && campo === "cidade" && (
        <CampoCidade resposta={resposta} update={update} siblings={siblings} />
      )}

      {!renderEspecial && pergunta.tipo === "texto" && (
        <div className="flex items-start gap-2">
          <Textarea
            rows={3}
            placeholder="Digite ou grave por voz…"
            value={resposta.text ?? ""}
            onChange={(e) => update({ text: e.target.value })}
            className="flex-1"
          />
          <MicButton token={token} current={resposta.text ?? ""} onText={(t) => update({ text: t })} />
        </div>
      )}

      {pergunta.tipo === "numero" && (
        <input
          type="number"
          inputMode="decimal"
          className="w-full rounded-md border border-border bg-background px-3 py-3 text-base"
          placeholder="0"
          value={resposta.text ?? ""}
          onChange={(e) => update({ text: e.target.value })}
        />
      )}

      {pergunta.tipo === "data" && (
        <DatePicker
          value={resposta.text ?? ""}
          onChange={(v: string) => update({ text: v })}
        />
      )}

      {pergunta.tipo === "toggle" && (
        <div className="grid grid-cols-2 gap-3">
          {(["sim", "nao"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => update({ text: v })}
              className={`h-12 rounded-md border text-sm font-semibold transition ${
                resposta.text === v
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {v === "sim" ? "Sim" : "Não"}
            </button>
          ))}
        </div>
      )}

      {pergunta.tipo === "selecao_unica" && (
        <div className="space-y-2">
          {(pergunta.opcoes ?? []).map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => update({ text: o.texto })}
              className={`block w-full rounded-md border px-4 py-3 text-left text-sm transition ${
                resposta.text === o.texto
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              {o.texto}
            </button>
          ))}
        </div>
      )}

      {pergunta.tipo === "checkbox" && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={resposta.text === "sim"}
            onChange={(e) => update({ text: e.target.checked ? "sim" : "" })}
            className="mt-0.5 h-4 w-4"
          />
          <span>Confirmo</span>
        </label>
      )}

      {pergunta.tipo === "foto" && (
        <CampoFoto pergunta={pergunta} casoId={casoId} token={token} resposta={resposta} update={update} mode={mode} validarImagensIa={validarImagensIa} />
      )}

      {pergunta.tipo === "video" && (
        <CampoVideo casoId={casoId} resposta={resposta} update={update} mode={mode} />
      )}

      {pergunta.tipo === "audio" && (
        <CampoAudio casoId={casoId} token={token} resposta={resposta} update={update} mode={mode} />
      )}

      {pergunta.tipo === "cep" && (
        <CampoCep resposta={resposta} update={update} token={token} />
      )}

      {pergunta.tipo === "cnpj" && (
        <CampoCnpj resposta={resposta} update={update} token={token} siblings={siblings} />
      )}
    </Card>
  );
}

function CampoCep({
  resposta,
  update,
  token,
}: {
  resposta: Resposta;
  update: (patch: Partial<Resposta>) => void;
  token: string;
}) {
  const [valor, setValor] = useState(resposta.text ?? "");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [endereco, setEndereco] = useState<string | null>(null);

  const buscar = async () => {
    setLoading(true);
    setMsg(null);
    setEndereco(null);
    try {
      const { consultarCep, maskCep } = await import("@/lib/cep");
      const d = await consultarCep(valor);
      const v = maskCep(d.cep);
      setValor(v);
      const linha = `${d.logradouro}, ${d.bairro} — ${d.cidade}/${d.estado}`;
      setEndereco(linha);
      update({ text: `${v} — ${linha}` });
      setMsg("✓ Endereço encontrado.");
    } catch (e: any) {
      setMsg(e?.message ?? "Falha ao buscar CEP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          inputMode="numeric"
          className="flex-1 rounded-md border border-border bg-background px-3 py-3 text-base"
          placeholder="00000-000"
          value={valor}
          onChange={(e) => {
            const masked = e.target.value
              .replace(/\D/g, "")
              .slice(0, 8)
              .replace(/^(\d{5})(\d{1,3}).*$/, "$1-$2");
            setValor(masked);
            update({ text: masked });
          }}
        />
        <Button type="button" variant="outline" onClick={buscar} disabled={loading || !valor}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "🔍"} Buscar
        </Button>
      </div>
      {endereco && (
        <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
          {endereco}
        </div>
      )}
      {msg && !endereco && <p className="text-xs text-destructive">{msg}</p>}
      <p className="text-xs text-muted-foreground">
        Se preferir, digite o endereço manualmente abaixo:
      </p>
      <div className="flex items-start gap-2">
        <Textarea
          rows={2}
          placeholder="Endereço completo (livre ou por voz)"
          value={resposta.text ?? ""}
          onChange={(e) => update({ text: e.target.value })}
          className="flex-1"
        />
        <MicButton token={token} current={resposta.text ?? ""} onText={(t) => update({ text: t })} />
      </div>
    </div>
  );
}

function CampoCnpj({
  resposta,
  update,
  token,
  siblings,
}: {
  resposta: Resposta;
  update: (patch: Partial<Resposta>) => void;
  token: string;
  siblings?: Siblings;
}) {
  const [valor, setValor] = useState(resposta.text ?? "");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [internal, setInternal] = useState<BuscarPorCnpjResult | null>(null);
  const [unidadeIdx, setUnidadeIdx] = useState<number>(-1);
  const buscarInternoFn = useServerFn(buscarPorCnpj);

  const aplicarUnidade = (u: NonNullable<BuscarPorCnpjResult["unidades"]>[number] | NonNullable<NonNullable<BuscarPorCnpjResult["ultimaVistoria"]>["unidade"]>) => {
    if (!siblings) return;
    const dados = {
      cnpj: internal?.matriz?.cnpj ?? valor,
      razao_social: internal?.matriz?.razao_social ?? internal?.matriz?.nome ?? null,
      empresa_nome: internal?.empresa?.nome ?? null,
      matriz_nome: internal?.matriz?.nome ?? null,
      unidade_nome: u.nome ?? null,
      cep: u.cep ?? null,
      logradouro: u.logradouro ?? null,
      numero: u.numero ?? null,
      bairro: u.bairro ?? null,
      cidade: u.cidade ?? null,
      estado: u.estado ?? null,
    };
    for (const p of siblings.perguntas) {
      if (p.id === undefined) continue;
      const ja = siblings.state[p.id]?.text?.trim();
      if (ja) continue;
      const v = valorParaCampo(detectarCampo(p), dados);
      if (v) siblings.updateById(p.id, { text: v });
    }
  };

  const buscar = async () => {
    setLoading(true);
    setMsg(null);
    setInfo(null);
    setInternal(null);
    setUnidadeIdx(-1);
    try {
      // 1) Tenta cache interno (matriz cadastrada / última vistoria)
      const r = (await buscarInternoFn({ data: { cnpj: valor } })) as BuscarPorCnpjResult;
      if (r.matriz) {
        setInternal(r);
        const nome = r.matriz.razao_social ?? r.matriz.nome ?? "";
        setInfo(`✓ Cliente já cadastrado: ${nome}`);
        const v = r.matriz.cnpj ?? valor;
        setValor(v);
        update({ text: v });
        // auto-aplica se só tem uma unidade
        if (r.unidades.length === 1) {
          setUnidadeIdx(0);
          aplicarUnidade(r.unidades[0]);
        } else if (r.unidades.length === 0 && r.ultimaVistoria?.unidade) {
          aplicarUnidade(r.ultimaVistoria.unidade);
          setInfo(`✓ Dados da última vistoria recuperados.`);
        }
        return;
      }
      if (r.ultimaVistoria?.unidade) {
        setInternal(r);
        setInfo(`✓ Dados da última vistoria recuperados para este CNPJ.`);
        aplicarUnidade(r.ultimaVistoria.unidade);
        return;
      }
      // 2) Fallback: API pública
      const { consultarCnpj, maskCnpj } = await import("@/lib/cnpj");
      const d = await consultarCnpj(valor);
      const v = maskCnpj(d.cnpj);
      setValor(v);
      const linha = d.nome_fantasia ? `${d.razao_social} — ${d.nome_fantasia}` : d.razao_social;
      setInfo(linha);
      update({ text: v });
      // preenche siblings com os dados públicos
      if (siblings) {
        const dados = {
          cnpj: v,
          razao_social: d.razao_social,
          empresa_nome: d.nome_fantasia || d.razao_social,
          matriz_nome: d.razao_social,
          cep: d.cep,
          logradouro: d.logradouro,
          numero: d.numero,
          bairro: d.bairro,
          cidade: d.cidade,
          estado: d.estado,
        };
        for (const p of siblings.perguntas) {
          const ja = siblings.state[p.id]?.text?.trim();
          if (ja) continue;
          const vCampo = valorParaCampo(detectarCampo(p), dados);
          if (vCampo) siblings.updateById(p.id, { text: vCampo });
        }
      }
      setMsg("✓ CNPJ encontrado.");
    } catch (e: any) {
      setMsg(e?.message ?? "Falha ao consultar CNPJ.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          inputMode="numeric"
          className="flex-1 rounded-md border border-border bg-background px-3 py-3 text-base"
          placeholder="00.000.000/0000-00"
          value={valor}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "").slice(0, 14);
            const p1 = d.slice(0, 2);
            const p2 = d.slice(2, 5);
            const p3 = d.slice(5, 8);
            const p4 = d.slice(8, 12);
            const p5 = d.slice(12, 14);
            let out = p1;
            if (d.length > 2) out += `.${p2}`;
            if (d.length > 5) out += `.${p3}`;
            if (d.length > 8) out += `/${p4}`;
            if (d.length > 12) out += `-${p5}`;
            setValor(out);
            update({ text: out });
          }}
        />
        <Button type="button" variant="outline" onClick={buscar} disabled={loading || !valor}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "🔍"} Consultar
        </Button>
      </div>
      {info && (
        <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
          {info}
        </div>
      )}
      {internal && internal.unidades.length > 1 && (
        <div className="rounded-md border border-border bg-muted/30 p-2">
          <p className="mb-1 text-xs font-semibold text-foreground">
            Selecione a unidade desta vistoria:
          </p>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={unidadeIdx}
            onChange={(e) => {
              const i = Number(e.target.value);
              setUnidadeIdx(i);
              if (i >= 0) aplicarUnidade(internal.unidades[i]);
            }}
          >
            <option value={-1}>— escolher unidade —</option>
            {internal.unidades.map((u, i) => (
              <option key={u.id} value={i}>
                {u.nome}
                {u.cidade ? ` · ${u.cidade}/${u.estado ?? ""}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
      {msg && !info && <p className="text-xs text-destructive">{msg}</p>}
      <p className="text-xs text-muted-foreground">
        Se a consulta falhar, digite o nome do cliente manualmente:
      </p>
      <div className="flex items-start gap-2">
        <Textarea
          rows={2}
          placeholder="Nome do cliente (livre ou por voz)"
          value={resposta.text ?? ""}
          onChange={(e) => update({ text: e.target.value })}
          className="flex-1"
        />
        <MicButton token={token} current={resposta.text ?? ""} onText={(t) => update({ text: t })} />
      </div>
    </div>
  );
}

function CampoEstado({
  resposta,
  update,
}: {
  resposta: Resposta;
  update: (patch: Partial<Resposta>) => void;
}) {
  const [ufs, setUfs] = useState<UF[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetchUFs()
      .then((d) => setUfs(d))
      .catch((e) => setErr(e?.message ?? "Falha ao carregar UFs."))
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className="space-y-1">
      <select
        disabled={loading}
        className="w-full rounded-md border border-border bg-background px-3 py-3 text-base"
        value={resposta.text ?? ""}
        onChange={(e) => update({ text: e.target.value })}
      >
        <option value="">{loading ? "Carregando estados…" : "Selecione o estado"}</option>
        {ufs.map((u) => (
          <option key={u.sigla} value={u.sigla}>
            {u.sigla} — {u.nome}
          </option>
        ))}
      </select>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

function CampoCidade({
  resposta,
  update,
  siblings,
}: {
  resposta: Resposta;
  update: (patch: Partial<Resposta>) => void;
  siblings?: Siblings;
}) {
  // Detecta a UF lendo a pergunta-irmã marcada como estado
  const ufIrma = (() => {
    if (!siblings) return "";
    for (const p of siblings.perguntas) {
      if (detectarCampo(p) === "estado") {
        const v = (siblings.state[p.id]?.text ?? "").trim().toUpperCase();
        if (/^[A-Z]{2}$/.test(v)) return v;
      }
    }
    return "";
  })();

  const [cidades, setCidades] = useState<Municipio[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!ufIrma) {
      setCidades([]);
      return;
    }
    setLoading(true);
    setErr(null);
    fetchMunicipios(ufIrma)
      .then(setCidades)
      .catch((e) => setErr(e?.message ?? "Falha ao carregar cidades."))
      .finally(() => setLoading(false));
  }, [ufIrma]);

  if (!ufIrma) {
    return (
      <div className="space-y-1">
        <input
          className="w-full rounded-md border border-border bg-background px-3 py-3 text-base"
          placeholder="Selecione o estado primeiro ou digite a cidade"
          value={resposta.text ?? ""}
          onChange={(e) => update({ text: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Selecione o estado acima para filtrar as cidades.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <select
        disabled={loading}
        className="w-full rounded-md border border-border bg-background px-3 py-3 text-base"
        value={resposta.text ?? ""}
        onChange={(e) => update({ text: e.target.value })}
      >
        <option value="">
          {loading ? `Carregando cidades de ${ufIrma}…` : `Selecione a cidade (${ufIrma})`}
        </option>
        {cidades.map((c) => (
          <option key={c.id} value={c.nome}>
            {c.nome}
          </option>
        ))}
      </select>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}


function CampoFoto({
  pergunta,
  casoId,
  token,
  resposta,
  update,
  mode,
  validarImagensIa = false,
}: {
  pergunta: Pergunta;
  casoId: string;
  token: string;
  resposta: Resposta;
  update: (patch: Partial<Resposta>) => void;
  mode: RendererMode;
  validarImagensIa?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const validarFn = useServerFn(validarFoto);

  const enviar = async (file: File) => {
    setErr(null);
    if (mode === "preview") {
      const preview = URL.createObjectURL(file);
      update({ filePath: "preview", fileName: file.name, filePreview: preview, ia: undefined, iaConfirmada: true });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `casos/${casoId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("agente-uploads").upload(path, file, { upsert: false });
      if (error) throw error;
      const preview = URL.createObjectURL(file);
      update({ filePath: path, fileName: file.name, filePreview: preview, ia: undefined, iaConfirmada: !validarImagensIa });
      setUploading(false);

      if (!validarImagensIa) return;

      setAnalisando(true);
      try {
        const base64 = await fileToBase64(file);
        const ehUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(casoId);
        const ia = (await validarFn({
          data: {
            token,
            ...(ehUuid ? { casoId } : {}),
            perguntaId: pergunta.id,
            imagemBase64: base64,
            mime: file.type || "image/jpeg",
          },
        })) as IaResultado;


        update({ ia, iaConfirmada: ia.status === "aprovada" });
      } catch (iaErr) {
        // Falha da IA não bloqueia o envio: marca como confirmada pelo usuário e exibe aviso.
        update({ iaConfirmada: true });
        setErr(
          (iaErr instanceof Error ? iaErr.message : "Falha ao analisar a foto.") +
            " A foto foi mantida e você pode avançar.",
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao processar foto.");
    } finally {
      setUploading(false);
      setAnalisando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const ia = resposta.ia;
  const badge =
    ia?.status === "aprovada"
      ? { color: "bg-success/15 text-success border-success/30", icon: <Check className="h-4 w-4" />, label: "Foto aprovada pela IA" }
      : ia?.status === "parcial"
      ? { color: "bg-warning/15 text-warning-foreground border-warning/30", icon: <AlertTriangle className="h-4 w-4" />, label: "Atenção — revisar" }
      : ia?.status === "incorreta"
      ? { color: "bg-destructive/15 text-destructive border-destructive/30", icon: <X className="h-4 w-4" />, label: "Foto não atende" }
      : null;

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && enviar(e.target.files[0])}
      />

      {!resposta.filePath ? (
        <Button onClick={() => inputRef.current?.click()} className="h-12 w-full" disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Camera className="h-4 w-4" /> Tirar / enviar foto</>}
        </Button>
      ) : (
        <>
          {resposta.filePreview && (
            <img src={resposta.filePreview} alt="Foto enviada" className="w-full rounded-md border border-border object-cover" />
          )}
          {analisando && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Analisando imagem com IA…
            </div>
          )}
          {badge && (
            <div className={`rounded-md border px-3 py-2 text-sm ${badge.color}`}>
              <div className="flex items-center gap-2 font-medium">
                {badge.icon} {badge.label}
              </div>
              {ia && ia.orientacao && <p className="mt-1 text-xs">{ia.orientacao}</p>}
              {ia && ia.problemas.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-xs">
                  {ia.problemas.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              )}
              {ia?.status === "parcial" && !resposta.iaConfirmada && (
                <button
                  onClick={() => update({ iaConfirmada: true })}
                  className="mt-2 text-xs font-semibold underline"
                >
                  Avançar mesmo assim
                </button>
              )}
            </div>
          )}
          {mode === "preview" && (
            <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Modo preview — IA não é executada.
            </div>
          )}
          <Button variant="outline" onClick={() => inputRef.current?.click()} className="h-10 w-full" disabled={uploading || analisando}>
            <Camera className="h-4 w-4" /> Reenviar foto
          </Button>
        </>
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

function CampoVideo({
  casoId,
  resposta,
  update,
  mode,
}: {
  casoId: string;
  resposta: Resposta;
  update: (patch: Partial<Resposta>) => void;
  mode: RendererMode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async (file: File) => {
    setErro(null);
    if (!file.size) return setErro("O vídeo selecionado está vazio.");
    if (file.size > 100 * 1024 * 1024) return setErro("O vídeo deve ter no máximo 100 MB.");
    if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type)) {
      return setErro("Formato não aceito. Use MP4, WebM ou MOV.");
    }
    const preview = URL.createObjectURL(file);
    if (mode === "preview") {
      update({ filePath: "preview", fileName: file.name, filePreview: preview });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const path = `casos/${casoId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("agente-uploads")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      update({ filePath: path, fileName: file.name, filePreview: preview });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao enviar vídeo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void enviar(file);
        }}
      />
      {resposta.filePreview && (
        <video controls preload="metadata" src={resposta.filePreview} className="w-full rounded-md border border-border" />
      )}
      <Button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="h-12 w-full">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
        {resposta.filePath ? "Substituir vídeo" : "Gravar / anexar vídeo"}
      </Button>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}

function CampoAudio({
  casoId,
  token,
  resposta,
  update,
  mode,
}: {
  casoId: string;
  token: string;
  resposta: Resposta;
  update: (patch: Partial<Resposta>) => void;
  mode: RendererMode;
}) {
  const [modo, setModo] = useState<"gravar" | "texto">(resposta.transcription && !resposta.audioPath ? "texto" : "gravar");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transcreverFn = useServerFn(transcreverAudio);

  useEffect(() => {
    if (recording) timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recording]);

  const enviarBlob = async (blob: Blob, ext: string) => {
    if (mode === "preview") {
      update({ audioPath: "preview", transcription: "(modo preview — sem transcrição)", transcriptionConfirmed: true });
      return;
    }
    setUploading(true);
    setErr(null);
    try {
      const path = `casos/${casoId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("agente-uploads").upload(path, blob, { upsert: false });
      if (error) throw error;
      update({ audioPath: path, transcription: "", transcriptionConfirmed: false });
      setUploading(false);

      setTranscrevendo(true);
      const base64 = await fileToBase64(blob);
      try {
        const r = (await transcreverFn({
          data: { token, audioBase64: base64, mime: blob.type || `audio/${ext}` },
        })) as { transcricao: string };
        update({ transcription: r.transcricao });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Falha na transcrição. Você pode digitar manualmente.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao enviar áudio.");
    } finally {
      setUploading(false);
      setTranscrevendo(false);
    }
  };

  const start = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await enviarBlob(blob, "webm");
      };
      recorderRef.current = rec;
      setSeconds(0);
      rec.start();
      setRecording(true);
    } catch {
      setErr("Permissão de microfone negada ou indisponível.");
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setModo("gravar")}
          className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium ${
            modo === "gravar" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"
          }`}
        >
          <Mic className="mr-1 inline h-3.5 w-3.5" /> Gravar áudio
        </button>
        <button
          type="button"
          onClick={() => setModo("texto")}
          className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium ${
            modo === "texto" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"
          }`}
        >
          <Pencil className="mr-1 inline h-3.5 w-3.5" /> Prefiro digitar
        </button>
      </div>

      {modo === "gravar" ? (
        <>
          {!resposta.audioPath && !recording && (
            <Button onClick={start} className="h-12 w-full" disabled={uploading}>
              <Mic className="h-4 w-4" /> Iniciar gravação
            </Button>
          )}
          {recording && (
            <div className="rounded-md border-2 border-destructive/30 bg-destructive/5 p-4 text-center">
              <div className="mx-auto flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-destructive/20 text-destructive">
                <Mic className="h-6 w-6" />
              </div>
              <p className="mt-2 font-mono text-xl font-semibold">{mmss}</p>
              <p className="text-xs text-muted-foreground">Gravando…</p>
              <Button onClick={stop} variant="destructive" className="mt-3 h-10 w-full">
                <Square className="h-4 w-4" /> Parar
              </Button>
            </div>
          )}
          {resposta.audioPath && !recording && (
            <>
              {transcrevendo && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Transcrevendo com IA…
                </div>
              )}
              <Textarea
                rows={4}
                placeholder="Transcrição (edite se necessário)…"
                value={resposta.transcription ?? ""}
                onChange={(e) => update({ transcription: e.target.value, transcriptionConfirmed: false })}
              />
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!resposta.transcriptionConfirmed}
                  onChange={(e) => update({ transcriptionConfirmed: e.target.checked })}
                  className="mt-0.5 h-4 w-4"
                />
                <span>Confirmo que a transcrição está correta.</span>
              </label>
              <button
                onClick={() => update({ audioPath: undefined, transcription: "", transcriptionConfirmed: false })}
                className="text-xs font-medium text-primary hover:underline"
              >
                Regravar
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <Textarea
            rows={4}
            placeholder="Digite a descrição…"
            value={resposta.transcription ?? ""}
            onChange={(e) => update({ transcription: e.target.value, audioPath: undefined, transcriptionConfirmed: true })}
          />
        </>
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
