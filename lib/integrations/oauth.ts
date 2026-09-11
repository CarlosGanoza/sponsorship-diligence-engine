type OAuthTokenRequest = {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  scope?: string;
};

type OAuthTokenResponse = {
  access_token?: string;
};

export async function refreshOAuthAccessToken(input: OAuthTokenRequest) {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    refresh_token: input.refreshToken,
    grant_type: "refresh_token",
  });

  if (input.scope?.trim()) {
    body.set("scope", input.scope.trim());
  }

  const response = await fetch(input.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`OAuth token refresh failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as OAuthTokenResponse;

  if (!payload.access_token) {
    throw new Error("OAuth token refresh did not return an access token.");
  }

  return payload.access_token;
}
