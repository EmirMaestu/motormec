import { useMemo, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import {
  cn,
  computeBreakdown,
  formatCurrency,
  isTaxPreset,
  pesosToCents,
  TAX_OTHER,
  TAX_PRESETS,
} from "@/lib/utils";
import { digitsOnly, normalizePlate, sanitizeMoney } from "@/lib/validation";
import { modelsForBrand, VEHICLE_BRANDS } from "@/lib/vehicleCatalog";
import { Input, Label } from "./ui";

/* ----------------------------- Field wrapper ---------------------------- */
export function FormField({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label>
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="mt-1 text-[12px] text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[12px] text-charcoal">{hint}</p>
      ) : null}
    </div>
  );
}

/* ----------------------------- Native select ---------------------------- */
export function Select({
  value,
  onChange,
  children,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full appearance-none rounded-[4px] border border-black/30 bg-paper-white px-3 py-2.5 pr-9 text-[16px] text-deep-forest outline-none focus:border-deep-forest",
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-charcoal" />
    </div>
  );
}

/* --------------------------- Specialized inputs ------------------------- */
export function PlateInput({
  value,
  onChange,
  ...props
}: { value: string; onChange: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(normalizePlate(e.target.value))}
      placeholder="AB123CD"
      autoCapitalize="characters"
      maxLength={8}
      {...props}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(digitsOnly(e.target.value))}
      inputMode="numeric"
      placeholder={placeholder}
    />
  );
}

export function MoneyInput({
  value,
  onChange,
  placeholder = "0",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal">$</span>
      <Input
        value={value}
        onChange={(e) => onChange(sanitizeMoney(e.target.value))}
        inputMode="decimal"
        placeholder={placeholder}
        className="pl-7"
      />
    </div>
  );
}

export function DateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />;
}

/* -------------------- ComboSelect (options + custom) -------------------- */
const OTHER = "__other__";

export function ComboSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccionar…",
  otherLabel = "Otra…",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  otherLabel?: string;
  disabled?: boolean;
}) {
  const inList = value === "" || options.includes(value);
  const [custom, setCustom] = useState(!inList && value !== "");

  if (custom) {
    return (
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Escribir…" autoFocus />
        <button
          type="button"
          onClick={() => {
            setCustom(false);
            onChange("");
          }}
          className="rounded-[4px] border border-black/30 px-3 text-charcoal hover:bg-pale-sage"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <Select
      value={inList ? value : ""}
      onChange={(v) => {
        if (v === OTHER) {
          setCustom(true);
          onChange("");
        } else onChange(v);
      }}
      className={disabled ? "opacity-50 pointer-events-none" : undefined}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      <option value={OTHER}>{otherLabel}</option>
    </Select>
  );
}

/* ----------------------- Dependent brand → model ------------------------ */
export function BrandModelSelect({
  brand,
  model,
  onBrand,
  onModel,
}: {
  brand: string;
  model: string;
  onBrand: (v: string) => void;
  onModel: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <FormField label="Marca" required>
        <ComboSelect
          value={brand}
          onChange={(b) => {
            onBrand(b);
            onModel(""); // reset model when brand changes
          }}
          options={VEHICLE_BRANDS}
          placeholder="Marca"
          otherLabel="Otra marca…"
        />
      </FormField>
      <FormField label="Modelo">
        <ComboSelect
          value={model}
          onChange={onModel}
          options={modelsForBrand(brand)}
          placeholder={brand ? "Modelo" : "Elegí marca"}
          otherLabel="Otro modelo…"
          disabled={!brand}
        />
      </FormField>
    </div>
  );
}

/* ------------------------ Creatable multi-select ------------------------ */
export function CreatableMultiSelect({
  value,
  onChange,
  options,
  onCreate,
  placeholder = "Buscar o crear…",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: string[];
  onCreate?: (label: string) => void | Promise<void>;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const available = useMemo(
    () => options.filter((o) => !value.includes(o)),
    [options, value],
  );
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return q ? available.filter((o) => o.toLowerCase().includes(q)) : available;
  }, [available, query]);

  const exact = options.some((o) => o.toLowerCase() === query.toLowerCase().trim());
  const canCreate = query.trim().length >= 2 && !exact;

  const add = (label: string) => {
    if (!value.includes(label)) onChange([...value, label]);
    setQuery("");
  };
  const create = async () => {
    const label = query.trim();
    if (!label) return;
    await onCreate?.(label);
    add(label);
  };

  return (
    <div className="relative">
      <div className="rounded-[4px] border border-black/30 bg-paper-white px-2 py-2 focus-within:border-deep-forest">
        {value.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {value.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1 rounded-full bg-chartreuse-lime px-2.5 py-1 text-[13px] text-ink-black"
              >
                {v}
                <button type="button" onClick={() => onChange(value.filter((x) => x !== v))}>
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (filtered.length === 1) add(filtered[0]!);
              else if (canCreate) void create();
            }
          }}
          placeholder={placeholder}
          className="w-full bg-transparent px-1 text-[16px] text-deep-forest outline-none"
        />
      </div>

      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-[4px] border border-black/15 bg-paper-white py-1 shadow-[0_8px_30px_rgba(4,63,46,0.12)]">
            {filtered.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => add(o)}
                className="flex w-full items-center justify-between px-3 py-2 text-[15px] text-deep-forest hover:bg-pale-sage"
              >
                {o}
                <Check size={14} className="opacity-0" />
              </button>
            ))}
            {canCreate ? (
              <button
                type="button"
                onClick={() => void create()}
                className="flex w-full items-center gap-2 px-3 py-2 text-[15px] text-deep-forest hover:bg-pale-sage"
              >
                <Plus size={15} /> Crear “{query.trim()}”
              </button>
            ) : null}
            {filtered.length === 0 && !canCreate ? (
              <div className="px-3 py-2 text-[14px] text-charcoal">Sin opciones</div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ----------------------- IVA + descuento + desglose --------------------- */
/**
 * Selector de IVA flexible (presets + "Otra…"), descuento global y desglose en vivo.
 * El padre es dueño del estado: `taxRate` en basis points (2100 = 21%) y
 * `discount` en PESOS (string, vía MoneyInput). `subtotal` en PESOS.
 */
export function TaxDiscountSection({
  subtotal,
  discount,
  onDiscount,
  taxRate,
  onTaxRate,
  totalLabel = "Total",
}: {
  subtotal: number;
  discount: string;
  onDiscount: (v: string) => void;
  taxRate: number;
  onTaxRate: (bps: number) => void;
  totalLabel?: string;
}) {
  // "Otra…" si el taxRate actual no matchea un preset (incluye 0 sólo si venía como preset).
  const [other, setOther] = useState(() => taxRate > 0 && !isTaxPreset(taxRate));
  const selectorValue = other ? TAX_OTHER : String(taxRate);
  const otherPct = taxRate > 0 ? String(taxRate / 100) : "";

  const b = computeBreakdown(subtotal, Number(discount) || 0, taxRate);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="IVA">
          <Select
            value={selectorValue}
            onChange={(v) => {
              if (v === TAX_OTHER) {
                setOther(true);
                onTaxRate(0);
              } else {
                setOther(false);
                onTaxRate(Number(v) || 0);
              }
            }}
          >
            {TAX_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
            <option value={TAX_OTHER}>Otra…</option>
          </Select>
        </FormField>
        <FormField label="Descuento" hint="Global, en pesos">
          <MoneyInput value={discount} onChange={onDiscount} />
        </FormField>
      </div>

      {other ? (
        <FormField label="IVA %" hint="Porcentaje libre (ej. 8)">
          <div className="relative">
            <Input
              value={otherPct}
              onChange={(e) => {
                const pct = Number(sanitizeMoney(e.target.value)) || 0;
                onTaxRate(Math.round(pct * 100));
              }}
              inputMode="decimal"
              placeholder="0"
              className="pr-7"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal">%</span>
          </div>
        </FormField>
      ) : null}

      <div className="rounded-[4px] bg-deep-forest text-paper-white px-4 py-3 space-y-1.5">
        <div className="flex items-center justify-between text-[13px] text-pale-sage">
          <span>Subtotal</span>
          <span>{formatCurrency(pesosToCents(b.subtotal))}</span>
        </div>
        {b.discount > 0 ? (
          <div className="flex items-center justify-between text-[13px] text-pale-sage">
            <span>Descuento</span>
            <span>-{formatCurrency(pesosToCents(b.discount))}</span>
          </div>
        ) : null}
        {taxRate > 0 ? (
          <div className="flex items-center justify-between text-[13px] text-pale-sage">
            <span>IVA ({taxRate / 100}%)</span>
            <span>{formatCurrency(pesosToCents(b.iva))}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between border-t border-white/15 pt-1.5">
          <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-chartreuse-lime">
            {totalLabel}
          </span>
          <span className="font-display text-[22px]">{formatCurrency(pesosToCents(b.total))}</span>
        </div>
      </div>
    </div>
  );
}
