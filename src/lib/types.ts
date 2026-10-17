/** Client-safe DTO types shared between API routes and components. */
export interface DocItem {
  id: string;
  name: string;
  ext: string;
  sizeBytes: number;
  docType: string;
  status: "PARSING" | "READY" | "FAILED";
  error: string | null;
  pageCount: number | null;
  chunkCount: number;
  createdAt: string;
}
