import 'dotenv/config';

function envValue(name, fallback = '') {
  return (process.env[name] || fallback).trim();
}

export const config = {
  discordToken: envValue('DISCORD_TOKEN'),
  clientId: envValue('DISCORD_CLIENT_ID'),
  guildId: envValue('DISCORD_GUILD_ID'),
  youtubeApiKey: envValue('YOUTUBE_API_KEY'),
  publicBaseUrl: envValue('PUBLIC_BASE_URL'),
  port: Number(envValue('PORT', '3000')),
  tiktokClientKey: envValue('TIKTOK_CLIENT_KEY') || envValue('TIKTOK_RESEARCH_CLIENT_KEY'),
  tiktokClientSecret: envValue('TIKTOK_CLIENT_SECRET') || envValue('TIKTOK_RESEARCH_CLIENT_SECRET'),
  tiktokRedirectUri: envValue('TIKTOK_REDIRECT_URI'),
  tiktokResearchClientKey: envValue('TIKTOK_RESEARCH_CLIENT_KEY'),
  tiktokResearchClientSecret: envValue('TIKTOK_RESEARCH_CLIENT_SECRET'),
  auditLogChannelId: envValue('AUDIT_LOG_CHANNEL_ID') || envValue('LOG_CHANNEL_ID'),
  websiteAllowedOrigins: envValue('WEBSITE_ALLOWED_ORIGINS'),
  websiteApiEnabled: envValue('WEBSITE_API_ENABLED', 'true'),
  websiteApiKey: envValue('WEBSITE_API_KEY'),
  websitePushEnabled: envValue('WEBSITE_PUSH_ENABLED', 'true'),
  websitePushIntervalMinutes: Number(envValue('WEBSITE_PUSH_INTERVAL_MINUTES', '5')),
  websiteUrl: envValue('WEBSITE_URL')
};

export function requireConfig(keys) {
  const missing = keys.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment values: ${missing.join(', ')}`);
  }
}
