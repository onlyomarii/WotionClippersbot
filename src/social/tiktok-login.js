import { config } from '../config.js';
import { getTikTokConnectionForUserId, updateTikTokConnection } from '../storage.js';

const scopes = ['user.info.profile', 'user.info.stats', 'video.list'];

function base64UrlEncode(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export async function createPkcePair() {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(64));
  const codeVerifier = base64UrlEncode(verifierBytes);
  const challengeBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));

  return {
    codeVerifier,
    codeChallenge: base64UrlEncode(challengeBytes)
  };
}

export function getTikTokRedirectUri() {
  if (config.tiktokRedirectUri) return config.tiktokRedirectUri;
  if (config.publicBaseUrl) return `${config.publicBaseUrl.replace(/\/$/, '')}/auth/tiktok/callback`;
  return `http://localhost:${config.port}/auth/tiktok/callback`;
}

export function createTikTokAuthUrl(state, codeChallenge) {
  const redirectUri = getTikTokRedirectUri();
  const url = new URL('https://www.tiktok.com/v2/auth/authorize/');

  url.searchParams.set('client_key', config.tiktokClientKey);
  url.searchParams.set('scope', scopes.join(','));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  return url.toString();
}

export function hasTikTokLoginConfig() {
  return Boolean(config.tiktokClientKey && config.tiktokClientSecret);
}

export async function exchangeTikTokCode(code, codeVerifier) {
  const body = new URLSearchParams({
    client_key: config.tiktokClientKey,
    client_secret: config.tiktokClientSecret,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: getTikTokRedirectUri()
  });

  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache'
    },
    body,
    signal: AbortSignal.timeout(15000)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error) {
    throw new Error(data.error_description || data.error || `TikTok token exchange failed: ${response.status}`);
  }

  return data;
}

export async function refreshTikTokUserToken(userId, connection) {
  if (!connection?.refreshToken) return null;

  const body = new URLSearchParams({
    client_key: config.tiktokClientKey,
    client_secret: config.tiktokClientSecret,
    grant_type: 'refresh_token',
    refresh_token: connection.refreshToken
  });

  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache'
    },
    body,
    signal: AbortSignal.timeout(15000)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error) return null;

  return updateTikTokConnection(userId, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? connection.refreshToken,
    accessTokenExpiresAt: new Date(Date.now() + Number(data.expires_in ?? 86400) * 1000).toISOString(),
    refreshTokenExpiresAt: new Date(Date.now() + Number(data.refresh_expires_in ?? 31536000) * 1000).toISOString(),
    scope: data.scope ?? connection.scope
  });
}

export async function getValidTikTokConnection(userId) {
  const connection = await getTikTokConnectionForUserId(userId);

  if (!connection) return null;

  const expiresAt = new Date(connection.accessTokenExpiresAt).getTime();
  if (expiresAt > Date.now() + 60000) return connection;

  return refreshTikTokUserToken(userId, connection);
}

export async function fetchTikTokUserInfo(accessToken) {
  const endpoint = new URL('https://open.tiktokapis.com/v2/user/info/');
  endpoint.searchParams.set('fields', 'open_id,union_id,avatar_url,display_name,bio_description,profile_deep_link,is_verified,username,follower_count,following_count,likes_count,video_count');

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    signal: AbortSignal.timeout(15000)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error?.code !== 'ok') {
    throw new Error(data.error?.message || `TikTok user info failed: ${response.status}`);
  }

  return data.data?.user ?? {};
}

export async function fetchTikTokVideos(accessToken) {
  const endpoint = new URL('https://open.tiktokapis.com/v2/video/list/');
  endpoint.searchParams.set('fields', 'id,create_time,cover_image_url,share_url,video_description,duration,height,width,title,embed_link,like_count,comment_count,share_count,view_count');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      max_count: 20
    }),
    signal: AbortSignal.timeout(15000)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error?.code !== 'ok') {
    throw new Error(data.error?.message || `TikTok video list failed: ${response.status}`);
  }

  return data.data?.videos ?? [];
}
