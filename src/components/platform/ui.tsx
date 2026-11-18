import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS } from "@/lib/platform/labels";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const TONE: Record<string, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  info: "bg-primary/10 text-primary border-transparent",
  success: "bg-success/15 text-success-foreground border-transparent dark:text-success",
  warning: "bg-warning/20 text-warning-foreground border-transparent dark:text-warning",
  danger: "bg-destructive/10 text-destructive border-transparent",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string | undefined;
}) {
  if (!status) return null;
  const s = STATUS[status] ?? { label: status, tone: "neutral" as const };
  return (
    <Badge className={cn("whitespace-nowrap font-medium", TONE[s.tone], className)}>
      {s.label}
    </Badge>
  );
}

export function Loading({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "danger" | "warning" | "success" | undefined;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-2 text-2xl font-semibold tabular-nums",
            tone === "danger" && "text-destructive",
            tone === "warning" && "text-warning-foreground dark:text-warning",
            tone === "success" && "text-success-foreground dark:text-success",
          )}
        >
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function Section({
  title,
  actions,
  children,
  className,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {actions}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            type="button"
            key={String(o.value)}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              on
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted",
            )}
            aria-pressed={on}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
  group,
}: {
  label: string;
  hint?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
  /** Use para conjuntos de botões (Chips): evita que clicar no título acione o primeiro botão. */
  group?: boolean;
}) {
  const body = (
    <>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </>
  );
  return group ? (
    <div role="group" aria-label={label} className={cn("block space-y-1.5", className)}>
      {body}
    </div>
  ) : (
    <label className={cn("block space-y-1.5", className)}>{body}</label>
  );
}

export function Forbidden() {
  return (
    <Empty title="Sem acesso a esta área">
      Seu perfil de acesso não inclui esta função. Fale com o administrador.
    </Empty>
  );
}
