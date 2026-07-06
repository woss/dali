export const GET = async (): Promise<Response> => {
  return new Response(
    JSON.stringify({
      issuer: new URL('/', 'http://localhost:7777').toString(),
      authorization_endpoint: '/api/auth/authorize',
      token_endpoint: '/api/auth/token',
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['mcp'],
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
