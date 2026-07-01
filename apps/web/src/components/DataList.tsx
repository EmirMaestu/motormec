import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyState, SkeletonList, Table, Td, Th } from "./ui";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right";
}

/**
 * Responsive data view. Renders a real table on >=md and a stack of tappable
 * cards on mobile (no horizontal scroll). Same data, two layouts.
 */
export function DataList<T>({
  items,
  keyOf,
  columns,
  card,
  onRowClick,
  rowClassName,
  loading,
  emptyTitle = "Sin resultados",
  emptyHint,
}: {
  items: T[];
  keyOf: (row: T) => string;
  columns: Column<T>[];
  card: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  /** Extra classes per row/card (e.g. to tint delivered vehicles). */
  rowClassName?: (row: T) => string | undefined;
  loading?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  if (loading) return <SkeletonList />;
  if (items.length === 0) return <EmptyState title={emptyTitle} hint={emptyHint} />;

  return (
    <>
      {/* Mobile: cards */}
      <div className="stagger space-y-3 md:hidden">
        {items.map((row) => (
          <div
            key={keyOf(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(
              "rounded-[16px] bg-paper-white border border-black/10 p-4",
              onRowClick && "active:bg-pale-sage transition cursor-pointer",
              rowClassName?.(row),
            )}
          >
            {card(row)}
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              {columns.map((c, i) => (
                <Th key={i} className={c.align === "right" ? "text-right" : undefined}>
                  {c.header}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr
                key={keyOf(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  onRowClick && "cursor-pointer hover:bg-pale-sage/60",
                  rowClassName?.(row),
                )}
              >
                {columns.map((c, i) => (
                  <Td key={i} className={cn(c.align === "right" && "text-right", c.className)}>
                    {c.cell(row)}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
}

/** A simple label/value row used inside mobile cards. */
export function CardRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[14px]">
      <span className="text-charcoal">{label}</span>
      <span className="text-deep-forest text-right">{children}</span>
    </div>
  );
}
