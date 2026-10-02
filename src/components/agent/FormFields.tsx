import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Camera,
  CloudOff,
  Images,
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
import {
  MAX_SEGUNDOS_GRAVACAO,
  blobToBase64,
  blobToWav16k,
  useGravacaoVoz,
  useGravador,
} from "@/components/agent/use-gravacao-voz";
import {
  LIMITE_FOTO_BYTES,
  LIMITE_VIDEO_BYTES,
  caminhoPendente,
  criarLoteadorUrls,
  descartarArquivo,
  ehErroDeRede,
  enviarArquivo,
  prepararImagem,
  traduzirErroRede,
  useFilaUploads,
} from "@/lib/midia-upload";
import { fetchUFs, fetchMunicipios, type UF, type Municipio } from "@/lib/ibge";
import { detectarCampo, valorParaCampo, type CampoMapeado } from "@/lib/perguntas-mapeamento";
import { buscarPorCnpj, type BuscarPorCnpjResult } from "@/lib/cnpj-cache.functions";
import { urlsArquivosVistoria } from "@/lib/vistoria-agent.functions";

/**
 * Depois de recarregar a página o objectURL local some; buscamos uma URL
 * assinada a partir do caminho salvo para o agente continuar vendo a mídia.
 */
// Várias fotos na mesma tela viram uma única chamada de URLs assinadas.
const pedirUrl = criarLoteadorUrls<string>(async (chave, paths) => {
  const { buscar } = urlFetchers.get(chave)!;
  return buscar(paths);
});
const urlFetchers = new Map<string, { buscar: (paths: string[]) => Promise<Record<string, string>> }>();

function useUrlArquivo(
  filePath: string | undefined,
  filePreview: string | undefined,
  casoId: string,
  token: string,
  mode: RendererMode,
) {
  const [url, setUrl] = useState<string | null>(null);
  const gerarUrls = useServerFn(urlsArquivosVistoria);

  useEffect(() => {
    let ativo = true;
    if (filePreview || !filePath || filePath === "preview" || mode === "preview") {
      setUrl(null);
      return;
    }
    const ehUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(casoId);
    const chave = `${casoId}|${ehUuid ? "" : token}`;
    urlFetchers.set(chave, {
      buscar: (paths) =>
        gerarUrls({
          data: {
            paths,
            ...(ehUuid ? { casoId } : {}),
            ...(!ehUuid && token && token !== "app" ? { token } : {}),
          },
        }) as Promise<Record<string, string>>,
    });
    void pedirUrl(chave, filePath).then((u) => {
      if (ativo) setUrl(u);
    });
    return () => {
      ativo = false;
    };
  }, [filePath, filePreview, casoId, token, mode, gerarUrls]);

  return filePreview ?? url;
}


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
              className={`block min-h-12 w-full rounded-md border px-4 py-3 text-left text-base transition ${
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

      {pergunta.tipo === "multipla_escolha" && (
        <div className="space-y-2">
          {(pergunta.opcoes ?? []).map((o) => {
            const sel = (resposta.text ?? "")
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean);
            const marcado = sel.includes(o.texto);
            return (
              <label
                key={o.id}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-md border px-4 py-3 text-sm transition ${
                  marcado ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0"
                  checked={marcado}
                  onChange={() => {
                    const novo = marcado ? sel.filter((v) => v !== o.texto) : [...sel, o.texto];
                    update({ text: novo.join(", ") });
                  }}
                />
                <span>{o.texto}</span>
              </label>
            );
          })}
        </div>
      )}

      {pergunta.tipo === "checkbox" && (
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={resposta.text === "sim"}
            onChange={(e) => update({ text: e.target.checked ? "sim" : "" })}
            className="h-5 w-5 shrink-0"
          />
          <span>Confirmo</span>
        </label>
      )}



      {pergunta.tipo === "foto" && (
        <CampoFoto pergunta={pergunta} casoId={casoId} token={token} resposta={resposta} update={update} mode={mode} validarImagensIa={validarImagensIa} />
      )}

      {pergunta.tipo === "video" && (
        <CampoVideo casoId={casoId} token={token} resposta={resposta} update={update} mode={mode} />
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
            className="w-full rounded-md border border-border bg-background px-3 py-3 text-base"
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


function BarraProgresso({ pct, rotulo }: { pct: number; rotulo: string }) {
  return (
    <div className="space-y-1" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{rotulo}</span>
        {pct > 0 && <span className="tabular-nums">{pct}%</span>}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full bg-primary transition-all ${pct === 0 ? "w-1/3 animate-pulse" : ""}`}
          style={pct > 0 ? { width: `${pct}%` } : undefined}
        />
      </div>
    </div>
  );
}

function AvisoPendente({ texto }: { texto: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
      <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
      <span>{texto}</span>
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
  const [progresso, setProgresso] = useState(0);
  const [analisando, setAnalisando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const validarFn = useServerFn(validarFoto);
  const urlFoto = useUrlArquivo(resposta.filePath, resposta.filePreview, casoId, token, mode);
  const fila = useFilaUploads();
  const pendente = !!resposta.filePath && fila.pendentes.includes(resposta.filePath);

  const limparInputs = () => {
    if (cameraRef.current) cameraRef.current.value = "";
    if (galeriaRef.current) galeriaRef.current.value = "";
  };

  const enviar = async (file: File) => {
    setErr(null);
    if (!file.size) return setErr("A foto selecionada está vazia. Tente novamente.");
    if (file.size > LIMITE_FOTO_BYTES) return setErr("A foto deve ter no máximo 25 MB.");
    if (file.type && !file.type.startsWith("image/")) return setErr("Selecione um arquivo de imagem.");
    const previaAntiga = resposta.filePreview;
    if (mode === "preview") {
      const preview = URL.createObjectURL(file);
      update({ filePath: "preview", fileName: file.name, filePreview: preview, ia: undefined, iaConfirmada: true });
      limparInputs();
      return;
    }
    setUploading(true);
    setProgresso(0);
    try {
      const prep = await prepararImagem(file);
      const ext = prep.tipo === "image/jpeg" ? "jpg" : prep.nome.split(".").pop()?.toLowerCase() || "jpg";
      const path = `casos/${casoId}/${crypto.randomUUID()}.${ext}`;
      const caminhoAntigo = resposta.filePath;
      await enviarArquivo({ path, blob: prep.blob, contentType: prep.tipo, onProgress: setProgresso });
      const preview = URL.createObjectURL(prep.blob);
      if (previaAntiga?.startsWith("blob:")) URL.revokeObjectURL(previaAntiga);
      update({ filePath: path, fileName: prep.nome, filePreview: preview, ia: undefined, iaConfirmada: !validarImagensIa });
      void descartarArquivo(caminhoAntigo);
      setUploading(false);

      if (!validarImagensIa || caminhoPendente(path)) return;

      setAnalisando(true);
      try {
        const base64 = await fileToBase64(prep.blob);
        const ehUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(casoId);
        const ia = (await validarFn({
          data: {
            token,
            ...(ehUuid ? { casoId } : {}),
            perguntaId: pergunta.id,
            imagemBase64: base64,
            mime: prep.tipo || "image/jpeg",
          },
        })) as IaResultado;
        update({ ia, iaConfirmada: ia.status === "aprovada" });
      } catch (iaErr) {
        // Falha da IA não bloqueia o envio: marca como confirmada pelo usuário e exibe aviso.
        update({ iaConfirmada: true });
        setErr(traduzirErroRede(iaErr, "Falha ao analisar a foto.") + " A foto foi mantida e você pode avançar.");
      }
    } catch (e) {
      setErr(traduzirErroRede(e, "Erro ao processar a foto."));
    } finally {
      setUploading(false);
      setAnalisando(false);
      setProgresso(0);
      limparInputs();
    }
  };

  const aoEscolher = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void enviar(f);
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

  const ocupado = uploading || analisando;

  return (
    <div className="space-y-3">
      {/* Câmera (capture) e galeria (sem capture): prints e fotos já tiradas só entram pela galeria */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={aoEscolher} />
      <input ref={galeriaRef} type="file" accept="image/*" className="hidden" onChange={aoEscolher} />

      {resposta.filePath && (
        <>
          {urlFoto ? (
            <img src={urlFoto} alt="Foto enviada" className="max-h-80 w-full rounded-md border border-border bg-muted/30 object-contain" />
          ) : (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {pendente ? "Foto guardada no aparelho." : "Foto enviada e salva."}
            </div>
          )}
          {pendente && <AvisoPendente texto="Sem conexão: a foto será enviada automaticamente quando o sinal voltar. Você já pode continuar." />}
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
                <button onClick={() => update({ iaConfirmada: true })} className="mt-2 min-h-11 text-xs font-semibold underline">
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
        </>
      )}

      {uploading && <BarraProgresso pct={progresso} rotulo={progresso === 0 ? "Preparando foto…" : "Enviando foto…"} />}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" onClick={() => cameraRef.current?.click()} className="h-12" disabled={ocupado}>
          <Camera className="h-4 w-4" /> {resposta.filePath ? "Refazer" : "Tirar foto"}
        </Button>
        <Button type="button" variant="outline" onClick={() => galeriaRef.current?.click()} className="h-12" disabled={ocupado}>
          <Images className="h-4 w-4" /> Galeria
        </Button>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

const EXT_VIDEO = /\.(mp4|mov|m4v|webm|3gp|3gpp)$/i;

function tipoVideo(file: File): string {
  if (file.type.startsWith("video/")) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "mov") return "video/quicktime";
  if (ext === "webm") return "video/webm";
  if (ext === "3gp" || ext === "3gpp") return "video/3gpp";
  return "video/mp4";
}

function CampoVideo({
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
  const cameraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const urlVideo = useUrlArquivo(resposta.filePath, resposta.filePreview, casoId, token, mode);
  const [uploading, setUploading] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const fila = useFilaUploads();
  const pendente = !!resposta.filePath && fila.pendentes.includes(resposta.filePath);
  const progressoFila = pendente && fila.enviando === resposta.filePath ? fila.progresso : 0;

  const limpar = () => {
    if (cameraRef.current) cameraRef.current.value = "";
    if (galeriaRef.current) galeriaRef.current.value = "";
  };

  const enviar = async (file: File) => {
    setErro(null);
    if (!file.size) return setErro("O vídeo selecionado está vazio.");
    if (file.size > LIMITE_VIDEO_BYTES) {
      return setErro(
        `O vídeo tem ${(file.size / 1024 / 1024).toFixed(0)} MB e o limite é ${LIMITE_VIDEO_BYTES / 1024 / 1024} MB. Grave um trecho mais curto ou reduza a qualidade do vídeo nas configurações da câmera.`,
      );
    }
    if (!file.type.startsWith("video/") && !EXT_VIDEO.test(file.name)) {
      return setErro("Formato não aceito. Use MP4, MOV, WebM ou 3GP.");
    }
    const tipo = tipoVideo(file);
    const previaAntiga = resposta.filePreview;
    const preview = URL.createObjectURL(file);
    if (mode === "preview") {
      update({ filePath: "preview", fileName: file.name, filePreview: preview });
      limpar();
      return;
    }
    setUploading(true);
    setProgresso(0);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const path = `casos/${casoId}/${crypto.randomUUID()}.${ext}`;
      const caminhoAntigo = resposta.filePath;
      await enviarArquivo({ path, blob: file, contentType: tipo, onProgress: setProgresso });
      if (previaAntiga?.startsWith("blob:")) URL.revokeObjectURL(previaAntiga);
      update({ filePath: path, fileName: file.name, filePreview: preview });
      void descartarArquivo(caminhoAntigo);
    } catch (error) {
      URL.revokeObjectURL(preview);
      setErro(traduzirErroRede(error, "Erro ao enviar vídeo."));
    } finally {
      setUploading(false);
      setProgresso(0);
      limpar();
    }
  };

  const aoEscolher = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void enviar(f);
  };

  return (
    <div className="space-y-3">
      <input ref={cameraRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={aoEscolher} />
      <input ref={galeriaRef} type="file" accept="video/*" className="hidden" onChange={aoEscolher} />
      {urlVideo && (
        <video controls playsInline preload="metadata" src={urlVideo} className="w-full rounded-md border border-border" />
      )}
      {resposta.filePath && !urlVideo && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {pendente ? "Vídeo guardado no aparelho." : "Vídeo enviado e salvo."}
        </div>
      )}
      {pendente && (
        <>
          <AvisoPendente texto="Sem conexão: o vídeo será enviado automaticamente quando o sinal voltar. Mantenha o aplicativo aberto." />
          {fila.enviando === resposta.filePath && <BarraProgresso pct={progressoFila} rotulo="Enviando vídeo…" />}
        </>
      )}
      {uploading && <BarraProgresso pct={progresso} rotulo="Enviando vídeo… não feche a tela" />}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" onClick={() => cameraRef.current?.click()} disabled={uploading} className="h-12">
          <Video className="h-4 w-4" /> {resposta.filePath ? "Regravar" : "Gravar vídeo"}
        </Button>
        <Button type="button" variant="outline" onClick={() => galeriaRef.current?.click()} disabled={uploading} className="h-12">
          <Images className="h-4 w-4" /> Galeria
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Limite de {LIMITE_VIDEO_BYTES / 1024 / 1024} MB por vídeo.</p>
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
  const [uploading, setUploading] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const transcreverFn = useServerFn(transcreverAudio);
  const fila = useFilaUploads();
  const pendente = !!resposta.audioPath && fila.pendentes.includes(resposta.audioPath);

  const processar = async (blob: Blob, info: { mime: string; ext: string }) => {
    if (mode === "preview") {
      update({ audioPath: "preview", transcription: "(modo preview — sem transcrição)", transcriptionConfirmed: true });
      return;
    }
    setUploading(true);
    setErr(null);
    try {
      const path = `casos/${casoId}/${crypto.randomUUID()}.${info.ext}`;
      await enviarArquivo({ path, blob, contentType: info.mime.split(";")[0] || "audio/webm" });
      update({ audioPath: path, transcription: "", transcriptionConfirmed: false });
    } catch (e) {
      setErr(traduzirErroRede(e, "Erro ao enviar áudio."));
      setUploading(false);
      return;
    }
    setUploading(false);

    setTranscrevendo(true);
    try {
      // Converte para WAV 16 kHz: funciona igual no Safari (mp4) e no Chrome (webm) e é bem menor.
      const wav = await blobToWav16k(blob);
      const base64 = await blobToBase64(wav);
      const r = (await transcreverFn({ data: { token, audioBase64: base64, mime: "audio/wav" } })) as { transcricao: string };
      update({ transcription: r.transcricao });
    } catch (e) {
      setErr(
        ehErroDeRede(e)
          ? "Sem conexão para transcrever. O áudio ficou guardado; digite a descrição abaixo."
          : traduzirErroRede(e, "Falha na transcrição. Você pode digitar manualmente."),
      );
    } finally {
      setTranscrevendo(false);
    }
  };

  const gravador = useGravador({ onGravado: processar });
  const { recording, mmss, start, stop } = gravador;
  const restante = MAX_SEGUNDOS_GRAVACAO - gravador.seconds;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setModo("gravar")}
          className={`min-h-11 flex-1 rounded-md border px-3 py-2 text-xs font-medium ${
            modo === "gravar" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"
          }`}
        >
          <Mic className="mr-1 inline h-3.5 w-3.5" /> Gravar áudio
        </button>
        <button
          type="button"
          onClick={() => setModo("texto")}
          className={`min-h-11 flex-1 rounded-md border px-3 py-2 text-xs font-medium ${
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
          {uploading && <BarraProgresso pct={0} rotulo="Salvando áudio…" />}
          {recording && (
            <div className="rounded-md border-2 border-destructive/30 bg-destructive/5 p-4 text-center">
              <div className="mx-auto flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-destructive/20 text-destructive">
                <Mic className="h-6 w-6" />
              </div>
              <p className="mt-2 font-mono text-xl font-semibold">{mmss}</p>
              <p className="text-xs text-muted-foreground">
                Gravando… {restante <= 30 ? `encerra em ${restante}s` : "máx. 5 min"}
              </p>
              <Button onClick={stop} variant="destructive" className="mt-3 h-12 w-full">
                <Square className="h-4 w-4" /> Parar
              </Button>
            </div>
          )}
          {resposta.audioPath && !recording && (
            <>
              {pendente && <AvisoPendente texto="Sem conexão: o áudio será enviado automaticamente quando o sinal voltar." />}
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
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={!!resposta.transcriptionConfirmed}
                  onChange={(e) => update({ transcriptionConfirmed: e.target.checked })}
                  className="h-5 w-5 shrink-0"
                />
                <span>Confirmo que a transcrição está correta.</span>
              </label>
              <button
                onClick={() => update({ audioPath: undefined, transcription: "", transcriptionConfirmed: false })}
                className="min-h-11 text-xs font-medium text-primary hover:underline"
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
      {(err || gravador.erro) && <p className="text-xs text-destructive">{err || gravador.erro}</p>}
    </div>
  );
}
