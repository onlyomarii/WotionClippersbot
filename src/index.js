import {
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags
} from 'discord.js';
import { config, requireConfig } from './config.js';
import { formatNumber, maskValue, parseLinks } from './format.js';
import {
  addAccount,
  addPosts,
  adminStatsSummary,
  createTikTokOAuthState,
  endCycle,
  getTikTokConnectionForUserId,
  getCycleStatus,
  leaderboard,
  listPostsForUserId,
  listUserPosts,
  readUser,
  removeAccount,
  removePayment,
  removePosts,
  removeTikTokConnection,
  setPayment,
  startCycle,
  verifyAccount
} from './storage.js';
import { refreshStats } from './social/tracker.js';
import { createPkcePair, createTikTokAuthUrl, getTikTokRedirectUri, hasTikTokLoginConfig } from './social/tiktok-login.js';
import { startWebServer } from './web-server.js';

requireConfig(['discordToken']);

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

function accountSummaryEmbed(user, posts) {
  const accounts = Object.values(user.accounts);
  const payments = Object.values(user.payments);
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
    .setTitle('WendyClippersbot Command Guide')
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
          '`/upload links` - Add up to 10 social media links for tracking.',
          '`/bounty-upload links tag` - Add up to 10 bounty links with a tag.',
          '`/remove-video links` - Remove up to 10 tracked links.'
        ].join('\n')
      },
      {
        name: 'Checking Stats',
        value: [
          '`/stats` - View stats for your tracked posts.',
          '`/leaderboard` - View rankings for the current cycle.',
          "`/admin-stats user` - Admin only: view one user's tracked posts.",
          '`/admin-all-stats` - Admin only: view all-user totals.',
          '`/refresh-stats` - Admin only: refresh view counts now.'
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
    .setFooter({ text: 'Separate multiple links with commas. Maximum 10 links per upload command.' });
}

async function handleInteraction(interaction) {
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

  if (commandName === 'stats') {
    const posts = await listUserPosts(interaction.user);

    if (posts.length === 0) {
      await interaction.editReply('You do not have tracked posts yet.');
      return;
    }

    const lines = posts.slice(0, 10).map((post) =>
      `${formatNumber(post.views)} views | ${post.status} | ${post.link}`
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
    const lines = result.posts.slice(0, 10).map((post, index) => {
      const cycleName = post.cycleId ? result.cycles[post.cycleId]?.name ?? 'Unknown cycle' : 'No cycle';
      const tag = post.tag ? ` | tag: ${post.tag}` : '';
      return `${index + 1}. ${formatNumber(post.views)} views | ${post.status} | ${cycleName}${tag}\n${post.link}`;
    });

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`Admin Stats - ${targetUser.tag}`)
          .setColor(0xf2994a)
          .setDescription(lines.join('\n\n').slice(0, 3900))
          .addFields({
            name: 'Total',
            value: `${result.posts.length} post(s), ${formatNumber(totalViews)} total views`
          })
      ]
    });
    return;
  }

  if (commandName === 'admin-all-stats') {
    const rows = await adminStatsSummary();

    if (rows.length === 0) {
      await interaction.editReply('No users have tracked posts yet.');
      return;
    }

    const description = rows.slice(0, 15).map((row, index) =>
      `#${index + 1} ${row.username}: ${formatNumber(row.views)} views | ${row.posts} post(s) | ${row.tracked} tracked | ${row.pending} pending/manual`
    ).join('\n');

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('Admin Stats Summary')
          .setColor(0xf2994a)
          .setDescription(description)
      ]
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

    const description = rows.slice(0, 10).map((row, index) =>
      `#${index + 1} ${row.username}: ${formatNumber(row.views)} views across ${row.posts} post(s)`
    ).join('\n');

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle(result.cycle ? `Leaderboard - ${result.cycle.name}` : 'Leaderboard')
          .setColor(0x27ae60)
          .setDescription(description)
      ]
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

    await interaction.editReply(`Ended cycle: ${result.cycle.name}. New uploads will not count toward a cycle until an admin starts another one.`);
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
