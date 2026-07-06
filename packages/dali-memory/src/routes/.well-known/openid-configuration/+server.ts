export const GET = async (): Promise<Response> => {
  return new Response(
    JSON.stringify({
      issuer: new URL('/', 'http://localhost:7777').toString(),
      authorization_endpoint: '/api/auth/authorize',
      token_endpoint: '/api/auth/token',
      scopes_supported: ['openid', 'email', 'profile', 'mcp'],
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
};
