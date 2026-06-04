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
        .setDescription('One link, or up to 10 links separated by commas')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('bounty-upload')
    .setDescription('Upload bounty post links for tracking.')
    .addStringOption((option) =>
      option.setName('links')
        .setDescription('One link, or up to 10 links separated by commas')
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
        .setDescription('One link, or up to 10 links separated by commas')
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
    .setName('admin-all-stats')
    .setDescription('Admin: view a summary of all tracked users.')
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
    .setName('debug-tiktok')
    .setDescription('Admin: show TikTok login configuration status.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
].map((command) => command.toJSON());
