# WendyClippersbot

Starter Discord bot for linking social accounts, saving payout details, uploading social clips for tracking, viewing stats, and building a leaderboard.

## Setup

1. Install Node.js 20 or newer.
2. Create a Discord application at <https://discord.com/developers/applications>.
3. Open **Bot**, create/reset the token, and copy it.
4. Open **OAuth2 > General**, copy the Client ID.
5. In Discord, turn on Developer Mode, right-click your test server, and copy Server ID.
6. Copy `.env.example` to `.env` and fill in:

```env
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_GUILD_ID=...
YOUTUBE_API_KEY=
PUBLIC_BASE_URL=
PORT=3000
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=
TIKTOK_RESEARCH_CLIENT_KEY=
TIKTOK_RESEARCH_CLIENT_SECRET=
```

7. Install dependencies:

```bash
npm install
```

8. Register slash commands to your test server:

```bash
npm run register
```

9. Start the bot:

```bash
npm start
```

## Invite Bot

In the Developer Portal, go to **OAuth2 > URL Generator**.

Select scopes:

- `bot`
- `applications.commands`

Select bot permissions:

- `Send Messages`
- `Use Slash Commands`
- `Embed Links`

Open the generated URL and add the bot to your server.

## Commands

- `/help`
- `/account-info`
- `/add-account platform username`
- `/verify-status platform username`
- `/remove-account platform username`
- `/connect-tiktok`
- `/tiktok-status`
- `/remove-tiktok`
- `/add-paypal paypal_email first_name last_name`
- `/payment-details`
- `/remove-payment-details platform`
- `/upload links`
- `/bounty-upload links tag`
- `/remove-video links`
- `/stats`
- `/admin-stats user`
- `/admin-all-stats`
- `/leaderboard`
- `/cycle-start name`
- `/cycle-end`
- `/cycle-status`
- `/refresh-stats`

## Notes

This starter uses `data/store.json` for local storage. It is fine for testing and small private servers. For a public paid system, move storage to PostgreSQL and handle payouts through PayPal Payouts, Stripe Connect, or an admin-reviewed crypto payout process.

YouTube links can update real view counts if `YOUTUBE_API_KEY` is set.

TikTok links can update real view counts after creators connect TikTok with `/connect-tiktok` and TikTok approves the requested Login Kit scopes. Set `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `PUBLIC_BASE_URL`, and `TIKTOK_REDIRECT_URI`.

The TikTok redirect URI should be:

```text
https://your-host.example.com/auth/tiktok/callback
```

Direct TikTok video URLs work best. Short links may work if TikTok redirects them to a normal `/video/` URL.

Research API support is also available if TikTok approves your app for Research API access and you set `TIKTOK_RESEARCH_CLIENT_KEY` and `TIKTOK_RESEARCH_CLIENT_SECRET`.

Other platforms are stored and tracked as pending/manual until official API integrations are added.
