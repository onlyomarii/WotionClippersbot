import { detectPlatformFromUrl } from '../platforms.js';
import { listAllPosts, updatePostStats } from '../storage.js';
import { getTikTokViews } from './tiktok.js';
import { getYouTubeViews } from './youtube.js';
import { pushPostsToWebsite } from '../website-push.js';

export async function refreshStats(userId = null) {
  const allPosts = await listAllPosts();
  const posts = userId ? allPosts.filter((post) => post.userId === userId) : allPosts;
  const updates = [];

  for (const post of posts) {
    const platform = detectPlatformFromUrl(post.link);

    if (platform === 'youtube') {
      const result = await getYouTubeViews(post.link);
      updates.push({
        id: post.id,
        platform,
        views: result.views,
        status: result.status
      });
      continue;
    }

    if (platform === 'tiktok') {
      const result = await getTikTokViews(post.link, post.userId);
      updates.push({
        id: post.id,
        platform,
        views: result.views,
        status: result.status
      });
      continue;
    }

    updates.push({
      id: post.id,
      platform,
      views: post.views ?? 0,
      status: platform === 'unknown' ? 'invalid_link' : 'manual_api_needed'
    });
  }

  await updatePostStats(updates);
  await pushPostsToWebsite();
  return updates;
}
