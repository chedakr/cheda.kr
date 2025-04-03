export type Env = {
  DB: D1Database;

  OAUTH_CLIENT_ID_NAVER: string;
  OAUTH_CLIENT_SECRET_NAVER: string;
  JWT_SECRET_KEY: string;
  JWT_PUBLIC_KEY: string;

  API_ORIGIN: string;
  DEV?: string;
}
