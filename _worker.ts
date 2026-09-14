import app from './backend/src/index';

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // API routes handled by Hono backend
    if (
      url.pathname.startsWith('/api') ||
      url.pathname.startsWith('/auth') ||
      url.pathname.startsWith('/admin')
    ) {
      return app.fetch(request, env, ctx);
    }

    // Static assets & SPA fallback handled by Cloudflare Pages ASSETS binding
    try {
      const response = await env.ASSETS.fetch(request);
      if (response.status === 404 && !url.pathname.includes('.')) {
        return env.ASSETS.fetch(new Request(new URL('/', request.url), request));
      }
      return response;
    } catch {
      return new Response('Asset not found', { status: 404 });
    }
  },
};
