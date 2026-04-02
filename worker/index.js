const CORS = {
  "Access-Control-Allow-Origin": "https://flowers-of-romance.github.io",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    // POST /entries — create
    if (request.method === "POST" && url.pathname === "/entries") {
      const body = await request.json();
      const text = (body.text || "").trim();
      if (!text || text.length > 10000) {
        return Response.json({ error: "invalid" }, { status: 400, headers: CORS });
      }

      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const entry = { id, text, ts: Date.now() };

      // Store individual entry
      await env.DIARY.put(`entry:${id}`, JSON.stringify(entry));

      // Update index (list of IDs, newest first)
      const indexRaw = await env.DIARY.get("index");
      const index = indexRaw ? JSON.parse(indexRaw) : [];
      index.unshift(id);
      // Keep max 1000 entries
      if (index.length > 1000) index.length = 1000;
      await env.DIARY.put("index", JSON.stringify(index));

      return Response.json(entry, { headers: CORS });
    }

    // GET /entries — list
    if (request.method === "GET" && url.pathname === "/entries") {
      const indexRaw = await env.DIARY.get("index");
      const index = indexRaw ? JSON.parse(indexRaw) : [];

      // Paginate: ?offset=0&limit=20
      const offset = parseInt(url.searchParams.get("offset") || "0");
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
      const ids = index.slice(offset, offset + limit);

      const entries = await Promise.all(
        ids.map(async (id) => {
          const raw = await env.DIARY.get(`entry:${id}`);
          return raw ? JSON.parse(raw) : null;
        })
      );

      return Response.json(
        { entries: entries.filter(Boolean), total: index.length },
        { headers: CORS }
      );
    }

    return Response.json({ error: "not found" }, { status: 404, headers: CORS });
  },
};
