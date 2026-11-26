import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, CaseUpper, Italic, Underline } from "lucide-react";
import {
  ALINHAMENTOS,
  aplicarMarcaNoTexto,
  classeAlinhamento,
  parseTexto,
  type Alinhamento,
  type Marca,
} from "@/lib/laudo/texto-formatado";

/** Texto com as marcas interpretadas (negrito, itálico, sublinhado) e pendências [CONFIRMAR] em destaque. */
export function TextoFormatado({
  texto,
  rico,
  caixaAlta,
  className,
}: {
  texto: string;
  rico?: boolean;
  caixaAlta?: boolean;
  className?: string;
}) {
  const trechos = rico ? parseTexto(texto) : [{ texto }];
  return (
    <span className={className} style={caixaAlta ? { textTransform: "uppercase" } : undefined}>
      {trechos.map((t, i) => {
        const estilo = `${(t as { negrito?: boolean }).negrito ? "font-bold " : ""}${(t as { italico?: boolean }).italico ? "italic " : ""}${(t as { sublinhado?: boolean }).sublinhado ? "underline " : ""}`.trim();
        return (
          <span key={i} className={estilo || undefined}>
            {t.texto.split(/(\[CONFIRMAR:[^\]]*\])/g).map((p, k) =>
              p.startsWith("[CONFIRMAR:") ? (
                <span key={k} className="rounded bg-amber-100 px-1 font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                  {p}
                </span>
              ) : (
                <span key={k}>{p}</span>
              ),
            )}
          </span>
        );
      })}
    </span>
  );
}

const BOTAO = "flex h-8 w-8 items-center justify-center rounded border text-muted-foreground transition hover:bg-muted disabled:opacity-40";
const ATIVO = "border-primary bg-primary/10 text-primary";
const ICONE_ALINHAMENTO: Record<Alinhamento, typeof AlignLeft> = { esquerda: AlignLeft, centro: AlignCenter, direita: AlignRight, justificado: AlignJustify };

/** Barra: negrito, itálico, sublinhado, caixa alta e alinhamento. Os botões não tiram o foco do campo. */
export function BarraFormatacao({
  onMarca,
  alinhamento,
  onAlinhar,
  caixaAlta,
  onCaixaAlta,
  comAlinhamento = true,
  comCaixaAlta = true,
}: {
  onMarca: (m: Marca) => void;
  alinhamento?: Alinhamento;
  onAlinhar?: (a: Alinhamento) => void;
  caixaAlta?: boolean;
  onCaixaAlta?: () => void;
  comAlinhamento?: boolean;
  comCaixaAlta?: boolean;
}) {
  const sem = (e: React.MouseEvent) => e.preventDefault();
  const atual = alinhamento ?? "justificado";
  return (
    <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Formatação do texto">
      <button type="button" className={`${BOTAO} border-border`} title="Negrito (selecione o trecho)" aria-label="Negrito" onMouseDown={sem} onClick={() => onMarca("negrito")}>
        <Bold className="h-4 w-4" />
      </button>
      <button type="button" className={`${BOTAO} border-border`} title="Itálico (selecione o trecho)" aria-label="Itálico" onMouseDown={sem} onClick={() => onMarca("italico")}>
        <Italic className="h-4 w-4" />
      </button>
      <button type="button" className={`${BOTAO} border-border`} title="Sublinhado (selecione o trecho)" aria-label="Sublinhado" onMouseDown={sem} onClick={() => onMarca("sublinhado")}>
        <Underline className="h-4 w-4" />
      </button>
      {comCaixaAlta && (
        <button
          type="button"
          className={`${BOTAO} ${caixaAlta ? ATIVO : "border-border"}`}
          title="Caixa alta (o parágrafo todo)"
          aria-label="Caixa alta"
          aria-pressed={!!caixaAlta}
          onMouseDown={sem}
          onClick={() => onCaixaAlta?.()}
        >
          <CaseUpper className="h-4 w-4" />
        </button>
      )}
      {comAlinhamento && onAlinhar && (
        <span className="ml-1 flex items-center gap-1 border-l border-border pl-2">
          {ALINHAMENTOS.map((a) => {
            const Icone = ICONE_ALINHAMENTO[a.valor];
            return (
              <button
                key={a.valor}
                type="button"
                className={`${BOTAO} ${atual === a.valor ? ATIVO : "border-border"}`}
                title={a.rotulo}
                aria-label={a.rotulo}
                aria-pressed={atual === a.valor}
                onMouseDown={sem}
                onClick={() => onAlinhar(a.valor)}
              >
                <Icone className="h-4 w-4" />
              </button>
            );
          })}
        </span>
      )}
    </div>
  );
}

export type EstadoTexto = { texto: string; rico?: boolean; alinhamento?: Alinhamento; caixaAlta?: boolean };

/**
 * Campo de texto com a barra de formatação. `modo="caixa"` (Configurações): sempre mostra o campo, a barra e uma prévia
 * formatada. `modo="folha"` (documento): mostra o texto formatado e só abre o campo (com a barra) ao clicar.
 */
export function CampoFormatavel({
  valor,
  onChange,
  modo = "caixa",
  comAlinhamento = true,
  comCaixaAlta = true,
  placeholder,
  className,
  registrarInserir,
}: {
  valor: EstadoTexto;
  onChange: (v: EstadoTexto) => void;
  modo?: "caixa" | "folha";
  comAlinhamento?: boolean;
  comCaixaAlta?: boolean;
  placeholder?: string;
  className?: string;
  /** recebe a função que insere texto na posição do cursor (botões de campos `{{…}}`) quando este campo ganha o foco */
  registrarInserir?: (inserir: (texto: string) => void) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const caixa = useRef<HTMLDivElement | null>(null);
  const [aberto, setAberto] = useState(modo === "caixa");
  const selecaoPendente = useRef<{ ini: number; fim: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
    if (selecaoPendente.current) {
      const { ini, fim } = selecaoPendente.current;
      selecaoPendente.current = null;
      el.focus();
      el.setSelectionRange(ini, fim);
    }
  }, [valor.texto, aberto]);

  const aplicarMarca = (marca: Marca) => {
    const el = ref.current;
    const ini = el?.selectionStart ?? valor.texto.length;
    const fim = el?.selectionEnd ?? valor.texto.length;
    const r = aplicarMarcaNoTexto(valor.texto, !!valor.rico, ini, fim, marca);
    selecaoPendente.current = { ini: r.ini, fim: r.fim };
    onChange({ ...valor, texto: r.texto, rico: true });
  };

  const inserir = (t: string) => {
    const el = ref.current;
    const ini = el?.selectionStart ?? valor.texto.length;
    const fim = el?.selectionEnd ?? ini;
    // texto não rico mantém "*" e "+" como estão; rico precisa escapá-los (só campos {{…}} são inseridos aqui)
    selecaoPendente.current = { ini: ini + t.length, fim: ini + t.length };
    onChange({ ...valor, texto: valor.texto.slice(0, ini) + t + valor.texto.slice(fim) });
  };

  if (modo === "folha" && !aberto) {
    return (
      <span
        role="textbox"
        tabIndex={0}
        aria-label="Editar parágrafo"
        className={`block min-h-[1.5em] cursor-text rounded-sm hover:bg-[#1F3864]/5 ${classeAlinhamento(valor.alinhamento)} ${className ?? ""}`}
        onClick={() => setAberto(true)}
        onFocus={() => setAberto(true)}
      >
        {valor.texto ? <TextoFormatado texto={valor.texto} rico={valor.rico} caixaAlta={valor.caixaAlta} /> : <span className="text-muted-foreground">{placeholder}</span>}
      </span>
    );
  }

  return (
    <div
      ref={caixa}
      className={modo === "caixa" ? "space-y-1.5" : "relative"}
      onBlur={(e) => {
        // a folha volta a mostrar o texto formatado quando o foco sai do campo e da barra
        if (modo === "folha" && !caixa.current?.contains(e.relatedTarget as Node | null)) setAberto(false);
      }}
    >
      <div className={modo === "folha" ? "mb-1 rounded-md border border-border bg-background p-1 shadow-sm indent-0 text-left not-italic no-underline" : ""}>
        <BarraFormatacao
          onMarca={aplicarMarca}
          alinhamento={valor.alinhamento}
          onAlinhar={(a) => onChange({ ...valor, alinhamento: a === "justificado" ? undefined : a })}
          caixaAlta={valor.caixaAlta}
          onCaixaAlta={() => onChange({ ...valor, caixaAlta: valor.caixaAlta ? undefined : true })}
          comAlinhamento={comAlinhamento}
          comCaixaAlta={comCaixaAlta}
        />
      </div>
      <textarea
        ref={ref}
        rows={modo === "caixa" ? 2 : 1}
        value={valor.texto}
        autoFocus={modo === "folha"}
        placeholder={placeholder}
        onFocus={() => registrarInserir?.(inserir)}
        onChange={(e) => onChange({ ...valor, texto: e.target.value })}
        className={`w-full resize-none overflow-hidden rounded-sm border border-border bg-background px-2 py-1.5 font-[inherit] text-[length:inherit] leading-[inherit] text-[inherit] outline-none focus:border-[#1F3864]/40 ${modo === "folha" ? "indent-0 text-left" : "text-sm"} ${className ?? ""}`}
      />
      {modo === "caixa" && valor.texto.trim() && (
        <p className={`rounded-md bg-muted/40 px-3 py-2 text-xs leading-relaxed ${classeAlinhamento(valor.alinhamento)}`} aria-label="Prévia">
          <TextoFormatado texto={valor.texto} rico={valor.rico} caixaAlta={valor.caixaAlta} />
        </p>
      )}
    </div>
  );
}

export const estiloAlinhamento = (a?: Alinhamento): CSSProperties | undefined => (a ? { textAlign: a === "centro" ? "center" : a === "direita" ? "right" : a === "esquerda" ? "left" : "justify" } : undefined);
