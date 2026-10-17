declare module "pdf-parse/lib/pdf-parse.js" {
  const pdf: (data: Buffer, options?: unknown) => Promise<{ numpages: number; text: string }>;
  export default pdf;
}
