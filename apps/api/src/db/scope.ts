import {
  and,
  eq,
  sql,
  type InferInsertModel,
  type InferSelectModel,
  type SQL,
} from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db, type Database } from "./client.js";
import type { TenantScopedTable } from "./schema.js";

/**
 * Mandatory tenant isolation layer.
 *
 * Every read/write to a tenant-scoped table MUST go through a `TenantDb`
 * obtained from `forTenant(tenantId)`. The tenant predicate is injected by this
 * layer — callers cannot forget it, and `tenant_id` is never accepted from the
 * client. Writing a raw Drizzle query against a data table (bypassing this
 * class) is prohibited by convention and covered by isolation tests.
 *
 * The tenant id is resolved from the session cookie (dashboard) or from the
 * WhatsApp `phone_number_id` (webhook) — see auth/middleware and the webhook.
 */

type Columns = Record<string, PgColumn>;

/**
 * Insert/update payload shapes. Required columns stay enforced; the index
 * signature intentionally disables TS excess-property checks (which produce
 * false positives over generic `Omit` of Drizzle's inferred models). `tenantId`
 * is always stripped/overwritten at runtime, so allowing it in the type is safe.
 */
export type ScopedInsert<T extends TenantScopedTable> = Omit<
  InferInsertModel<T>,
  "tenantId"
> &
  Record<string, unknown>;

export type ScopedUpdate<T extends TenantScopedTable> = Partial<
  Omit<InferInsertModel<T>, "tenantId" | "id">
> &
  Record<string, unknown>;

function tenantColumn(table: TenantScopedTable): PgColumn {
  const col = (table as unknown as Columns)["tenantId"];
  if (!col) {
    throw new Error("forTenant used on a table without a tenant_id column");
  }
  return col;
}

function idColumn(table: TenantScopedTable): PgColumn {
  const col = (table as unknown as Columns)["id"];
  if (!col) {
    throw new Error("Table has no id column");
  }
  return col;
}

export class TenantDb {
  constructor(
    private readonly database: Database,
    public readonly tenantId: string,
  ) {}

  /** AND the tenant predicate with an optional user-supplied filter. */
  private scope(table: TenantScopedTable, where?: SQL): SQL {
    const tenantPredicate = eq(tenantColumn(table), this.tenantId);
    return where ? (and(tenantPredicate, where) as SQL) : tenantPredicate;
  }

  /** Select all rows of a tenant-scoped table matching an optional filter. */
  async select<T extends TenantScopedTable>(
    table: T,
    where?: SQL,
  ): Promise<InferSelectModel<T>[]> {
    const rows = await this.database
      .select()
      .from(table as TenantScopedTable)
      .where(this.scope(table, where));
    return rows as InferSelectModel<T>[];
  }

  /** Select the first matching row, or null. */
  async selectOne<T extends TenantScopedTable>(
    table: T,
    where?: SQL,
  ): Promise<InferSelectModel<T> | null> {
    const rows = await this.database
      .select()
      .from(table as TenantScopedTable)
      .where(this.scope(table, where))
      .limit(1);
    return (rows[0] as InferSelectModel<T>) ?? null;
  }

  /** Fetch a single row by primary key, scoped to this tenant. */
  async findById<T extends TenantScopedTable>(
    table: T,
    id: string,
  ): Promise<InferSelectModel<T> | null> {
    const rows = await this.database
      .select()
      .from(table as TenantScopedTable)
      .where(this.scope(table, eq(idColumn(table), id)))
      .limit(1);
    return (rows[0] as InferSelectModel<T>) ?? null;
  }

  /**
   * Insert one or more rows; tenant_id is forced to this tenant. Any tenantId in
   * the payload is overwritten at runtime with this tenant's id.
   */
  async insert<T extends TenantScopedTable>(
    table: T,
    values: ScopedInsert<T> | ScopedInsert<T>[],
  ): Promise<InferSelectModel<T>[]> {
    const list = Array.isArray(values) ? values : [values];
    if (list.length === 0) return [];
    const withTenant = list.map((v) => ({
      ...v,
      tenantId: this.tenantId,
    }));
    const rows = await this.database
      .insert(table)
      .values(withTenant as InferInsertModel<T>[])
      .returning();
    return rows as InferSelectModel<T>[];
  }

  /** Insert a single row and return it. */
  async insertOne<T extends TenantScopedTable>(
    table: T,
    values: ScopedInsert<T>,
  ): Promise<InferSelectModel<T>> {
    const [row] = await this.insert(table, values);
    if (!row) throw new Error("Insert returned no row");
    return row;
  }

  /**
   * Update rows matching `where` (always AND-ed with the tenant predicate).
   * `tenantId` cannot be reassigned through this method.
   */
  async update<T extends TenantScopedTable>(
    table: T,
    values: ScopedUpdate<T>,
    where?: SQL,
  ): Promise<InferSelectModel<T>[]> {
    const { tenantId: _ignored, id: _id, ...safe } = values as Record<
      string,
      unknown
    >;
    // Drizzle's generic .set type cannot be expressed over the table union;
    // the runtime payload is correct and always tenant-scoped by .where().
    const rows = await this.database
      .update(table)
      .set(safe as never)
      .where(this.scope(table, where))
      .returning();
    return rows as InferSelectModel<T>[];
  }

  /** Update a single row by id, scoped to this tenant. Returns it or null. */
  async updateById<T extends TenantScopedTable>(
    table: T,
    id: string,
    values: ScopedUpdate<T>,
  ): Promise<InferSelectModel<T> | null> {
    const rows = await this.update(table, values, eq(idColumn(table), id));
    return rows[0] ?? null;
  }

  /** Delete rows matching `where` (always AND-ed with the tenant predicate). */
  async delete<T extends TenantScopedTable>(
    table: T,
    where?: SQL,
  ): Promise<InferSelectModel<T>[]> {
    const rows = await this.database
      .delete(table)
      .where(this.scope(table, where))
      .returning();
    return rows as InferSelectModel<T>[];
  }

  /** Delete a single row by id, scoped to this tenant. Returns it or null. */
  async deleteById<T extends TenantScopedTable>(
    table: T,
    id: string,
  ): Promise<InferSelectModel<T> | null> {
    const rows = await this.delete(table, eq(idColumn(table), id));
    return rows[0] ?? null;
  }

  /** Count rows matching an optional filter, scoped to this tenant. */
  async count<T extends TenantScopedTable>(
    table: T,
    where?: SQL,
  ): Promise<number> {
    const res = await this.database
      .select({ c: sql<number>`count(*)::int` })
      .from(table as TenantScopedTable)
      .where(this.scope(table, where));
    return res[0]?.c ?? 0;
  }

  /**
   * Ejecuta `fn` dentro de una transacción Postgres, con un TenantDb scopeado al
   * mismo tenant. Si `fn` lanza, se hace ROLLBACK de todo. Si esta instancia ya
   * está dentro de una transacción, Drizzle usa un SAVEPOINT (transacción anidada).
   */
  async transaction<T>(fn: (tx: TenantDb) => Promise<T>): Promise<T> {
    return this.database.transaction(async (txdb) => {
      const scoped = new TenantDb(txdb as unknown as Database, this.tenantId);
      return fn(scoped);
    });
  }
}

/** Entry point: obtain a tenant-scoped data accessor. */
export function forTenant(tenantId: string, database: Database = db): TenantDb {
  if (!tenantId) throw new Error("forTenant requires a tenantId");
  return new TenantDb(database, tenantId);
}
