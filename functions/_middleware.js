/**
 * Facet 加密交付 · Cloudflare Pages Functions Middleware
 *
 * 功能：
 * 1. 密码保护：受保护路径需要输入密码才能访问
 * 2. 访问审计：记录每次访问的 IP / UA / 时间 / 路径
 *
 * 配置（wrangler.toml 或 Cloudflare 控制台）：
 *   [vars]
 *   PROTECTED_PATHS = "/proposal,/faq"     # 逗号分隔，需保护的前缀
 *   SESSION_SECRET  = "随机字符串"           # session cookie 签名密钥
 *   ADMIN_TOKEN     = "管理员访问日志的 token"
 *
 * KV 绑定（必须）：
 *   [[kv_namespaces]]
 *   binding = "ACCESS_KV"
 *   id = "xxx"
 *
 * KV 数据结构：
 *   - `pwd:<path>` → 该路径的密码（首次访问时通过环境变量初始化）
 *   - `log:<timestamp>:<random>` → 访问记录 JSON
 *   - `session:<token>` → session 数据（有效期 7 天）
 */
export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 0. 诊断模式：/admin/diagnose?token=xxx 检查 env 绑定是否正常
  if (path === "/admin/diagnose") {
    return renderDiagnose(request, env);
  }

  // 1. 判断是否受保护路径
  if (!isProtectedPath(path, env)) {
    return next();
  }

  // 2. KV 不可用时降级：只用 secret 密码验证，不记录日志
  const kv = env.ACCESS_KV;
  const kvAvailable = kv && typeof kv.get === "function";

  try {
    // 3. 检查 session cookie
    const session = kvAvailable ? await getSession(request, env) : null;

    if (!session) {
      // 3a. 未登录：显示密码输入页 / 处理密码提交
      if (request.method === "POST") {
        return handleLogin(request, env, path, kvAvailable);
      }
      return renderLoginPage(path);
    }

    // 3b. 已登录：记录访问 + 放行
    if (kvAvailable) await recordAccess(request, env, session);

    const response = await next();

    // 给受保护页面加 noindex，防止被搜索引擎收录
    const modified = new Response(response.body, response);
    modified.headers.set("X-Robots-Tag", "noindex, nofollow");
    modified.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    return modified;
  } catch (err) {
    // 任何意外错误都要返回明确的诊断信息，不要裸 500
    return new Response(renderErrorPage("500 · 内部错误", `中间件执行失败：${escapeHtml(err.message)}`), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

/** 诊断页：显示 env 绑定情况（需 ADMIN_TOKEN） */
function renderDiagnose(request, env) {
  const url = new URL(request.url);
  if (!env.ADMIN_TOKEN || url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("需要 ?token=<ADMIN_TOKEN>", { status: 403 });
  }
  const kv = env.ACCESS_KV;
  const info = {
    PROTECTED_PATHS: env.PROTECTED_PATHS || "(未设置)",
    "ACCESS_KV 绑定": kv ? "✅ 已绑定" : "❌ 未绑定",
    "ACCESS_KV 类型": typeof kv,
    "ACCESS_KV.get": kv && typeof kv.get === "function" ? "✅ 是函数" : "❌ 不是函数",
    "DEFAULT_PASSWORD": env.DEFAULT_PASSWORD ? "✅ 已设置" : "❌ 未设置",
    "ADMIN_TOKEN": env.ADMIN_TOKEN ? "✅ 已设置" : "❌ 未设置",
    所有env键: Object.keys(env).join(", "),
  };
  return new Response(JSON.stringify(info, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/** 判断路径是否需要保护 */
function isProtectedPath(path, env) {
  const protectedPrefixes = (env.PROTECTED_PATHS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (protectedPrefixes.length === 0) return false;
  return protectedPrefixes.some((prefix) => path === prefix || path.startsWith(prefix + "/"));
}

/**
 * 读取并验证 session cookie。
 *
 * 设计：用 HMAC 签名 cookie，不依赖 KV —— 这样即使 KV 绑定异常，
 * 密码保护仍然工作（KV 只用于访问日志，非关键路径）。
 *
 * cookie 格式：<expiresAt>.<pathHash>.<hmac>
 */
async function getSession(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/facet_session=([^;]+)/);
  if (!match) return null;

  const [expiresAtStr, pathHash, sig] = match[1].split(".");
  if (!expiresAtStr || !pathHash || !sig) return null;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  const secret = env.SESSION_SECRET || env.DEFAULT_PASSWORD || "";
  if (!secret) return null;

  const expected = await hmacHex(secret, `${expiresAtStr}.${pathHash}`);
  if (expected !== sig) return null;

  return { expiresAt, pathHash };
}

/** HMAC-SHA256 → hex */
async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 简单字符串 hash（用于把路径压成短标识） */
function simpleHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** 生成签名 session cookie 值 */
async function createSessionCookie(path, env, maxAgeSec) {
  const expiresAt = Date.now() + maxAgeSec * 1000;
  const pathHash = simpleHash(path);
  const secret = env.SESSION_SECRET || env.DEFAULT_PASSWORD || "";
  const sig = await hmacHex(secret, `${expiresAt}.${pathHash}`);
  return { cookieValue: `${expiresAt}.${pathHash}.${sig}`, expiresAt, pathHash };
}

/** 处理密码提交 */
async function handleLogin(request, env, path, kvAvailable) {
  const formData = await request.formData();
  const password = formData.get("password");

  // 优先读 KV 中该路径的密码（支持每路径独立密码），否则用全局 DEFAULT_PASSWORD
  let expectedPassword = env.DEFAULT_PASSWORD || "";
  if (kvAvailable) {
    const stored = await env.ACCESS_KV.get(`pwd:${path}`);
    if (stored) expectedPassword = stored;
  }

  if (!expectedPassword) {
    return new Response(renderErrorPage("未配置密码", "管理员需要先设置 DEFAULT_PASSWORD secret"), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (password !== expectedPassword) {
    if (kvAvailable) await recordFailedAttempt(request, env, path);
    return renderLoginPage(path, "密码错误，请重试");
  }

  const maxAge = 7 * 24 * 60 * 60; // 7 天
  const { cookieValue } = await createSessionCookie(path, env, maxAge);

  // 记录登录成功（KV 可用时）
  if (kvAvailable) {
    await recordAccess(request, env, { event: "login" });
  }

  // 设置签名 cookie 并跳回原页面（302 避免重复提交 + 防重复记录）
  return new Response(null, {
    status: 302,
    headers: {
      Location: path,
      "Set-Cookie": `facet_session=${cookieValue}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`,
    },
  });
}

/** 记录访问 */
async function recordAccess(request, env, session) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ua = request.headers.get("User-Agent") || "";
  const url = new URL(request.url);
  const country = request.headers.get("CF-IPCountry") || "";

  const record = {
    timestamp: new Date().toISOString(),
    ip,
    country,
    userAgent: ua,
    path: url.pathname,
    referer: request.headers.get("Referer") || "",
    event: session.event || "view",
    // 简单 UA 解析
    device: parseDevice(ua),
  };

  const key = `log:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  await env.ACCESS_KV.put(key, JSON.stringify(record), {
    expirationTtl: 90 * 24 * 60 * 60, // 保留 90 天
  });
}

/** 记录失败的密码尝试 */
async function recordFailedAttempt(request, env, path) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const record = {
    timestamp: new Date().toISOString(),
    ip,
    country: request.headers.get("CF-IPCountry") || "",
    userAgent: request.headers.get("User-Agent") || "",
    path,
    event: "login_failed",
    device: parseDevice(request.headers.get("User-Agent") || ""),
  };
  const key = `log:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  await env.ACCESS_KV.put(key, JSON.stringify(record), {
    expirationTtl: 90 * 24 * 60 * 60,
  });
}

/** 简单 UA 解析 */
function parseDevice(ua) {
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh/i.test(ua)) return "macOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  if (/bot|crawler|spider/i.test(ua)) return "Bot";
  return "Unknown";
}

/** 生成随机 token */
function generateToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 密码输入页 */
function renderLoginPage(path, error = "") {
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>需要访问密码</title>
<style>
  :root {
    --paper: #f7f5f0; --ink: #24303a; --muted: #5f6b76;
    --faint: #e3dfd6; --soft: #eef1f2; --accent-warm: #9a5d3e;
    --display-font: "Source Han Serif SC", "Songti SC", Georgia, serif;
    --body-font: "Inter", "PingFang SC", system-ui, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root:root { --paper: #221d18; --ink: #e6dfd2; --muted: #98907f; --faint: #3a342d; --soft: #2c2722; --accent-warm: #d08868; }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: var(--paper); color: var(--ink); font-family: var(--body-font); padding: 24px;
  }
  .card {
    max-width: 420px; width: 100%; padding: 40px 36px;
    background: var(--soft); border-radius: 12px; border-left: 3px solid var(--accent-warm);
  }
  .kicker { color: var(--accent-warm); font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; margin: 0 0 12px; }
  h1 { font-family: var(--display-font); font-size: 28px; font-weight: 700; margin: 0 0 10px; line-height: 1.3; }
  .sub { color: var(--muted); font-size: 15px; line-height: 1.6; margin: 0 0 28px; }
  label { display: block; font-size: 13px; font-weight: 600; color: var(--muted); margin: 0 0 8px; }
  input[type=password] {
    width: 100%; padding: 13px 16px; font-size: 16px; font-family: inherit;
    border: 1px solid var(--faint); border-radius: 8px;
    background: var(--paper); color: var(--ink); outline: none;
  }
  input[type=password]:focus { border-color: var(--accent-warm); }
  button {
    width: 100%; margin-top: 18px; padding: 14px; font-size: 15px; font-weight: 700; font-family: inherit;
    background: var(--accent-warm); color: #fff; border: 0; border-radius: 8px; cursor: pointer;
  }
  button:hover { opacity: 0.9; }
  .error { color: #c2410c; font-size: 13.5px; margin: 12px 0 0; }
  .footer { margin-top: 28px; padding-top: 18px; border-top: 1px solid var(--faint); color: var(--muted); font-size: 12px; line-height: 1.6; }
</style>
</head>
<body>
  <div class="card">
    <p class="kicker">PROTECTED</p>
    <h1>此页面需要访问密码</h1>
    <p class="sub">这是一份未公开的资料。请输入管理员提供的访问密码。</p>
    <form method="POST">
      <label for="password">访问密码</label>
      <input type="password" id="password" name="password" autocomplete="current-password" autofocus required />
      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
      <button type="submit">进入</button>
    </form>
    <div class="footer">
      🔒 访问会被记录（IP / 时间 / 设备）。如无密码请联系资料提供方。
    </div>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 401,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function renderErrorPage(title, message) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:system-ui;padding:40px"><h1>${title}</h1><p>${message}</p></body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
