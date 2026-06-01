import { config } from '../config.js';

export function parseYouTubeVideoId(link) {
  let url;

  try {
    url = new URL(link);
  } catch {
    return null;
  }

  if (url.hostname.includes('youtu.be')) {
    return url.pathname.split('/').filter(Boolean)[0] ?? null;
  }

  if (url.searchParams.has('v')) {
    return url.searchParams.get('v');
  }

  const parts = url.pathname.split('/').filter(Boolean);
  const shortsIndex = parts.indexOf('shorts');

  if (shortsIndex >= 0) {
    return parts[shortsIndex + 1] ?? null;
  }

  return null;
}

export async function getYouTubeViews(link) {
  const videoId = parseYouTubeVideoId(link);

  if (!videoId) {
    return { status: 'invalid_link', views: 0 };
  }

  if (!config.youtubeApiKey) {
    return { status: 'needs_youtube_api_key', views: 0 };
  }

  const endpoint = new URL('https://www.googleapis.com/youtube/v3/videos');
  endpoint.searchParams.set('part', 'statistics');
  endpoint.searchParams.set('id', videoId);
  endpoint.searchParams.set('key', config.youtubeApiKey);

  const response = await fetch(endpoint);

  if (!response.ok) {
    return { status: `youtube_error_${response.status}`, views: 0 };
  }

  const data = await response.json();
  const item = data.items?.[0];

  if (!item) {
    return { status: 'not_found', views: 0 };
  }

  return {
    status: 'tracked',
    views: Number(item.statistics?.viewCount ?? 0)
  };
}
