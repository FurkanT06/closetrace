declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    TRUSTED_PROXY_SECRET?: string;
  }
}
