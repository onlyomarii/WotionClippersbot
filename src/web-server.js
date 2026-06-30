import { createServer } from 'node:http';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { adminStatsSummary, consumeTikTokOAuthState, getWebsitePosts, getWebsiteStats, leaderboard, saveTikTokConnection } from './storage.js';
import { exchangeTikTokCode, fetchTikTokUserInfo, getTikTokRedirectUri } from './social/tiktok-login.js';
import { sendAuditLog } from './audit-log.js';

const webServerVersion = '2026-06-01-tiktok-verification-fallback';

function htmlPage(title, message) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; background: #f6f7f9; color: #171717; }
    main { max-width: 680px; margin: 0 auto; padding: 56px 20px; }
    section { background: #fff; border: 1px solid #dfe3ea; border-radius: 8px; padding: 24px; }
    h1 { margin: 0 0 12px; font-size: 28px; }
    p { margin: 0; line-height: 1.6; }
  </style>
</head>
<body>
  <main>
    <section>
      <h1>${title}</h1>
      <p>${message}</p>
    </section>
  </main>
</body>
</html>`;
}

function sendHtml(response, statusCode, title, message) {
  response.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(htmlPage(title, message));
}

function parseAllowedOrigins() {
  return (config.websiteAllowedOrigins || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function allowedOrigin(request) {
  const allowed = parseAllowedOrigins();
  if (!allowed.length) return '*';

  const origin = request.headers.origin;
  if (!origin) return '*';
  return allowed.includes(origin) ? origin : null;
}

function isWebsiteAuthorized(request) {
  if (!config.websiteApiKey) return true;

  const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  const headerKey = request.headers['x-api-key'];
  return bearer === config.websiteApiKey || headerKey === config.websiteApiKey;
}

function sendJson(response, statusCode, data, origin = '*') {
  const body = JSON.stringify(data);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': origin || 'null',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  });
  response.end(body);
}

function normalizeLimit(url, fallback = 100, max = 500) {
  const raw = Number(url.searchParams.get('limit') || fallback);
  if (!Number.isFinite(raw) || raw < 1) return fallback;
  return Math.min(Math.floor(raw), max);
}

async function handleWebsiteApi(request, response, url) {
  if (config.websiteApiEnabled === 'false') return false;
  if (!url.pathname.startsWith('/api/')) return false;

  const origin = allowedOrigin(request);

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {}, origin || '*');
    return true;
  }

  if (!origin) {
    sendJson(response, 403, { error: 'Origin not allowed' }, 'null');
    return true;
  }

  if (!isWebsiteAuthorized(request)) {
    sendJson(response, 401, { error: 'Unauthorized' }, origin);
    return true;
  }

  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'Method not allowed' }, origin);
    return true;
  }

  if (url.pathname === '/api/health') {
    sendJson(response, 200, { ok: true }, origin);
    return true;
  }

  if (url.pathname === '/api/stats') {
    sendJson(response, 200, await getWebsiteStats(), origin);
    return true;
  }

  if (url.pathname === '/api/leaderboard') {
    const result = await leaderboard();
    sendJson(response, 200, { cycle: result.cycle, leaderboard: result.rows }, origin);
    return true;
  }

  if (url.pathname === '/api/admin-stats') {
    sendJson(response, 200, { users: await adminStatsSummary() }, origin);
    return true;
  }

  if (url.pathname === '/api/posts' || url.pathname === '/api/raw-posts') {
    sendJson(response, 200, { posts: await getWebsitePosts(normalizeLimit(url, 100, 10000)) }, origin);
    return true;
  }

  sendJson(response, 404, { error: 'Not found' }, origin);
  return true;
}

export function startWebServer(client = null) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (await handleWebsiteApi(request, response, url)) {
      return;
    }

    if (url.pathname === '/debug-public') {
      let files = [];
      let publicFolderStatus = 'ok';

      try {
        files = await readdir(path.join(process.cwd(), 'public'));
      } catch {
        publicFolderStatus = 'not found';
      }

      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({
        version: webServerVersion,
        cwd: process.cwd(),
        publicFolderStatus,
        files
      }, null, 2));
      return;
    }

    if (!url.pathname.includes('..') && path.extname(url.pathname) === '.txt') {
      try {
        const filePath = path.join(process.cwd(), 'public', path.basename(url.pathname));
        const content = await readFile(filePath, 'utf8');
        response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end(content);
      } catch {
        const match = path.basename(url.pathname).match(/^tiktok(.+)\.txt$/);

        if (match) {
          response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          response.end(`tiktok-developers-site-verification=${match[1]}`);
          return;
        }

        sendHtml(response, 404, 'Verification File Not Found', 'The verification file was not found.');
      }
      return;
    }

    if (url.pathname === '/') {
      sendHtml(response, 200, 'WotionClippersbot', 'WotionClippersbot is running. You can return to Discord.');
      return;
    }

    if (url.pathname !== '/auth/tiktok/callback') {
      sendHtml(response, 404, 'Not Found', 'This page does not exist.');
      return;
    }

    const error = url.searchParams.get('error');
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (error) {
      sendHtml(response, 400, 'TikTok Connection Cancelled', `TikTok returned an error: ${error}`);
      return;
    }

    if (!code || !state) {
      sendHtml(response, 400, 'TikTok Connection Failed', 'Missing TikTok authorization code or state.');
      return;
    }

    try {
      const stateRecord = await consumeTikTokOAuthState(state);

      if (!stateRecord) {
        sendHtml(response, 400, 'TikTok Connection Expired', 'This connection link expired. Please run /connect-tiktok again in Discord.');
        return;
      }

      const tokenData = await exchangeTikTokCode(code, stateRecord.codeVerifier);
      const profile = await fetchTikTokUserInfo(tokenData.access_token);
      await saveTikTokConnection(stateRecord.userId, tokenData, profile);
      if (client) {
        await sendAuditLog(client, {
          title: 'TikTok Connected',
          color: 0x27ae60,
          fields: [
            { name: 'User ID', value: stateRecord.userId, inline: false },
            { name: 'TikTok', value: profile.username ? `@${profile.username}` : profile.display_name ?? tokenData.open_id ?? 'Unknown', inline: true }
          ]
        });
      }

      sendHtml(response, 200, 'TikTok Connected', 'Your TikTok account is connected to WotionClippersbot. You can return to Discord and use /tiktok-status.');
    } catch (callbackError) {
      console.error('TikTok callback failed:', callbackError);
      sendHtml(response, 500, 'TikTok Connection Failed', 'WotionClippersbot could not finish the TikTok connection. Please check the bot logs and try again.');
    }
  });

  server.listen(config.port, () => {
    console.log(`Web callback server listening on port ${config.port}`);
    console.log(`TikTok redirect URI: ${getTikTokRedirectUri()}`);
    readdir(path.join(process.cwd(), 'public'))
      .then((files) => console.log(`Public files: ${files.join(', ') || '(none)'}`))
      .catch(() => console.log('Public files: public folder not found'));
  });

  return server;
}
