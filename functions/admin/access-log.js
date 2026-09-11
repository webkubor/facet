/**
 * 访问日志查看页
 *
 * 访问方式：https://share.webkubor.online/admin/access-log?token=<ADMIN_TOKEN>
 *
 * 功能：
 * - 查看所有受保护页面的访问记录（IP / 时间 / 设备 / 路径）
 * - 按 IP 聚合统计（谁看得最多）
 * - 查看失败的密码尝试（谁在猜密码）
 * - 支持导出 CSV
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  // 验证管理员 token
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return new Response(renderUnauthorized(), {
      status: 403,
      headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  // 读取所有日志
  const logs = await listLogs(env);

  // 导出 CSV
  if (url.searchParams.get("format") === "csv") {
    return new Response(renderCsv(logs), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="access-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return new Response(renderLogPage(logs, token), {
    headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
  });
}

/** 列出所有日志（按时间倒序） */
async function listLogs(env) {
  const list = await env.ACCESS_KV.list({ prefix: "log:", limit: 1000 });
  const logs = await Promise.all(
    list.keys.map(async (k) => {
      const raw = await env.ACCESS_KV.get(k.name);
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })
  );
  return logs.filter(Boolean).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/** 按 IP 聚合 */
function aggregateByIp(logs) {
  const map = new Map();
  for (const log of logs) {
    if (!map.has(log.ip)) {
      map.set(log.ip, {
        ip: log.ip,
        country: log.country,
        device: log.device,
        views: 0,
        logins: 0,
        failures: 0,
        firstSeen: log.timestamp,
        lastSeen: log.timestamp,
        paths: new Set(),
      });
    }
    const entry = map.get(log.ip);
    if (log.event === "login") entry.logins++;
    else if (log.event === "login_failed") entry.failures++;
    else entry.views++;
    entry.paths.add(log.path);
    if (log.timestamp < entry.firstSeen) entry.firstSeen = log.timestamp;
    if (log.timestamp > entry.lastSeen) entry.lastSeen = log.timestamp;
  }
  return Array.from(map.values())
    .map((e) => ({ ...e, paths: Array.from(e.paths) }))
    .sort((a, b) => b.views + b.logins - (a.views + a.logins));
}

function renderLogPage(logs, token) {
  const byIp = aggregateByIp(logs);
  const totalViews = logs.filter((l) => l.event === "view").length;
  const totalLogins = logs.filter((l) => l.event === "login").length;
  const totalFailures = logs.filter((l) => l.event === "login_failed").length;
  const uniqueIps = byIp.length;

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>访问日志 · Facet 加密交付</title>
<style>
  :root {
    --paper: #f7f5f0; --ink: #24303a; --muted: #5f6b76;
    --faint: #e3dfd6; --soft: #eef1f2; --accent-warm: #9a5d3e;
    --display-font: "Source Han Serif SC", "Songti SC", Georgia, serif;
    --body-font: "Inter", "PingFang SC", system-ui, sans-serif;
    --mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root:root { --paper: #221d18; --ink: #e6dfd2; --muted: #98907f; --faint: #3a342d; --soft: #2c2722; --accent-warm: #d08868; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--body-font); line-height: 1.7; }
  .shell { max-width: 1100px; margin: 0 auto; padding: 48px 24px 80px; }
  h1 { font-family: var(--display-font); font-size: 32px; margin: 0 0 8px; }
  h2 { font-family: var(--display-font); font-size: 20px; margin: 40px 0 14px; padding-left: 12px; border-left: 3px solid var(--accent-warm); }
  .sub { color: var(--muted); font-size: 15px; margin: 0 0 28px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 24px 0 36px; }
  .stat { padding: 16px; background: var(--soft); border-radius: 10px; border-left: 3px solid var(--accent-warm); }
  .stat .n { font-size: 28px; font-weight: 800; color: var(--accent-warm); font-family: var(--display-font); display: block; }
  .stat .l { font-size: 12.5px; color: var(--muted); }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; margin: 14px 0; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--faint); }
  th { background: var(--soft); font-weight: 700; font-size: 12.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  tr:hover td { background: var(--soft); }
  code { font-family: var(--mono); font-size: 0.9em; background: var(--soft); padding: 2px 6px; border-radius: 4px; color: var(--accent-warm); }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11.5px; font-weight: 700; }
  .badge.view { background: var(--soft); color: var(--muted); }
  .badge.login { background: rgba(125,157,140,.2); color: #4a7c5f; }
  .badge.fail { background: rgba(194,65,12,.15); color: #c2410c; }
  .actions { margin: 24px 0; display: flex; gap: 12px; }
  .btn { display: inline-block; padding: 10px 18px; background: var(--accent-warm); color: #fff; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; }
  .btn.ghost { background: var(--soft); color: var(--ink); border: 1px solid var(--faint); }
  .empty { color: var(--muted); padding: 32px; text-align: center; background: var(--soft); border-radius: 10px; }
  @media (max-width: 700px) { .stats { grid-template-columns: repeat(2, 1fr); } .shell { padding: 28px 16px 60px; } }
</style>
</head>
<body>
<div class="shell">
  <h1>访问日志</h1>
  <p class="sub">Facet 加密交付 · 谁看了、什么时候看的、用什么设备</p>

  <div class="stats">
    <div class="stat"><span class="n">${uniqueIps}</span><span class="l">独立 IP</span></div>
    <div class="stat"><span class="n">${totalViews}</span><span class="l">页面浏览</span></div>
    <div class="stat"><span class="n">${totalLogins}</span><span class="l">登录成功</span></div>
    <div class="stat"><span class="n">${totalFailures}</span><span class="l">密码错误</span></div>
  </div>

  <div class="actions">
    <a class="btn" href="?token=${encodeURIComponent(token)}&format=csv">下载 CSV</a>
    <a class="btn ghost" href="?token=${encodeURIComponent(token)}">刷新</a>
  </div>

  <h2>按 IP 聚合（谁看得最多）</h2>
  ${byIp.length === 0 ? '<div class="empty">暂无访问记录</div>' : `
  <table>
    <thead><tr><th>IP</th><th>地区</th><th>设备</th><th>浏览</th><th>登录</th><th>错误</th><th>首次</th><th>最近</th><th>访问路径</th></tr></thead>
    <tbody>
      ${byIp.map((e) => `<tr>
        <td><code>${escapeHtml(e.ip)}</code></td>
        <td>${escapeHtml(e.country || "-")}</td>
        <td>${escapeHtml(e.device)}</td>
        <td>${e.views}</td>
        <td>${e.logins}</td>
        <td>${e.failures > 0 ? `<span class="badge fail">${e.failures}</span>` : "0"}</td>
        <td>${formatTime(e.firstSeen)}</td>
        <td>${formatTime(e.lastSeen)}</td>
        <td>${e.paths.map((p) => `<code>${escapeHtml(p)}</code>`).join(" ")}</td>
      </tr>`).join("")}
    </tbody>
  </table>`}

  <h2>最近 100 条明细</h2>
  ${logs.length === 0 ? '<div class="empty">暂无访问记录</div>' : `
  <table>
    <thead><tr><th>时间</th><th>事件</th><th>IP</th><th>地区</th><th>设备</th><th>路径</th><th>UA</th></tr></thead>
    <tbody>
      ${logs.slice(0, 100).map((l) => `<tr>
        <td>${formatTime(l.timestamp)}</td>
        <td><span class="badge ${l.event === "login" ? "login" : l.event === "login_failed" ? "fail" : "view"}">${
          l.event === "login" ? "登录" : l.event === "login_failed" ? "密码错误" : "浏览"
        }</span></td>
        <td><code>${escapeHtml(l.ip)}</code></td>
        <td>${escapeHtml(l.country || "-")}</td>
        <td>${escapeHtml(l.device)}</td>
        <td><code>${escapeHtml(l.path)}</code></td>
        <td style="color:var(--muted);font-size:12px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml((l.userAgent || "").slice(0, 80))}</td>
      </tr>`).join("")}
    </tbody>
  </table>`}
</div>
</body>
</html>`;
}

function renderCsv(logs) {
  const header = "timestamp,event,ip,country,device,path,referer,userAgent";
  const rows = logs.map((l) =>
    [l.timestamp, l.event, l.ip, l.country, l.device, l.path, l.referer, (l.userAgent || "").replace(/,/g, ";")]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header, ...rows].join("\n");
}

function renderUnauthorized() {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>403</title>
<style>body{font-family:system-ui;padding:60px;text-align:center;color:#5f6b76}h1{font-size:22px}</style></head>
<body><h1>403 · 需要管理员 token</h1><p>访问方式：<code>/admin/access-log?token=你的ADMIN_TOKEN</code></p></body></html>`;
}

function formatTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
