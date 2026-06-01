import 'dotenv/config';

export const config = {
  discordToken: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.DISCORD_GUILD_ID,
  youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
  port: Number(process.env.PORT || 3000),
  tiktokClientKey: process.env.TIKTOK_CLIENT_KEY || process.env.TIKTOK_RESEARCH_CLIENT_KEY || '',
  tiktokClientSecret: process.env.TIKTOK_CLIENT_SECRET || process.env.TIKTOK_RESEARCH_CLIENT_SECRET || '',
  tiktokRedirectUri: process.env.TIKTOK_REDIRECT_URI || '',
  tiktokResearchClientKey: process.env.TIKTOK_RESEARCH_CLIENT_KEY || '',
  tiktokResearchClientSecret: process.env.TIKTOK_RESEARCH_CLIENT_SECRET || ''
};

export function requireConfig(keys) {
  const missing = keys.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment values: ${missing.join(', ')}`);
  }
}
