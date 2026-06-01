import { useEffect, type ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-card p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "success" | "destructive" | "outline";
  size?: "sm" | "md";
}) {
  const variants: Record<string, string> = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "text-foreground hover:bg-muted",
    success: "bg-success text-success-foreground hover:bg-success/90",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    outline: "border border-border bg-card text-foreground hover:bg-muted",
  };
  const sizes: Record<string, string> = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`flex min-h-[80px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20 ${props.className ?? ""}`}
    />
  );
}

export function Label({
  children,
  htmlFor,
  required,
  hint,
}: {
  children: ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-medium text-foreground">
      <span>
        {children}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      {hint && <span className="text-[11px] font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children }: { children: ReactNode }) {
  return (
    <th className="border-b border-border bg-muted/50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`border-b border-border px-4 py-3 text-foreground ${className}`}>{children}</td>;
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-md border border-border bg-card px-4 py-3 text-sm transition-colors hover:bg-muted"
    >
      <span className="font-medium text-foreground">{label}</span>
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
