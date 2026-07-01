import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------- Button --------------------------------- */
type ButtonVariant = "primary" | "ghost" | "forest" | "danger";
type ButtonSize = "sm" | "md";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[4px] font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
  const sizes: Record<ButtonSize, string> = {
    sm: "text-[14px] px-3 py-1.5",
    md: "text-[16px] px-5 py-2.5",
  };
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-chartreuse-lime text-ink-black hover:bg-forest-mid hover:text-paper-white",
    ghost: "bg-transparent border border-ink-black text-deep-forest hover:bg-pale-sage",
    forest: "bg-deep-forest text-paper-white hover:bg-forest-mid",
    danger: "bg-transparent border border-red-700 text-red-700 hover:bg-red-50",
  };
  return <button className={cn(base, sizes[size], variants[variant], className)} {...props} />;
}

/* -------------------------------- Card ---------------------------------- */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-[16px] bg-paper-white border border-black/10 p-6", className)}>
      {children}
    </div>
  );
}

export function SageCard({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-[16px] bg-pale-sage p-6", className)}>{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[16px] p-6",
        accent ? "bg-chartreuse-lime text-ink-black" : "bg-deep-forest text-paper-white",
      )}
    >
      <div
        className={cn(
          "eyebrow",
          accent ? "text-ink-black/70" : "text-chartreuse-lime",
        )}
      >
        {label}
      </div>
      <div className="font-display mt-2 text-[36px] leading-none">{value}</div>
      {hint ? <div className="mt-2 text-[14px] opacity-80">{hint}</div> : null}
    </div>
  );
}

/* ------------------------------- Inputs --------------------------------- */
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-[4px] border border-black/30 bg-paper-white px-3 py-2 text-[16px] text-deep-forest outline-none focus:border-deep-forest",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-[4px] border border-black/30 bg-paper-white px-3 py-2 text-[16px] text-deep-forest outline-none focus:border-deep-forest",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <label className={cn("block text-[14px] font-medium text-deep-forest mb-1", className)}>{children}</label>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/* ------------------------------- Badge ---------------------------------- */
const STATUS_COLORS: Record<string, string> = {
  Ingresado: "bg-pale-sage text-deep-forest",
  "En Reparación": "bg-chartreuse-lime text-ink-black",
  Listo: "bg-vivid-green/30 text-deep-forest",
  Entregado: "bg-deep-forest text-paper-white",
  Suspendido: "bg-charcoal text-paper-white",
  Ingreso: "bg-vivid-green/30 text-deep-forest",
  Egreso: "bg-red-100 text-red-800",
  pending: "bg-pale-sage text-deep-forest",
  processed: "bg-vivid-green/30 text-deep-forest",
  linked: "bg-deep-forest text-paper-white",
  error: "bg-red-100 text-red-800",
};

export function Badge({ children, tone }: { children: string; tone?: string }) {
  const cls = STATUS_COLORS[tone ?? children] ?? "bg-pale-sage text-deep-forest";
  return (
    <span className={cn("inline-block rounded-[4px] px-2.5 py-0.5 text-[12px] font-medium", cls)}>
      {children}
    </span>
  );
}

/* ------------------------------- Table ---------------------------------- */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[16px] bg-paper-white border border-black/10">
      <table className="w-full text-left text-[14px]">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cn("eyebrow px-4 py-3 border-b border-black/10 text-deep-forest", className)}>
      {children}
    </th>
  );
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 border-b border-black/5 align-middle", className)}>{children}</td>;
}

/* ----------------------------- Misc bits -------------------------------- */
export function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-deep-forest border-t-transparent" />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[4px] bg-deep-forest/10",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.4s_infinite] after:bg-gradient-to-r after:from-transparent after:via-white/40 after:to-transparent",
        className,
      )}
    />
  );
}

/** Loading placeholder that mimics a list of cards (mobile) / rows (desktop). */
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-[16px] bg-paper-white border border-black/10 p-4">
          <Skeleton className="h-4 w-1/3 mb-2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** Filled chartreuse pill icon-button, comfortable tap target. */
export function IconButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "grid h-10 w-10 place-items-center rounded-[4px] text-deep-forest hover:bg-pale-sage active:scale-95 transition",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Accessible on/off switch. Comfortable 44px-tall tap target on touch. */
export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-vivid-green" : "bg-black/20",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-paper-white shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-[16px] bg-pale-sage p-10 text-center">
      <p className="font-display text-[22px] text-deep-forest">{title}</p>
      {hint ? <p className="mt-2 text-[14px] text-charcoal">{hint}</p> : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-8">
      <div>
        {eyebrow ? <div className="eyebrow mb-2">{eyebrow}</div> : null}
        <h1 className="font-display text-[36px] md:text-[56px] text-deep-forest leading-none">
          {title}
        </h1>
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}
