import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const storePath = path.join(process.cwd(), 'data', 'store.json');

function emptyStore() {
  return {
    users: {},
    posts: {},
    cycles: {},
    activeCycleId: null,
    tiktokOAuthStates: {},
    snapshots: [],
    settings: {}
  };
}

function normalizeStore(store) {
  store.users ??= {};
  store.posts ??= {};
  store.cycles ??= {};
  store.activeCycleId ??= null;
  store.tiktokOAuthStates ??= {};
  store.snapshots ??= [];
  store.settings ??= {};
  return store;
}

function parseTikTokVideoIdFromLink(link) {
  try {
    const url = new URL(link);
    const pathMatch = url.pathname.match(/\/video\/(\d+)/);
    if (pathMatch) return pathMatch[1];

    const queryVideoId = url.searchParams.get('item_id') || url.searchParams.get('video_id');
    if (queryVideoId && /^\d+$/.test(queryVideoId)) return queryVideoId;
  } catch {
    return null;
  }

  return null;
}

async function loadStore() {
  try {
    const raw = await readFile(storePath, 'utf8');
    return normalizeStore(JSON.parse(raw));
  } catch (error) {
    if (error.code === 'ENOENT') return emptyStore();
    throw error;
  }
}

async function saveStore(store) {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

function getUser(store, discordUser) {
  const userId = discordUser.id;

  store.users[userId] ??= {
    id: userId,
    username: discordUser.tag,
    accounts: {},
    payments: {},
    createdAt: new Date().toISOString()
  };

  store.users[userId].username = discordUser.tag;
  return store.users[userId];
}

export async function readUser(discordUser) {
  const store = await loadStore();
  return getUser(store, discordUser);
}

export async function readUserById(userId) {
  const store = await loadStore();
  return store.users[userId] ?? null;
}

export async function addAccount(discordUser, platform, username) {
  const store = await loadStore();
  const user = getUser(store, discordUser);
  const verificationCode = `CLIP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  user.accounts[platform] = {
    platform,
    username,
    verificationCode,
    verified: false,
    addedAt: new Date().toISOString()
  };

  await saveStore(store);
  return user.accounts[platform];
}

export async function verifyAccount(discordUser, platform, username) {
  const store = await loadStore();
  const user = getUser(store, discordUser);
  const account = user.accounts[platform];

  if (!account || account.username.toLowerCase() !== username.toLowerCase()) {
    return null;
  }

  account.verified = true;
  account.verifiedAt = new Date().toISOString();
  await saveStore(store);
  return account;
}

export async function removeAccount(discordUser, platform, username) {
  const store = await loadStore();
  const user = getUser(store, discordUser);
  const account = user.accounts[platform];

  if (!account || account.username.toLowerCase() !== username.toLowerCase()) {
    return false;
  }

  delete user.accounts[platform];
  await saveStore(store);
  return true;
}

export async function setPayment(discordUser, platform, details) {
  const store = await loadStore();
  const user = getUser(store, discordUser);

  user.payments[platform] = {
    platform,
    ...details,
    updatedAt: new Date().toISOString()
  };

  await saveStore(store);
  return user.payments[platform];
}

export async function removePayment(discordUser, platform) {
  const store = await loadStore();
  const user = getUser(store, discordUser);

  if (!user.payments[platform]) return false;

  delete user.payments[platform];
  await saveStore(store);
  return true;
}

export async function createTikTokOAuthState(discordUser, codeVerifier) {
  const store = await loadStore();
  getUser(store, discordUser);

  const state = crypto.randomUUID();
  store.tiktokOAuthStates[state] = {
    state,
    userId: discordUser.id,
    codeVerifier,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
  };

  await saveStore(store);
  return state;
}

export async function consumeTikTokOAuthState(state) {
  const store = await loadStore();
  const record = store.tiktokOAuthStates[state];

  if (!record) return null;

  delete store.tiktokOAuthStates[state];
  await saveStore(store);

  if (new Date(record.expiresAt).getTime() < Date.now()) {
    return null;
  }

  return record;
}

export async function saveTikTokConnection(userId, tokenData, profile) {
  const store = await loadStore();
  store.users[userId] ??= {
    id: userId,
    username: userId,
    accounts: {},
    payments: {},
    createdAt: new Date().toISOString()
  };

  const user = store.users[userId];
  user.tiktok = {
    openId: tokenData.open_id,
    scope: tokenData.scope,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    tokenType: tokenData.token_type,
    accessTokenExpiresAt: new Date(Date.now() + Number(tokenData.expires_in ?? 86400) * 1000).toISOString(),
    refreshTokenExpiresAt: new Date(Date.now() + Number(tokenData.refresh_expires_in ?? 31536000) * 1000).toISOString(),
    profile,
    connectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (profile?.username) {
    user.accounts.tiktok = {
      platform: 'tiktok',
      username: profile.username,
      verificationCode: null,
      verified: true,
      addedAt: user.tiktok.connectedAt,
      verifiedAt: user.tiktok.connectedAt
    };
  }

  await saveStore(store);
  return user.tiktok;
}

export async function updateTikTokConnection(userId, updates) {
  const store = await loadStore();
  const user = store.users[userId];

  if (!user?.tiktok) return null;

  user.tiktok = {
    ...user.tiktok,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  await saveStore(store);
  return user.tiktok;
}

export async function getTikTokConnectionForUserId(userId) {
  const store = await loadStore();
  return store.users[userId]?.tiktok ?? null;
}

export async function removeTikTokConnection(discordUser) {
  const store = await loadStore();
  const user = getUser(store, discordUser);

  if (!user.tiktok) return false;

  delete user.tiktok;
  if (user.accounts?.tiktok) delete user.accounts.tiktok;
  await saveStore(store);
  return true;
}

export async function getCycleStatus() {
  const store = await loadStore();
  const activeCycle = store.activeCycleId ? store.cycles[store.activeCycleId] ?? null : null;
  const cycles = Object.values(store.cycles).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

  return {
    activeCycle,
    lastCycle: cycles[0] ?? null,
    totalCycles: cycles.length
  };
}

export async function startCycle(name, startedBy) {
  const store = await loadStore();

  if (store.activeCycleId && store.cycles[store.activeCycleId]?.status === 'active') {
    return { ok: false, cycle: store.cycles[store.activeCycleId] };
  }

  const id = crypto.randomUUID();
  const cycle = {
    id,
    name: name || `Cycle ${Object.keys(store.cycles).length + 1}`,
    status: 'active',
    startedAt: new Date().toISOString(),
    startedBy: startedBy.id,
    endedAt: null,
    endedBy: null
  };

  store.cycles[id] = cycle;
  store.activeCycleId = id;
  await saveStore(store);

  return { ok: true, cycle };
}

export async function endCycle(endedBy) {
  const store = await loadStore();
  const activeCycle = store.activeCycleId ? store.cycles[store.activeCycleId] ?? null : null;

  if (!activeCycle || activeCycle.status !== 'active') {
    return { ok: false, cycle: null };
  }

  activeCycle.status = 'ended';
  activeCycle.endedAt = new Date().toISOString();
  activeCycle.endedBy = endedBy.id;
  store.activeCycleId = null;
  store.posts = {};

  await saveStore(store);
  return { ok: true, cycle: activeCycle };
}

export async function addPosts(discordUser, links, campaignType = 'normal', tag = null) {
  const store = await loadStore();
  const user = getUser(store, discordUser);
  const added = [];
  const cycleId = store.activeCycleId ?? null;

  for (const link of links) {
    const id = crypto.randomUUID();
    store.posts[id] = {
      id,
      userId: user.id,
      link,
      videoId: parseTikTokVideoIdFromLink(link),
      platform: null,
      campaignType,
      tag,
      cycleId,
      views: 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    added.push(store.posts[id]);
  }

  await saveStore(store);
  return added;
}

export async function removePosts(discordUser, links) {
  const store = await loadStore();
  const user = getUser(store, discordUser);
  const normalized = new Set(links.map((link) => link.trim()));
  let removed = 0;

  for (const [postId, post] of Object.entries(store.posts)) {
    if (post.userId === user.id && normalized.has(post.link)) {
      delete store.posts[postId];
      removed += 1;
    }
  }

  await saveStore(store);
  return removed;
}

export async function removeAllPosts(discordUser) {
  const store = await loadStore();
  const user = getUser(store, discordUser);
  let removed = 0;

  for (const [postId, post] of Object.entries(store.posts)) {
    if (post.userId === user.id) {
      delete store.posts[postId];
      removed += 1;
    }
  }

  await saveStore(store);
  return removed;
}

export async function removePostsForUserId(userId, links, videoIds = []) {
  const store = await loadStore();
  const normalized = new Set(links.map((link) => link.trim()));
  const normalizedIds = new Set(videoIds.filter(Boolean));
  let removed = 0;

  for (const [postId, post] of Object.entries(store.posts)) {
    const postVideoId = post.videoId || parseTikTokVideoIdFromLink(post.link);

    if (
      post.userId === userId &&
      (normalized.has(post.link) || (postVideoId && normalizedIds.has(postVideoId)))
    ) {
      delete store.posts[postId];
      removed += 1;
    }
  }

  await saveStore(store);
  return removed;
}

export async function removeAllPostsForUserId(userId) {
  const store = await loadStore();
  let removed = 0;

  for (const [postId, post] of Object.entries(store.posts)) {
    if (post.userId === userId) {
      delete store.posts[postId];
      removed += 1;
    }
  }

  await saveStore(store);
  return removed;
}

export async function resetUserAccount(userId) {
  const store = await loadStore();
  const user = store.users[userId];
  let removedPosts = 0;

  for (const [postId, post] of Object.entries(store.posts)) {
    if (post.userId === userId) {
      delete store.posts[postId];
      removedPosts += 1;
    }
  }

  if (user) {
    delete user.tiktok;
    if (user.accounts?.tiktok) delete user.accounts.tiktok;
  }

  await saveStore(store);
  return { user, removedPosts };
}

export async function listUserPosts(discordUser) {
  const store = await loadStore();
  const user = getUser(store, discordUser);
  return Object.values(store.posts).filter((post) => post.userId === user.id);
}

export async function listPostsForUserId(userId) {
  const store = await loadStore();
  const posts = Object.values(store.posts).filter((post) => post.userId === userId);

  return {
    user: store.users[userId] ?? { id: userId, username: userId },
    posts,
    cycles: store.cycles
  };
}

export async function adminStatsSummary() {
  const store = await loadStore();
  const rows = new Map();

  for (const post of Object.values(store.posts)) {
    const current = rows.get(post.userId) ?? {
      userId: post.userId,
      username: store.users[post.userId]?.username ?? post.userId,
      posts: 0,
      views: 0,
      payout: 0,
      tracked: 0,
      pending: 0
    };

    current.posts += 1;
    current.views += Number(post.views ?? 0);
    current.payout += post.views >= 5000000 ? 500 : post.views >= 1000000 ? 100 : post.views >= 500000 ? 50 : post.views >= 100000 ? 10 : 0;
    if (post.status === 'tracked') current.tracked += 1;
    if (post.status !== 'tracked') current.pending += 1;
    rows.set(post.userId, current);
  }

  return Array.from(rows.values()).sort((a, b) => b.views - a.views);
}

export async function leaderboard() {
  const store = await loadStore();
  const rows = new Map();
  const activeCycle = store.activeCycleId ? store.cycles[store.activeCycleId] ?? null : null;

  for (const post of Object.values(store.posts)) {
    if (activeCycle && post.cycleId !== activeCycle.id) continue;

    const current = rows.get(post.userId) ?? {
      userId: post.userId,
      username: store.users[post.userId]?.username ?? post.userId,
      posts: 0,
      views: 0,
      payout: 0
    };

    current.posts += 1;
    current.views += Number(post.views ?? 0);
    current.payout += post.views >= 5000000 ? 500 : post.views >= 1000000 ? 100 : post.views >= 500000 ? 50 : post.views >= 100000 ? 10 : 0;
    rows.set(post.userId, current);
  }

  return {
    cycle: activeCycle,
    rows: Array.from(rows.values()).sort((a, b) => b.views - a.views)
  };
}

export async function updatePostStats(updates) {
  const store = await loadStore();

  for (const update of updates) {
    const post = store.posts[update.id];
    if (!post) continue;

    post.views = update.views;
    post.platform = update.platform ?? post.platform;
    post.status = update.status;
    post.updatedAt = new Date().toISOString();

    store.snapshots.push({
      postId: post.id,
      views: post.views,
      status: post.status,
      createdAt: new Date().toISOString()
    });
  }

  await saveStore(store);
}

export async function listAllPosts() {
  const store = await loadStore();
  return Object.values(store.posts);
}

export async function listAllUsersWithPosts() {
  const store = await loadStore();
  return Object.values(store.users).map((user) => {
    const posts = Object.values(store.posts).filter((post) => post.userId === user.id);
    const latestPost = posts
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] ?? null;

    return {
      user,
      posts,
      postCount: posts.length,
      latestUploadAt: latestPost?.createdAt ?? null
    };
  });
}

export async function setUploadsPaused(paused) {
  const store = await loadStore();
  store.settings.uploadsPaused = Boolean(paused);
  store.settings.uploadsPausedUpdatedAt = new Date().toISOString();
  await saveStore(store);
  return store.settings.uploadsPaused;
}

export async function areUploadsPaused() {
  const store = await loadStore();
  return Boolean(store.settings.uploadsPaused);
}
