export const GET = async ({ url }: { url: URL }): Promise<Response> => {
  const prefix = url.origin;
  return new Response(
    JSON.stringify({
      resource: `${prefix}/api/mcp`,
      authorization_servers: [`${prefix}/.well-known/oauth-authorization-server`],
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
