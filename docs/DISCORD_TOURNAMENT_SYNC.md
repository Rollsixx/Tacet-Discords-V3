# Discord tournament sync

The Discord bot is the source of tournament state. It sends private snapshots to
POST /api/hall-of-fame/discord-sync; the site never connects to the bot's
database. Snapshots contain HMAC-derived participant IDs, not Discord user IDs.

## Configure

1. Set DISCORD_HOLOGRAM_SYNC_TOKEN in the website production environment to a
   random value with at least 32 characters.
2. On the bot host, set DISCORD_HOLOGRAM_SYNC_URL to the site's full
   /api/hall-of-fame/discord-sync URL.
3. Set the same value as DISCORD_HOLOGRAM_SYNC_TOKEN on the bot host.
4. Set a stable, private HOF_EXPORT_KEY of at least 32 bytes on the bot host.
   Keep it unchanged so participant identities remain stable between snapshots.
5. Restart the bot. It synchronizes Hologram tournaments every 15 seconds and
   retries failed requests. It stores source revisions in the bot database.

Do not put any of these secrets in source control or a browser-visible variable.

## Review and publish

The first imported bracket stays private in Hall of Fame administration. Select
the event, review the roster, bracket, draft steps, and imported podium
candidates, then use the existing Reveal bracket action when ready. Live
matchups, boss rolls, and draft details appear on the public overlay only after
the bracket is revealed. Medal candidates are never published automatically;
staff must review and publish them. If the bot records no third-place winner,
staff may publish an unclaimed bronze.

Discord's draft order is used for bot-managed events: Player 1 bans two,
Player 2 bans two, each picks once, each bans once more, then Player 1 completes
their team before Player 2. The site records the same 12 total actions.

## Data and safety behavior

- Source revisions are monotonic; stale or conflicting revisions are rejected.
- Repeating the latest identical revision is idempotent.
- Imports update only events marked as managed by this integration.
- Revealing the bracket is a staff action. Publishing medals is a separate
  staff action.
- The bot exporter rejects test entrants and omits raw Discord IDs.
- Tournament snapshots flow from the bot to the site. Staff can also queue event creation and active-event renames from the site; roster, bracket, and draft edits remain bot-owned.


## Create and rename bot-managed tournaments from the website

Hall of Fame administrators can queue a Hologram event from the Tournaments desk. The bot checks the authenticated `/api/hall-of-fame/discord-commands` endpoint every 15 seconds, creates the event using its configured Discord registration channel, and sends its snapshot back through the existing sync endpoint. The site shows the event as a private draft after the first snapshot.

The bot supports bracket capacities of 4, 8, 16, and 32 entrants for this flow. Staff can queue a rename for an active bot-managed event; the bot updates its database and registration card, and the next snapshot updates the site title. This uses the same `DISCORD_HOLOGRAM_SYNC_URL` and `DISCORD_HOLOGRAM_SYNC_TOKEN`; no additional secret or inbound bot port is required.

Deploy the updated bot after the website change. If the bot is offline, requests remain queued and become available when it reconnects. Failed commands are marked for staff to retry.
