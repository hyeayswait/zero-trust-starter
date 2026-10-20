import { Issuer, type Client } from "openid-client";

let _client: Client | null = null;

export async function getOidcClient(): Promise<Client> {
  if (_client) return _client;
  const issuer = await Issuer.discover(
    process.env.OIDC_ISSUER ?? "http://localhost/.well-known/openid-configuration"
  );
  _client = new issuer.Client({
    client_id: process.env.OIDC_CLIENT_ID ?? "dev",
    client_secret: process.env.OIDC_CLIENT_SECRET ?? "dev",
    redirect_uris: [process.env.OIDC_REDIRECT_URI ?? "http://localhost:3000/api/auth/callback"],
    response_types: ["code"],
  });
  return _client;
}
