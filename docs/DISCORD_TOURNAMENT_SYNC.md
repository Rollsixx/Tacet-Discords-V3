# Discord tournament sync

Discord is the source of truth for Hologram event creation, registration, and
tournament changes. The bot sends private snapshots to
`POST /api/hall-of-fame/discord-sync`; the website never connects to the bot's
database. Snapshots contain HMAC-derived participant IDs, not Discord user IDs.

## Configure

1. Set `DISCORD_HOLOGRAM_SYNC_TOKEN` in the website production environment to
   a random value with at least 32 characters.
2. On the bot host, set `DISCORD_HOLOGRAM_SYNC_URL` to the site's full
   `/api/hall-of-fame/discord-sync` URL.
3. Set the same value as `DISCORD_HOLOGRAM_SYNC_TOKEN` on the bot host.
4. Set a stable, private `HOF_EXPORT_KEY` of at least 32 bytes on the bot host.
   Keep it unchanged so participant identities remain stable between snapshots.
5. Restart the bot. It synchronizes selected Hologram tournaments every 15
   seconds and retries failed requests. It stores source revisions in the bot
   database.

Do not put any of these secrets in source control or a browser-visible variable.

## Import and reveal behavior

- Discord registration snapshots create a website tournament draft
  automatically. Its roster remains private while Discord reports
  `registration`.
- Newly imported events are marked to reveal automatically when a later Discord
  snapshot reports `running`. The site publishes the confirmed roster and
  bracket together, then continues importing matchups, bosses, draft steps, and
  results.
- Existing imported drafts are not opted into automatic reveal by this change.
  The first test event, such as #7, can continue to be revealed manually by
  staff.
- Medal candidates remain private. Staff must review and publish final medals.
- A completed Discord event moves to results review; completion does not publish
  medals.
- The Discord tournament rules govern ban and pick order. The site records the
  same actions for review and display.

## Data and safety behavior

- Source revisions are monotonic; stale or conflicting revisions are rejected.
- Repeating the latest identical revision is idempotent.
- Imports update only events marked as managed by this integration.
- The bot exporter rejects test entrants and omits raw Discord IDs.
- Event creation, registration, renames, and tournament edits are performed in
  Discord. The website has no command queue back to the bot.
- Website staff retain control over final medal review and publication.
