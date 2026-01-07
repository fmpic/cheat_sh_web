/**
 * Cloudflare Pages Function - CORS Proxy for cheat.sh
 * Path: /api/cheat
 *
 * This handles requests like: /api/cheat?q=tar
 */

export async function onRequest(context) {
  const { request } = context;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q");

  if (!query) {
    return new Response(
      JSON.stringify({
        error: "Missing query parameter",
        usage: "/api/cheat?q=tar",
        examples: ["?q=tar", "?q=python/list", "?q=go/:learn"],
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(),
        },
      }
    );
  }

  try {
    // Fetch from cheat.sh with curl User-Agent to get ANSI colored output
    const cheatShUrl = `https://cheat.sh/${encodeURIComponent(query)}`;

    const response = await fetch(cheatShUrl, {
      headers: {
        "User-Agent": "curl/7.68.0",
        Accept: "text/plain",
      },
    });

    const text = await response.text();

    return new Response(text, {
      status: response.status,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        ...corsHeaders(),
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch from cheat.sh",
        message: error.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(),
        },
      }
    );
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}
