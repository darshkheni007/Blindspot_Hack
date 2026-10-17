import { env } from "../env";
import { LocalStorage } from "./local";
import { S3Storage } from "./s3";

/** Storage abstraction. Keys are always `<workspaceId>/<projectId>/<documentId>-<safeName>`. */
export interface Storage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** Deletes everything under a prefix (project or workspace removal). */
  deletePrefix(prefix: string): Promise<void>;
}

let instance: Storage | undefined;
export function getStorage(): Storage {
  instance ??= env.storageDriver === "s3" ? new S3Storage() : new LocalStorage(env.storageDir);
  return instance;
}
export function setStorageForTests(s: Storage | undefined) {
  instance = s;
}

/** Strips anything that could escape a directory or confuse a filesystem. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^\w.\- ]+/g, "_").replace(/\.{2,}/g, ".").slice(0, 120) || "file";
}

export function storageKey(workspaceId: string, projectId: string, documentId: string, name: string) {
  return `${workspaceId}/${projectId}/${documentId}-${safeFileName(name)}`;
}
