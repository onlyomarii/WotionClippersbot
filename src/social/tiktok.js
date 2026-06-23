import { config } from '../config.js';
import { fetchTikTokVideos, getValidTikTokConnection } from './tiktok-login.js';

let cachedToken = null;

function yyyymmdd(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function defaultDateWindow() {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);

  return {
    startDate: yyyymmdd(start),
    endDate: yyyymmdd(end)
  };
}

export function parseTikTokVideoId(link) {
  let url;

  try {
    url = new URL(link);
  } catch {
    return null;
  }

  const pathMatch = url.pathname.match(/\/video\/(\d+)/);
  if (pathMatch) return pathMatch[1];

  const queryVideoId = url.searchParams.get('item_id') || url.searchParams.get('video_id');
  if (queryVideoId && /^\d+$/.test(queryVideoId)) return queryVideoId;

  return null;
}

export async function resolveTikTokVideoId(link) {
  const directId = parseTikTokVideoId(link);
  if (directId) return directId;

  try {
    const response = await fetch(link, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(10000)
    });

    return parseTikTokVideoId(response.url);
  } catch {
    return null;
  }
}

async function getClientAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.accessToken;
  }

  const body = new URLSearchParams({
    client_key: config.tiktokResearchClientKey,
    client_secret: config.tiktokResearchClientSecret,
    grant_type: 'client_credentials'
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

  if (!response.ok || !data.access_token) {
    return null;
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in ?? 7200) * 1000
  };

  return cachedToken.accessToken;
}

async function getTikTokViewsFromConnectedAccount(link, userId) {
  const videoId = await resolveTikTokVideoId(link);

  if (!videoId || !userId) return null;

  const connection = await getValidTikTokConnection(userId);
  if (!connection) return null;

  try {
    const videos = await fetchTikTokVideos(connection.accessToken);
    const video = videos.find((item) => item.id === videoId || item.share_url === link);

    if (!video) {
      return { status: 'tiktok_not_found_in_connected_account', views: 0 };
    }

    return {
      status: 'tracked',
      views: Number(video.view_count ?? 0)
    };
  } catch {
    return { status: 'tiktok_login_api_error', views: 0 };
  }
}

export async function getTikTokViews(link, userId = null) {
  const connectedResult = await getTikTokViewsFromConnectedAccount(link, userId);
  if (connectedResult) return connectedResult;

  if (!config.tiktokResearchClientKey || !config.tiktokResearchClientSecret) {
    return { status: userId ? 'needs_tiktok_connection_or_research_keys' : 'needs_tiktok_research_api_keys', views: 0 };
  }

  const videoId = await resolveTikTokVideoId(link);

  if (!videoId) {
    return { status: 'tiktok_video_id_not_found', views: 0 };
  }

  const token = await getClientAccessToken();

  if (!token) {
    return { status: 'tiktok_token_error', views: 0 };
  }

  const { startDate, endDate } = defaultDateWindow();
  const endpoint = new URL('https://open.tiktokapis.com/v2/research/video/query/');
  endpoint.searchParams.set('fields', 'id,view_count,like_count,comment_count,share_count,username,create_time');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: {
        and: [
          {
            operation: 'EQ',
            field_name: 'video_id',
            field_values: [videoId]
          }
        ]
      },
      max_count: 1,
      cursor: 0,
      start_date: startDate,
      end_date: endDate,
      is_random: false
    }),
    signal: AbortSignal.timeout(15000)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { status: `tiktok_error_${response.status}`, views: 0 };
  }

  const video = data.data?.videos?.[0];

  if (!video) {
    return { status: 'tiktok_not_found_in_recent_window', views: 0 };
  }

  return {
    status: 'tracked',
    views: Number(video.view_count ?? 0)
  };
}
