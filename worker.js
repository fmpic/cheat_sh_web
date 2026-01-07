/**
 * Cloudflare Worker - CORS Proxy for cheat.sh
 *
 * Deploy this as a Cloudflare Worker if you want to use your own proxy
 * instead of the public corsproxy.io service.
 *
 * Deploy steps:
 * 1. Go to Cloudflare Dashboard > Workers & Pages
 * 2. Create a new Worker
 * 3. Paste this code and deploy
 * 4. Update CONFIG.CORS_PROXY in app.js to your worker URL
 */

const ALLOWED_ORIGIN = "*"; // Set to your domain in production

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return handleCORS();
    }

    const url = new URL(request.url);
    const path = url.pathname.slice(1); // Remove leading /

    if (!path) {
      return new Response(
        JSON.stringify({
          error: "Missing query path",
          usage: "https://your-worker.workers.dev/tar",
          examples: ["/tar", "/python/list", "/go/:learn", "/:list"],
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
      // Fetch from cheat.sh
      const cheatShUrl = `https://cheat.sh/${path}?T`;
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
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
