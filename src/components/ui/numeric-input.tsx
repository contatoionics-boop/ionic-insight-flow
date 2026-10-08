import * as React from "react";
import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { box: string; button: string; input: string; icon: string }> = {
  sm: { box: "h-8", button: "w-8", input: "text-sm", icon: "h-3.5 w-3.5" },
  md: { box: "h-10", button: "w-10", input: "text-base md:text-sm", icon: "h-4 w-4" },
  // alvo de toque confortável (celular/tablet em campo)
  lg: { box: "h-12", button: "w-12", input: "text-base", icon: "h-5 w-5" },
};

export interface NumericInputProps {
  /** Valor atual como texto (aceita vazio). Também aceita número. */
  value: string | number;
  /** Chamado com o texto digitado ou o resultado dos botões − / +. */
  onValueChange: (value: string) => void;
  min?: number;
  max?: number;
  /** Incremento dos botões − / + (o campo em si aceita qualquer valor). */
  step?: number;
  size?: Size;
  /** Mostra a barra de progresso e os limites (exige min e max). */
  showRange?: boolean;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  name?: string;
  className?: string;
  inputClassName?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  "aria-label"?: string;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
}

function casasDecimais(n: number) {
  const s = String(n);
  const i = s.indexOf(".");
  return i < 0 ? 0 : s.length - i - 1;
}

/**
 * Campo numérico com botões − / +. Digitação livre (inclusive vazio) e limites
 * aplicados ao sair do campo e nos botões. Usa os tokens de cor do tema.
 */
const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  (
    {
      value,
      onValueChange,
      min,
      max,
      step = 1,
      size = "md",
      showRange = false,
      disabled,
      placeholder,
      id,
      name,
      className,
      inputClassName,
      inputMode = "decimal",
      "aria-label": ariaLabel,
      onBlur,
    },
    ref,
  ) => {
    const s = SIZES[size];
    const texto = value === null || value === undefined ? "" : String(value);
    const atual = texto.trim() === "" ? null : Number(texto.replace(",", "."));
    const valido = atual !== null && !Number.isNaN(atual);

    const limitar = (n: number) => {
      let r = n;
      if (min !== undefined) r = Math.max(min, r);
      if (max !== undefined) r = Math.min(max, r);
      return r;
    };
    const casas = Math.max(casasDecimais(step), valido ? casasDecimais(atual as number) : 0);
    const emitir = (n: number) => onValueChange(String(Number(limitar(n).toFixed(casas))));

    const base = valido ? (atual as number) : min !== undefined && min > 0 ? min - step : 0;
    const noMinimo = valido && min !== undefined && (atual as number) <= min;
    const noMaximo = valido && max !== undefined && (atual as number) >= max;

    const percentual =
      showRange && min !== undefined && max !== undefined && max > min && valido
        ? Math.min(100, Math.max(0, (((atual as number) - min) / (max - min)) * 100))
        : 0;

    const botao = cn(
      "flex shrink-0 items-center justify-center text-muted-foreground transition-colors",
      "hover:bg-muted hover:text-foreground active:bg-muted/80 disabled:pointer-events-none disabled:opacity-40",
      s.button,
    );

    return (
      <div className={cn("w-full", className)}>
        <div
          className={cn(
            "flex items-stretch overflow-hidden rounded-md border border-input bg-card shadow-sm transition-[box-shadow,border-color]",
            "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
            disabled && "cursor-not-allowed opacity-50",
            s.box,
          )}
        >
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled || noMinimo}
            onClick={() => emitir(base - step)}
            className={cn(botao, "border-r border-input")}
            aria-label="Diminuir"
          >
            <Minus className={s.icon} />
          </button>
          <input
            ref={ref}
            id={id}
            name={name}
            type="number"
            inputMode={inputMode}
            step="any"
            min={min}
            max={max}
            value={texto}
            disabled={disabled}
            placeholder={placeholder}
            aria-label={ariaLabel}
            onChange={(e) => onValueChange(e.target.value)}
            onBlur={(e) => {
              // Ao sair do campo, traz o valor para dentro dos limites.
              if (valido && limitar(atual as number) !== atual) emitir(atual as number);
              onBlur?.(e);
            }}
            className={cn(
              "min-w-0 flex-1 border-none bg-transparent px-2 text-center text-foreground placeholder:text-muted-foreground focus:outline-none",
              "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
              s.input,
              inputClassName,
            )}
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled || noMaximo}
            onClick={() => emitir(base + step)}
            className={cn(botao, "border-l border-input")}
            aria-label="Aumentar"
          >
            <Plus className={s.icon} />
          </button>
        </div>

        {showRange && min !== undefined && max !== undefined && (
          <>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary/70 transition-all duration-200"
                style={{ width: `${percentual}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>{min}</span>
              <span>{max}</span>
            </div>
          </>
        )}
      </div>
    );
  },
);
NumericInput.displayName = "NumericInput";

export { NumericInput };
