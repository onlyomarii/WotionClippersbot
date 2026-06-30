import { config } from './config.js';
import { getWebsitePosts } from './storage.js';

function websiteUrl() {
  return config.websiteUrl?.replace(/\/$/, '');
}

function websiteApiKey() {
  return config.websiteApiKey;
}

function postPayload(post) {
  return {
    video_id: post.video_id || '',
    discord_id: post.discord_id || '',
    discord_username: post.discord_username || '',
    tiktok_user: post.tiktok_user || '',
    platform: post.platform || 'tiktok',
    url: post.url || '',
    view_count: Number(post.view_count ?? 0),
    like_count: Number(post.like_count ?? 0),
    payout: Number(post.payout ?? 0),
  };
}

export async function pushViewsToWebsite(discordUsername, views) {
  const baseUrl = websiteUrl();
  const apiKey = websiteApiKey();

  if (!baseUrl || !apiKey) {
    console.warn('[Website Push] Missing WEBSITE_URL or WEBSITE_API_KEY. Skipping views push.');
    return null;
  }

  try {
    const response = await fetch(`${baseUrl}/api/bot/views`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        discord_username: discordUsername,
        views,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(`[Website Push] Views push failed for ${discordUsername}:`, data);
      return null;
    }

    console.log(`[Website Push] Views updated for ${discordUsername}:`, data);
    return data;
  } catch (error) {
    console.error(`[Website Push] Views push failed for ${discordUsername}:`, error.message);
    return null;
  }
}

export async function pushPostsToWebsite(posts = null) {
  const baseUrl = websiteUrl();
  const apiKey = websiteApiKey();

  if (!baseUrl || !apiKey) {
    console.warn('[Website Push] Missing WEBSITE_URL or WEBSITE_API_KEY. Skipping posts push.');
    return null;
  }

  const sourcePosts = posts ?? await getWebsitePosts(10000);
  const payload = {
    posts: sourcePosts.map(postPayload),
  };

  try {
    const response = await fetch(`${baseUrl}/api/bot/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[Website Push] Posts push failed:', data);
      return null;
    }

    console.log(`[Website Push] Sent ${payload.posts.length} post row${payload.posts.length === 1 ? '' : 's'} to website:`, data);
    return data;
  } catch (error) {
    console.error('[Website Push] Posts push failed:', error.message);
    return null;
  }
}

export function startWebsitePostPushTimer() {
  if (config.websitePushEnabled === 'false') return null;
  if (!websiteUrl() || !websiteApiKey()) {
    console.warn('[Website Push] Missing WEBSITE_URL or WEBSITE_API_KEY. Timer not started.');
    return null;
  }

  const minutes = Number.isFinite(config.websitePushIntervalMinutes)
    ? config.websitePushIntervalMinutes
    : 5;
  const intervalMs = Math.max(1, minutes) * 60 * 1000;

  const push = () => {
    pushPostsToWebsite().catch((error) => {
      console.error('[Website Push] Timer failed:', error.message);
    });
  };

  push();
  return setInterval(push, intervalMs);
}
