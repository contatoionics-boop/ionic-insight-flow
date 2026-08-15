// Resumo editável do ESCOPO PRELIMINAR lido da proposta comercial.
// Aparece no agendamento (antes de salvar) e na tela de revisão.

import { Badge, Input } from "@/components/ui-bits";
import { campoManual, tipoDoCampo } from "@/lib/proposta/campos";
import {
  CHAVES_RESUMO,
  ROTULOS_ESCOPO,
  formatarValorEscopo,
  resumoEscopo,
  type EscopoProposta,
} from "@/lib/proposta/tipos";

function textoDoCampo(escopo: EscopoProposta, chave: keyof EscopoProposta): string {
  const valor = escopo[chave]?.valor ?? null;
  if (valor === null || valor === undefined || valor === "") return "";
  return formatarValorEscopo(chave, valor);
}

export function EscopoIdentificado({
  escopo,
  onChange,
  titulo = "Escopo identificado",
  descricao = "Lido da proposta comercial (previsto). Corrija o que estiver errado antes de salvar — a correção manual tem prioridade.",
}: {
  escopo: EscopoProposta;
  onChange?: (escopo: EscopoProposta) => void;
  titulo?: string;
  descricao?: string;
}) {
  const editavel = typeof onChange === "function";

  const alterar = (chave: keyof EscopoProposta, texto: string) => {
    if (!onChange) return;
    onChange({ ...escopo, [chave]: campoManual(chave, texto) } as EscopoProposta);
  };

  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold">{titulo}</h4>
        <Badge className="border-primary/30 bg-primary/10 text-primary">{resumoEscopo(escopo)}</Badge>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{descricao}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CHAVES_RESUMO.map((chave) => {
          const campo = escopo[chave];
          const texto = textoDoCampo(escopo, chave);
          const identificado = texto !== "";
          const manual = campo?.origem === "manual";
          return (
            <div key={chave}>
              <label className="mb-1 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                {ROTULOS_ESCOPO[chave]}
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    manual
                      ? "bg-primary/10 text-primary"
                      : identificado
                        ? "bg-emerald-500/10 text-emerald-700"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {manual ? "confirmado" : identificado ? "previsto na proposta" : "não identificado"}
                </span>
              </label>
              {editavel ? (
                <Input
                  value={texto}
                  placeholder={
                    tipoDoCampo(chave) === "booleano" ? "sim / não" : "não identificado"
                  }
                  onChange={(e) => alterar(chave, e.target.value)}
                />
              ) : (
                <p className="text-sm">{texto || "não identificado"}</p>
              )}
              {campo?.trecho && campo.trecho !== "ajuste manual" ? (
                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">“{campo.trecho}”</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
