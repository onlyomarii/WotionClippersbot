import {
  SlashCommandBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { platformChoices, paymentPlatformChoices } from './platforms.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('View the WotionClippersbot command guide.'),

  new SlashCommandBuilder()
    .setName('account-info')
    .setDescription('View your linked accounts, tracked posts, and payment setup.'),

  new SlashCommandBuilder()
    .setName('add-account')
    .setDescription('Link a social media account to your Discord account.')
    .addStringOption((option) =>
      option.setName('platform')
        .setDescription('Social platform')
        .setRequired(true)
        .addChoices(...platformChoices()))
    .addStringOption((option) =>
      option.setName('username')
        .setDescription('Your username on that platform')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('verify-status')
    .setDescription('Check or mark a linked account as verified.')
    .addStringOption((option) =>
      option.setName('platform')
        .setDescription('Social platform')
        .setRequired(true)
        .addChoices(...platformChoices()))
    .addStringOption((option) =>
      option.setName('username')
        .setDescription('Your username on that platform')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('remove-account')
    .setDescription('Unlink a social media account from your Discord account.')
    .addStringOption((option) =>
      option.setName('platform')
        .setDescription('Social platform')
        .setRequired(true)
        .addChoices(...platformChoices()))
    .addStringOption((option) =>
      option.setName('username')
        .setDescription('Your username on that platform')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('connect-tiktok')
    .setDescription('Connect your TikTok account using TikTok Login Kit.'),

  new SlashCommandBuilder()
    .setName('tiktok-status')
    .setDescription('Check your TikTok connection status.'),

  new SlashCommandBuilder()
    .setName('remove-tiktok')
    .setDescription('Remove your connected TikTok account.'),

  new SlashCommandBuilder()
    .setName('add-paypal')
    .setDescription('Add or replace your PayPal payout details.')
    .addStringOption((option) =>
      option.setName('paypal_email')
        .setDescription('PayPal email address')
        .setRequired(true))
    .addStringOption((option) =>
      option.setName('first_name')
        .setDescription('First name')
        .setRequired(true))
    .addStringOption((option) =>
      option.setName('last_name')
        .setDescription('Last name')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('payment-details')
    .setDescription('View your saved payout details.'),

  new SlashCommandBuilder()
    .setName('remove-payment-details')
    .setDescription('Remove saved payout details.')
    .addStringOption((option) =>
      option.setName('platform')
        .setDescription('Payment method')
        .setRequired(true)
        .addChoices(...paymentPlatformChoices())),

  new SlashCommandBuilder()
    .setName('upload')
    .setDescription('Upload social media post links for tracking.')
    .addStringOption((option) =>
      option.setName('links')
        .setDescription('One link, or up to 20 links separated by commas')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('bounty-upload')
    .setDescription('Upload bounty post links for tracking.')
    .addStringOption((option) =>
      option.setName('links')
        .setDescription('One link, or up to 20 links separated by commas')
        .setRequired(true))
    .addStringOption((option) =>
      option.setName('tag')
        .setDescription('Bounty tag')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('remove-video')
    .setDescription('Remove social media post links from tracking.')
    .addStringOption((option) =>
      option.setName('links')
        .setDescription('One link, or up to 20 links separated by commas')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('remove-all-videos')
    .setDescription('Remove all of your tracked videos.')
    .addBooleanOption((option) =>
      option.setName('confirm')
        .setDescription('Confirm removing all your videos')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View stats for your tracked posts.'),

  new SlashCommandBuilder()
    .setName('admin-stats')
    .setDescription('Admin: view tracked posts for a specific user.')
    .addUserOption((option) =>
      option.setName('user')
        .setDescription('Discord user to inspect')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('admin-account-info')
    .setDescription('Admin: view a user account summary.')
    .addUserOption((option) =>
      option.setName('user')
        .setDescription('Discord user to inspect')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('admin-payment-details')
    .setDescription('Admin: view a user payment details.')
    .addUserOption((option) =>
      option.setName('user')
        .setDescription('Discord user to inspect')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('admin-remove-video')
    .setDescription('Admin: remove a video link from a user.')
    .addUserOption((option) =>
      option.setName('user')
        .setDescription('Discord user')
        .setRequired(true))
    .addStringOption((option) =>
      option.setName('links')
        .setDescription('One link, or multiple links separated by commas')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('admin-reset-user-account')
    .setDescription('Admin: remove a user TikTok account and all tracked videos.')
    .addUserOption((option) =>
      option.setName('user')
        .setDescription('Discord user')
        .setRequired(true))
    .addBooleanOption((option) =>
      option.setName('confirm')
        .setDescription('Confirm resetting this user')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('admin-inactivity')
    .setDescription('Admin: check which users have not uploaded videos.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('admin-refresh-user-stats')
    .setDescription('Admin: refresh stats for one user only.')
    .addUserOption((option) =>
      option.setName('user')
        .setDescription('Discord user to refresh')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('admin-all-stats')
    .setDescription('Admin: view a summary of all tracked users.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('admin-totalpayout')
    .setDescription('Admin: view the total payout from the leaderboard.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('admin-bulk-reset-leaderboard')
    .setDescription('Admin: reset users by leaderboard rank range.')
    .addIntegerOption((option) =>
      option.setName('start_rank')
        .setDescription('First leaderboard rank to reset, like 44')
        .setMinValue(1)
        .setRequired(true))
    .addIntegerOption((option) =>
      option.setName('end_rank')
        .setDescription('Last leaderboard rank to reset, like 105')
        .setMinValue(1)
        .setRequired(true))
    .addBooleanOption((option) =>
      option.setName('confirm')
        .setDescription('Confirm removing TikTok and videos for this range')
        .setRequired(true))
    .addBooleanOption((option) =>
      option.setName('all_time')
        .setDescription('Use all-time stats instead of current leaderboard')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('admin-clean-leaderboard')
    .setDescription('Admin: clear inactive or departed users from leaderboard data.')
    .addStringOption((option) =>
      option.setName('target')
        .setDescription('Which users to clean up')
        .setRequired(true)
        .addChoices(
          { name: 'Users no longer in server', value: 'left_server' },
          { name: 'Inactive TikTok users', value: 'inactive' },
          { name: 'Both', value: 'both' }
        ))
    .addBooleanOption((option) =>
      option.setName('confirm')
        .setDescription('Confirm removing TikToks and videos for matching users')
        .setRequired(true))
    .addBooleanOption((option) =>
      option.setName('all_time')
        .setDescription('Use all-time data instead of current leaderboard data')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View rankings for the current tracking cycle.'),

  new SlashCommandBuilder()
    .setName('cycle-start')
    .setDescription('Admin: start a new tracking cycle.')
    .addStringOption((option) =>
      option.setName('name')
        .setDescription('Optional cycle name')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('cycle-end')
    .setDescription('Admin: end the active tracking cycle.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('cycle-status')
    .setDescription('View the active tracking cycle status.'),

  new SlashCommandBuilder()
    .setName('refresh-stats')
    .setDescription('Admin: refresh tracked view counts now.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('admin-pause-uploads')
    .setDescription('Admin: pause clip uploads.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('admin-unpause-uploads')
    .setDescription('Admin: unpause clip uploads.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('debug-tiktok')
    .setDescription('Admin: show TikTok login configuration status.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
].map((command) => command.toJSON());
