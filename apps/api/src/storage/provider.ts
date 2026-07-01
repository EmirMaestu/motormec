import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { env } from "../config/env.js";

/**
 * Storage abstraction so photos can move from local disk to e.g. Cloudflare R2
 * later without touching the rest of the app. DB stores the *relative* path.
 */
export interface StorageProvider {
  /** Save bytes for a tenant/historial and return the relative path. */
  save(
    tenantId: string,
    historialId: string,
    bytes: Buffer,
    ext?: string,
  ): Promise<string>;
  /** Read bytes for a previously-saved relative path. */
  read(relativePath: string): Promise<Buffer>;
  /** Delete a stored object (best-effort). */
  remove(relativePath: string): Promise<void>;
}

export class LocalDiskStorage implements StorageProvider {
  constructor(private readonly root: string = resolve(env.MEDIA_ROOT)) {}

  async save(
    tenantId: string,
    historialId: string,
    bytes: Buffer,
    ext = "jpg",
  ): Promise<string> {
    const relative = join(tenantId, historialId, `${randomUUID()}.${ext}`);
    const abs = this.absolute(relative);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, bytes);
    // Normalize to forward slashes for portable storage in the DB.
    return relative.split(sep).join("/");
  }

  async read(relativePath: string): Promise<Buffer> {
    return readFile(this.absolute(relativePath));
  }

  async remove(relativePath: string): Promise<void> {
    try {
      await unlink(this.absolute(relativePath));
    } catch {
      /* ignore missing files */
    }
  }

  /** Resolve + guard against path traversal escaping the media root. */
  absolute(relativePath: string): string {
    const abs = normalize(join(this.root, relativePath));
    const rootNorm = normalize(this.root + sep);
    if (!abs.startsWith(rootNorm)) {
      throw new Error("Invalid media path");
    }
    return abs;
  }
}

export const storage: StorageProvider = new LocalDiskStorage();
export const localDisk = storage as LocalDiskStorage;
