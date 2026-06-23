import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags
} from 'discord.js';
import { config, requireConfig } from './config.js';
import { calculatePayout, compactNumber, formatNumber, formatPayout, maskValue, parseLinks } from './format.js';
import {
  addAccount,
  addPosts,
  adminStatsSummary,
  areUploadsPaused,
  createTikTokOAuthState,
  endCycle,
  getTikTokConnectionForUserId,
  getCycleStatus,
  leaderboard,
  listAllUsersWithPosts,
  listPostsForUserId,
  listUserPosts,
  readUser,
  readUserById,
  removeAccount,
  removeAllPosts,
  removePostsForUserId,
  removePayment,
  removePosts,
  removeTikTokConnection,
  resetUserAccount,
  setUploadsPaused,
  setPayment,
  startCycle,
  verifyAccount
} from './storage.js';
import { refreshStats } from './social/tracker.js';
import { resolveTikTokVideoId } from './social/tiktok.js';
import { createPkcePair, createTikTokAuthUrl, getTikTokRedirectUri, hasTikTokLoginConfig } from './social/tiktok-login.js';
import { startWebServer } from './web-server.js';

requireConfig(['discordToken']);

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

function accountSummaryEmbed(user, posts) {
  const accounts = Object.values(user.accounts ?? {});
  const payments = Object.values(user.payments ?? {});
  const totalViews = posts.reduce((sum, post) => sum + Number(post.views ?? 0), 0);

  return new EmbedBuilder()
    .setTitle('Account Summary')
    .setColor(0x2f80ed)
    .addFields(
      {
        name: 'Social Accounts',
        value: accounts.length
          ? accounts.map((account) => `${account.platform}: ${account.username} (${account.verified ? 'verified' : 'pending'})`).join('\n')
          : 'No social accounts linked yet.'
      },
      {
        name: 'Payment Details',
        value: payments.length
          ? payments.map((payment) => `${payment.platform}: saved`).join('\n')
          : 'No payment details saved yet.'
      },
      {
        name: 'Tracked Posts',
        value: `${posts.length} posts, ${formatNumber(totalViews)} total views`
      }
    );
}

function helpEmbed() {
  return new EmbedBuilder()
    .setTitle('WotionClippersbot Command Guide')
    .setColor(0x2f80ed)
    .addFields(
      {
        name: 'Account Summary',
        value: '`/account-info` - View your linked accounts, payment setup, and tracked post totals.'
      },
      {
        name: 'Social Media Accounts',
        value: [
          '`/connect-tiktok` - Connect TikTok with Login Kit. Use this for TikTok.',
          '`/tiktok-status` - Check your TikTok connection.',
          '`/remove-tiktok` - Remove your TikTok connection.',
          '`/add-account platform username` - Manually link non-TikTok social accounts.',
          '`/verify-status platform username` - Check or complete manual account verification.',
          '`/remove-account platform username` - Unlink a manual social account.'
        ].join('\n')
      },
      {
        name: 'TikTok Flow',
        value: [
          '`/connect-tiktok` - Connect your TikTok account.',
          '`/tiktok-status` - Check your TikTok connection.',
          '`/upload links` - Submit your TikTok video link after connecting.',
          '`/stats` - View your tracked TikTok posts.'
        ].join('\n')
      },
      {
        name: 'Payment Details',
        value: [
          '`/add-paypal paypal_email first_name last_name` - Save PayPal payout details.',
          '`/payment-details` - View your saved payout methods.',
          '`/remove-payment-details platform` - Remove a saved payout method.'
        ].join('\n')
      },
      {
        name: 'Uploading Posts',
        value: [
          '`/upload links` - Add up to 20 social media links for tracking.',
          '`/bounty-upload links tag` - Add up to 20 bounty links with a tag.',
          '`/remove-video links` - Remove up to 20 tracked links.',
          '`/remove-all-videos confirm:true` - Remove all of your tracked videos.'
        ].join('\n')
      },
      {
        name: 'Checking Stats',
        value: [
          '`/stats` - View stats for your tracked posts.',
          '`/leaderboard` - View rankings for the current cycle.',
          "`/admin-stats user` - Admin only: view one user's tracked posts.",
          '`/admin-all-stats` - Admin only: view all-user totals.',
          '`/admin-account-info user` - Admin only: view a user account summary.',
          '`/admin-payment-details user` - Admin only: view user payout details.',
          '`/admin-remove-video user links` - Admin only: remove links from a user.',
          '`/admin-reset-user-account user confirm:true` - Admin only: remove TikTok and videos.',
          '`/admin-inactivity` - Admin only: check upload activity.',
          '`/refresh-stats` - Admin only: refresh all view counts now.',
          '`/admin-refresh-user-stats user` - Admin only: refresh one user.'
        ].join('\n')
      },
      {
        name: 'Admin Upload Control',
        value: [
          '`/admin-pause-uploads` - Pause clip submissions.',
          '`/admin-unpause-uploads` - Allow clip submissions again.'
        ].join('\n')
      },
      {
        name: 'Cycles',
        value: [
          '`/cycle-status` - View the active cycle.',
          '`/cycle-start name` - Admin only: start a new cycle.',
          '`/cycle-end` - Admin only: end the active cycle.'
        ].join('\n')
      }
    )
    .setFooter({ text: 'Separate multiple links with commas. Maximum 20 links per upload command.' });
}

const pageSize = 10;

function pageCount(total) {
  return Math.max(1, Math.ceil(total / pageSize));
}

function pageRows(rows, page) {
  return rows.slice(page * pageSize, page * pageSize + pageSize);
}

function paginationRows(kind, page, totalPages) {
  if (totalPages <= 1) return [];

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`page:${kind}:${page - 1}`)
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 0),
      new ButtonBuilder()
        .setCustomId(`page:${kind}:${page + 1}`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= totalPages - 1)
    )
  ];
}

function leaderboardEmbed(result, page = 0) {
  const totalPages = pageCount(result.rows.length);
  const rows = pageRows(result.rows, page);
  const totalViews = result.rows.reduce((sum, row) => sum + Number(row.views ?? 0), 0);
  const totalPosts = result.rows.reduce((sum, row) => sum + Number(row.posts ?? 0), 0);

  const description = rows.map((row, index) => {
    const rank = page * pageSize + index + 1;
    return `#${rank} ${row.username}: ${compactNumber(row.views)} views | $${row.payout ?? 0} | ${row.posts} post(s)`;
  }).join('\n');

  return new EmbedBuilder()
    .setTitle(result.cycle ? `Leaderboard - ${result.cycle.name}` : 'Leaderboard')
    .setColor(0x27ae60)
    .setDescription(description)
    .addFields(
      { name: 'Grand Total Views', value: compactNumber(totalViews), inline: true },
      { name: 'Total Posts', value: String(totalPosts), inline: true },
      { name: 'Total Users', value: String(result.rows.length), inline: true }
    )
    .setFooter({ text: `Page ${page + 1}/${totalPages} | ${result.rows.length} total users` });
}

async function adminAllStatsEmbed(page = 0) {
  const rows = await adminStatsSummary();
  const totalPages = pageCount(rows.length);
  const description = pageRows(rows, page).map((row, index) => {
    const rank = page * pageSize + index + 1;
    return `#${rank} ${row.username}: ${compactNumber(row.views)} views | $${row.payout ?? 0} | ${row.posts} post(s) | ${row.tracked} tracked | ${row.pending} pending/manual`;
  }).join('\n');

  return {
    rows,
    embed: new EmbedBuilder()
      .setTitle('Admin Stats Summary')
      .setColor(0xf2994a)
      .setDescription(description || 'No users have tracked posts yet.')
      .setFooter({ text: `Page ${page + 1}/${totalPages} | ${rows.length} total users` })
  };
}

async function inactivityEmbed(page = 0) {
  const rows = (await listAllUsersWithPosts()).sort((a, b) => a.postCount - b.postCount || String(a.user.username).localeCompare(String(b.user.username)));
  const totalPages = pageCount(rows.length);
  const description = pageRows(rows, page).map((row, index) => {
    const rank = page * pageSize + index + 1;
    const latest = row.latestUploadAt ? new Date(row.latestUploadAt).toLocaleString() : 'never';
    return `#${rank} ${row.user.username}: ${row.postCount} post(s) | last upload: ${latest}`;
  }).join('\n');

  return {
    rows,
    embed: new EmbedBuilder()
      .setTitle('Admin Inactivity')
      .setColor(0xeb5757)
      .setDescription(description || 'No users found yet.')
      .setFooter({ text: `Page ${page + 1}/${totalPages} | ${rows.length} total users` })
  };
}

async function handleInteraction(interaction) {
  if (interaction.isButton()) {
    const [prefix, kind, pageValue] = interaction.customId.split(':');
    if (prefix !== 'page') return;

    const page = Math.max(0, Number(pageValue) || 0);

    if (kind === 'leaderboard') {
      const result = await leaderboard();
      const totalPages = pageCount(result.rows.length);
      await interaction.update({
        embeds: [leaderboardEmbed(result, Math.min(page, totalPages - 1))],
        components: paginationRows('leaderboard', Math.min(page, totalPages - 1), totalPages)
      });
      return;
    }

    if (kind === 'adminall') {
      const result = await adminAllStatsEmbed(page);
      const totalPages = pageCount(result.rows.length);
      await interaction.update({
        embeds: [result.embed],
        components: paginationRows('adminall', Math.min(page, totalPages - 1), totalPages)
      });
      return;
    }

    if (kind === 'inactivity') {
      const result = await inactivityEmbed(page);
      const totalPages = pageCount(result.rows.length);
      await interaction.update({
        embeds: [result.embed],
        components: paginationRows('inactivity', Math.min(page, totalPages - 1), totalPages)
      });
      return;
    }

    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  const isPublicCommand = commandName === 'leaderboard';

  await interaction.deferReply(isPublicCommand ? {} : { flags: MessageFlags.Ephemeral });

  if (commandName === 'help') {
    await interaction.editReply({ embeds: [helpEmbed()] });
    return;
  }

  if (commandName === 'account-info') {
    const user = await readUser(interaction.user);
    const posts = await listUserPosts(interaction.user);
    await interaction.editReply({ embeds: [accountSummaryEmbed(user, posts)] });
    return;
  }

  if (commandName === 'add-account') {
    const platform = interaction.options.getString('platform', true);
    const username = interaction.options.getString('username', true);
    const account = await addAccount(interaction.user, platform, username);

    await interaction.editReply(`Linked ${platform} account \`${username}\` as pending verification.\nPut this code in your social bio, then run \`/verify-status\`:\n\`${account.verificationCode}\``);
    return;
  }

  if (commandName === 'verify-status') {
    const platform = interaction.options.getString('platform', true);
    const username = interaction.options.getString('username', true);
    const account = await verifyAccount(interaction.user, platform, username);

    await interaction.editReply(
      account
        ? `${platform} account \`${username}\` is now marked verified. In production, this command should check the bio automatically through the platform API.`
        : `I could not find a pending ${platform} account for \`${username}\`.`
    );
    return;
  }

  if (commandName === 'remove-account') {
    const platform = interaction.options.getString('platform', true);
    const username = interaction.options.getString('username', true);
    const removed = await removeAccount(interaction.user, platform, username);

    await interaction.editReply(
      removed
        ? `Removed ${platform} account \`${username}\`.`
        : `No matching ${platform} account found for \`${username}\`.`
    );
    return;
  }

  if (commandName === 'connect-tiktok') {
    if (!hasTikTokLoginConfig()) {
      await interaction.editReply('TikTok Login Kit is not configured yet. Add `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, and `TIKTOK_REDIRECT_URI` to `.env`.');
      return;
    }

    const pkce = await createPkcePair();
    const state = await createTikTokOAuthState(interaction.user, pkce.codeVerifier);
    const authUrl = createTikTokAuthUrl(state, pkce.codeChallenge);

    await interaction.editReply(`Connect your TikTok account here:\n${authUrl}\n\nThis link expires in 10 minutes.`);
    return;
  }

  if (commandName === 'tiktok-status') {
    const connection = await getTikTokConnectionForUserId(interaction.user.id);

    if (!connection) {
      await interaction.editReply('No TikTok account is connected yet. Use `/connect-tiktok` to connect one.');
      return;
    }

    const profile = connection.profile ?? {};
    await interaction.editReply(`TikTok connected: ${profile.display_name ?? profile.username ?? connection.openId}\nUsername: ${profile.username ?? 'Unknown'}\nConnected: ${new Date(connection.connectedAt).toLocaleString()}`);
    return;
  }

  if (commandName === 'remove-tiktok') {
    const removed = await removeTikTokConnection(interaction.user);
    await interaction.editReply(removed ? 'Your TikTok connection was removed.' : 'No TikTok connection was found.');
    return;
  }

  if (commandName === 'add-paypal') {
    const paypalEmail = interaction.options.getString('paypal_email', true);
    const firstName = interaction.options.getString('first_name', true);
    const lastName = interaction.options.getString('last_name', true);

    await setPayment(interaction.user, 'paypal', { paypalEmail, firstName, lastName });
    await interaction.editReply(`Saved PayPal payout details for ${maskValue(paypalEmail)}.`);
    return;
  }

  if (commandName === 'payment-details') {
    const user = await readUser(interaction.user);
    const payments = Object.values(user.payments);

    await interaction.editReply(
      payments.length
        ? payments.map((payment) => {
          if (payment.platform === 'paypal') return `PayPal: ${maskValue(payment.paypalEmail)}`;
          return `${payment.platform}: ${maskValue(payment.walletAddress)}`;
        }).join('\n')
        : 'No payment details saved yet.'
    );
    return;
  }

  if (commandName === 'remove-payment-details') {
    const platform = interaction.options.getString('platform', true);
    const removed = await removePayment(interaction.user, platform);

    await interaction.editReply(removed ? `Removed ${platform} payment details.` : `No ${platform} payment details found.`);
    return;
  }

  if (commandName === 'upload' || commandName === 'bounty-upload') {
    if (await areUploadsPaused()) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Uploads Paused')
            .setColor(0xeb5757)
            .setDescription('Uploading clips is currently paused until this cycle ends. Please wait for an admin to unpause uploads before submitting more clips.')
        ]
      });
      return;
    }

    const links = parseLinks(interaction.options.getString('links', true));
    const tag = commandName === 'bounty-upload' ? interaction.options.getString('tag', true) : null;

    if (links.length === 0) {
      await interaction.editReply('Please include at least one link.');
      return;
    }

    const posts = await addPosts(interaction.user, links, commandName === 'bounty-upload' ? 'bounty' : 'normal', tag);

    await interaction.editReply(`Added ${posts.length} post(s) for tracking. Stats refresh automatically every 4 hours, or an admin can run \`/refresh-stats\`.`);
    return;
  }

  if (commandName === 'remove-video') {
    const links = parseLinks(interaction.options.getString('links', true));
    const removed = await removePosts(interaction.user, links);

    await interaction.editReply(`Removed ${removed} tracked post(s).`);
    return;
  }

  if (commandName === 'remove-all-videos') {
    const confirm = interaction.options.getBoolean('confirm', true);

    if (!confirm) {
      await interaction.editReply('Nothing removed. Run it again with `confirm:true` if you want to remove all your videos.');
      return;
    }

    const removed = await removeAllPosts(interaction.user);
    await interaction.editReply(`Removed ${removed} tracked video(s).`);
    return;
  }

  if (commandName === 'stats') {
    const posts = await listUserPosts(interaction.user);

    if (posts.length === 0) {
      await interaction.editReply('You do not have tracked posts yet.');
      return;
    }

    const lines = posts.slice(0, 10).map((post) =>
      `${formatNumber(post.views)} views | ${formatPayout(post.views)} | ${post.status} | ${post.link}`
    );

    await interaction.editReply(lines.join('\n').slice(0, 1900));
    return;
  }

  if (commandName === 'admin-stats') {
    const targetUser = interaction.options.getUser('user', true);
    const result = await listPostsForUserId(targetUser.id);

    if (result.posts.length === 0) {
      await interaction.editReply(`${targetUser.tag} does not have tracked posts yet.`);
      return;
    }

    const totalViews = result.posts.reduce((sum, post) => sum + Number(post.views ?? 0), 0);
    const totalPayout = result.posts.reduce((sum, post) => sum + calculatePayout(post.views), 0);
    const lines = result.posts.slice(0, 10).map((post, index) => {
      const cycleName = post.cycleId ? result.cycles[post.cycleId]?.name ?? 'Unknown cycle' : 'No cycle';
      const tag = post.tag ? ` | tag: ${post.tag}` : '';
      return `${index + 1}. ${formatNumber(post.views)} views | ${formatPayout(post.views)} | ${post.status} | ${cycleName}${tag}\n${post.link}`;
    });

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`Admin Stats - ${targetUser.tag}`)
          .setColor(0xf2994a)
          .setDescription(lines.join('\n\n').slice(0, 3900))
          .addFields(
            { name: 'Total Views', value: formatNumber(totalViews), inline: true },
            { name: 'Total Payout', value: `$${totalPayout}`, inline: true },
            { name: 'Posts', value: String(result.posts.length), inline: true }
          )
      ]
    });
    return;
  }

  if (commandName === 'admin-account-info') {
    const targetUser = interaction.options.getUser('user', true);
    const storedUser = await readUserById(targetUser.id);
    const result = await listPostsForUserId(targetUser.id);
    const user = storedUser ?? result.user;

    await interaction.editReply({ embeds: [accountSummaryEmbed(user, result.posts)] });
    return;
  }

  if (commandName === 'admin-payment-details') {
    const targetUser = interaction.options.getUser('user', true);
    const storedUser = await readUserById(targetUser.id);
    const payments = Object.values(storedUser?.payments ?? {});

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`Payment Details - ${targetUser.tag}`)
          .setColor(0xf2994a)
          .setDescription(payments.length
            ? payments.map((payment) => {
              if (payment.platform === 'paypal') return `PayPal: ${maskValue(payment.paypalEmail)} | ${payment.firstName ?? ''} ${payment.lastName ?? ''}`.trim();
              return `${payment.platform}: ${maskValue(payment.walletAddress)}`;
            }).join('\n')
            : 'No payment details saved.')
      ]
    });
    return;
  }

  if (commandName === 'admin-remove-video') {
    const targetUser = interaction.options.getUser('user', true);
    const links = parseLinks(interaction.options.getString('links', true));
    const videoIds = await Promise.all(links.map((link) => resolveTikTokVideoId(link)));
    const removed = await removePostsForUserId(targetUser.id, links, videoIds);

    await interaction.editReply(`Removed ${removed} tracked video(s) for ${targetUser.tag}.`);
    return;
  }

  if (commandName === 'admin-reset-user-account') {
    const targetUser = interaction.options.getUser('user', true);
    const confirm = interaction.options.getBoolean('confirm', true);

    if (!confirm) {
      await interaction.editReply('Nothing reset. Run it again with `confirm:true` if you want to remove that user TikTok account and videos.');
      return;
    }

    const result = await resetUserAccount(targetUser.id);
    await interaction.editReply(`Reset ${targetUser.tag}: removed TikTok connection and ${result.removedPosts} tracked video(s).`);
    return;
  }

  if (commandName === 'admin-inactivity') {
    const result = await inactivityEmbed(0);
    const totalPages = pageCount(result.rows.length);
    await interaction.editReply({
      embeds: [result.embed],
      components: paginationRows('inactivity', 0, totalPages)
    });
    return;
  }

  if (commandName === 'admin-refresh-user-stats') {
    const targetUser = interaction.options.getUser('user', true);
    const updates = await refreshStats(targetUser.id);
    const tracked = updates.filter((update) => update.status === 'tracked').length;

    await interaction.editReply(`Refreshed ${updates.length} post(s) for ${targetUser.tag}. ${tracked} post(s) have live API stats.`);
    return;
  }

  if (commandName === 'admin-all-stats') {
    const result = await adminAllStatsEmbed(0);
    const rows = result.rows;

    if (rows.length === 0) {
      await interaction.editReply('No users have tracked posts yet.');
      return;
    }

    await interaction.editReply({
      embeds: [result.embed],
      components: paginationRows('adminall', 0, pageCount(rows.length))
    });
    return;
  }

  if (commandName === 'leaderboard') {
    const result = await leaderboard();
    const rows = result.rows;

    if (rows.length === 0) {
      await interaction.editReply(result.cycle ? `No tracked posts yet for ${result.cycle.name}.` : 'No tracked posts yet.');
      return;
    }

    await interaction.editReply({
      embeds: [leaderboardEmbed(result, 0)],
      components: paginationRows('leaderboard', 0, pageCount(rows.length))
    });
    return;
  }

  if (commandName === 'cycle-start') {
    const name = interaction.options.getString('name')?.trim();
    const result = await startCycle(name, interaction.user);

    if (!result.ok) {
      await interaction.editReply(`A cycle is already active: ${result.cycle.name}. End it with \`/cycle-end\` before starting another.`);
      return;
    }

    await interaction.editReply(`Started cycle: ${result.cycle.name}. New uploads will now count toward this cycle.`);
    return;
  }

  if (commandName === 'cycle-end') {
    const result = await endCycle(interaction.user);

    if (!result.ok) {
      await interaction.editReply('There is no active cycle to end.');
      return;
    }

    await interaction.editReply(`Ended cycle: ${result.cycle.name}. The leaderboard/tracked videos were cleared. New uploads will not count toward a cycle until an admin starts another one.`);
    return;
  }

  if (commandName === 'cycle-status') {
    const status = await getCycleStatus();

    if (status.activeCycle) {
      await interaction.editReply(`Active cycle: ${status.activeCycle.name}\nStarted: ${new Date(status.activeCycle.startedAt).toLocaleString()}`);
      return;
    }

    await interaction.editReply(status.lastCycle
      ? `No active cycle. Last cycle: ${status.lastCycle.name} (${status.lastCycle.status}).`
      : 'No cycle has been started yet.');
    return;
  }

  if (commandName === 'refresh-stats') {
    const updates = await refreshStats();
    const tracked = updates.filter((update) => update.status === 'tracked').length;

    await interaction.editReply(`Refreshed ${updates.length} post(s). ${tracked} post(s) have live API stats.`);
    return;
  }

  if (commandName === 'admin-pause-uploads') {
    await setUploadsPaused(true);
    await interaction.editReply('Uploads are now paused. Users will see a paused message when they try to upload clips.');
    return;
  }

  if (commandName === 'admin-unpause-uploads') {
    await setUploadsPaused(false);
    await interaction.editReply('Uploads are now unpaused. Users can submit clips again.');
    return;
  }

  if (commandName === 'debug-tiktok') {
    await interaction.editReply([
      `TikTok client key set: ${hasTikTokLoginConfig() ? 'yes' : 'no'}`,
      `TikTok redirect URI: ${getTikTokRedirectUri()}`,
      `Public base URL: ${config.publicBaseUrl || 'not set'}`
    ].join('\n'));
    return;
  }

  await interaction.editReply('This command is registered in Discord, but this running bot version does not handle it yet. Redeploy the latest code and try again.');
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);

  setInterval(async () => {
    try {
      const updates = await refreshStats();
      console.log(`Auto-refreshed ${updates.length} post(s).`);
    } catch (error) {
      console.error('Auto-refresh failed:', error);
    }
  }, 4 * 60 * 60 * 1000);
});

startWebServer();

client.on(Events.InteractionCreate, (interaction) => {
  handleInteraction(interaction).catch(async (error) => {
    console.error(error);

    if (error.code === 10062 || error.code === 40060) {
      return;
    }

    const message = 'Something went wrong while running that command.';
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(message);
      } else {
        await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
      }
    } catch (replyError) {
      if (replyError.code !== 10062 && replyError.code !== 40060) {
        console.error(replyError);
      }
    }
  });
});

await client.login(config.discordToken);
