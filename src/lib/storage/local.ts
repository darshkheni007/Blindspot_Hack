import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Storage } from "./index";

export class LocalStorage implements Storage {
  private root: string;
  constructor(root: string) {
    this.root = path.resolve(root);
  }
  /** Resolves a key and refuses anything that escapes the storage root. */
  private resolve(key: string) {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }
  async put(key: string, data: Buffer) {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data, { mode: 0o600 }); // never executable
  }
  async get(key: string) {
    return readFile(this.resolve(key));
  }
  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }
  async deletePrefix(prefix: string) {
    await rm(this.resolve(prefix), { recursive: true, force: true });
  }
}
