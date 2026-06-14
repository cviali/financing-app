export interface Env {
  DB: D1Database;
  RECEIPTS_BUCKET: R2Bucket;
  JWT_SECRET: string;
  CSRF_SECRET: string;
  CORS_ORIGIN: string;
  ENVIRONMENT: string;
}
