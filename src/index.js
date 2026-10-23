const enc = new TextEncoder();
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });
async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function makeSession(secret) {
  const p = btoa(JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000, n: crypto.randomUUID() })).replace(/=/g, "");
  return p + "." + await sign(p, secret);
}
async function isAdmin(request, env) {
  if (!env.SESSION_SECRET) return false;
  const c = (request.headers.get("Cookie") || "").split(";").map(x => x.trim()).find(x => x.startsWith("cherion_admin="));
  if (!c) return false;
  try {
    const [p, s] = decodeURIComponent(c.slice("cherion_admin=".length)).split(".");
    if (!p || !s || s !== await sign(p, env.SESSION_SECRET)) return false;
    return JSON.parse(atob(p)).exp > Date.now();
  } catch { return false; }
}
const cookie = token => `cherion_admin=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`;
const clearCookie = () => "cherion_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0";
async function body(request) { try { return await request.json(); } catch { return null; } }
const id = () => crypto.randomUUID();
const date = v => new Date(v).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
function needDB(env) { if (!env.DB) throw new Error("D1 데이터베이스 바인딩 DB가 없습니다. Worker 설정에서 D1 binding을 추가하세요."); }
function rows(result) { return result.results || []; }
function methodNotAllowed() { return json({ error: "지원하지 않는 요청입니다." }, 405, { Allow: "GET, POST, PUT, DELETE" }); }
async function api(request, env, url) {
  const path = url.pathname, method = request.method;
  if (path === "/api/admin/login" && method === "POST") {
    if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return json({ error: "Cloudflare 비밀 변수 ADMIN_PASSWORD와 SESSION_SECRET을 설정해 주세요." }, 503);
    const b = await body(request);
    if (!b || typeof b.password !== "string" || b.password.length > 200 || b.password !== env.ADMIN_PASSWORD) return json({ error: "비밀번호가 올바르지 않습니다." }, 401);
    return json({ ok: true }, 200, { "Set-Cookie": cookie(await makeSession(env.SESSION_SECRET)) });
  }
  if (path === "/api/admin/logout" && method === "POST") return json({ ok: true }, 200, { "Set-Cookie": clearCookie() });
  if (path === "/api/admin/me" && method === "GET") return await isAdmin(request, env) ? json({ ok: true }) : json({ error: "로그인이 필요합니다." }, 401);
  if (!path.startsWith("/api/")) return null;
  needDB(env);
  if (path === "/api/content" && method === "GET") {
    const [a, p, s] = await Promise.all([
      env.DB.prepare("SELECT id,title,body,created_at FROM announcements ORDER BY created_at DESC LIMIT 30").all(),
      env.DB.prepare("SELECT id,title,body,author,created_at FROM posts ORDER BY created_at DESC LIMIT 50").all(),
      env.DB.prepare("SELECT headline,show_announcements,show_board FROM site_settings WHERE id='main'").first()
    ]);
    return json({ announcements: rows(a).map(x => ({ ...x, date: date(x.created_at) })), posts: rows(p).map(x => ({ ...x, date: date(x.created_at) })), settings: s ? { headline: s.headline, showAnnouncements: !!s.show_announcements, showBoard: !!s.show_board } : { showAnnouncements: true, showBoard: true } });
  }
  if (path === "/api/admin/content" && method === "GET") {
    if (!await isAdmin(request, env)) return json({ error: "로그인이 필요합니다." }, 401);
    const [a, p, s] = await Promise.all([
      env.DB.prepare("SELECT id,title,body,created_at FROM announcements ORDER BY created_at DESC").all(),
      env.DB.prepare("SELECT id,title,body,author,created_at FROM posts ORDER BY created_at DESC").all(),
      env.DB.prepare("SELECT headline,show_announcements,show_board FROM site_settings WHERE id='main'").first()
    ]);
    return json({ announcements: rows(a).map(x => ({ ...x, date: date(x.created_at) })), posts: rows(p).map(x => ({ ...x, date: date(x.created_at) })), settings: s ? { headline: s.headline, showAnnouncements: !!s.show_announcements, showBoard: !!s.show_board } : {} });
  }
  if (path === "/api/admin/announcements" && method === "POST") {
    if (!await isAdmin(request, env)) return json({ error: "로그인이 필요합니다." }, 401);
    const b = await body(request);
    if (!b || typeof b.title !== "string" || typeof b.body !== "string" || !b.title.trim() || !b.body.trim() || b.title.length > 100 || b.body.length > 5000) return json({ error: "제목과 내용을 확인해 주세요." }, 400);
    await env.DB.prepare("INSERT INTO announcements(id,title,body,created_at) VALUES(?,?,?,?)").bind(id(), b.title.trim(), b.body.trim(), new Date().toISOString()).run();
    return json({ ok: true }, 201);
  }
  if (path === "/api/admin/posts" && method === "POST") {
    if (!await isAdmin(request, env)) return json({ error: "로그인이 필요합니다." }, 401);
    const b = await body(request);
    if (!b || typeof b.title !== "string" || typeof b.body !== "string" || typeof b.author !== "string" || !b.title.trim() || !b.body.trim() || !b.author.trim() || b.title.length > 100 || b.body.length > 5000 || b.author.length > 40) return json({ error: "제목, 작성자, 내용을 확인해 주세요." }, 400);
    await env.DB.prepare("INSERT INTO posts(id,title,body,author,created_at) VALUES(?,?,?,?,?)").bind(id(), b.title.trim(), b.body.trim(), b.author.trim(), new Date().toISOString()).run();
    return json({ ok: true }, 201);
  }
  if (path === "/api/admin/settings" && method === "PUT") {
    if (!await isAdmin(request, env)) return json({ error: "로그인이 필요합니다." }, 401);
    const b = await body(request);
    if (!b || typeof b.headline !== "string" || b.headline.length > 120 || typeof b.showAnnouncements !== "boolean" || typeof b.showBoard !== "boolean") return json({ error: "설정값을 확인해 주세요." }, 400);
    await env.DB.prepare("INSERT INTO site_settings(id,headline,show_announcements,show_board) VALUES('main',?,?,?) ON CONFLICT(id) DO UPDATE SET headline=excluded.headline,show_announcements=excluded.show_announcements,show_board=excluded.show_board").bind(b.headline.trim() || "빛나는 존재감, 함께 만드는 채리온.", b.showAnnouncements ? 1 : 0, b.showBoard ? 1 : 0).run();
    return json({ ok: true });
  }
  const match = path.match(/^\/api\/admin\/(announcements|posts)\/([^/]+)$/);
  if (match && method === "DELETE") {
    if (!await isAdmin(request, env)) return json({ error: "로그인이 필요합니다." }, 401);
    const table = match[1] === "announcements" ? "announcements" : "posts";
    await env.DB.prepare(`DELETE FROM ${table} WHERE id=?`).bind(decodeURIComponent(match[2])).run();
    return json({ ok: true });
  }
  if (path.startsWith("/api/")) return methodNotAllowed();
  return null;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) {
        const response = await api(request, env, url);
        if (response) return response;
      }
      return env.ASSETS.fetch(request);
    } catch (err) {
      return json({ error: err?.message || "서버 오류가 발생했습니다." }, 500);
    }
  }
};
