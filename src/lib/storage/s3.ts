import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Storage } from "./index";

/** S3-compatible driver (AWS S3, R2, MinIO). Not exercised by the automated tests. */
export class S3Storage implements Storage {
  private client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: process.env.S3_ACCESS_KEY_ID
      ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "" }
      : undefined,
  });
  private bucket = process.env.S3_BUCKET ?? "";

  async put(key: string, data: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType, ServerSideEncryption: undefined }),
    );
  }
  async get(key: string) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }
  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
  async deletePrefix(prefix: string) {
    let token: string | undefined;
    do {
      const list = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix.endsWith("/") ? prefix : prefix + "/", ContinuationToken: token }),
      );
      const objs = (list.Contents ?? []).map((o) => ({ Key: o.Key! }));
      if (objs.length) await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: objs } }));
      token = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (token);
  }
}
