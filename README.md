# makearoll_discord

A Discord bot that answers tabletop RPG rules questions (D&D and Savage
Worlds) using OpenAI's Responses API with file search over reference PDFs,
and keeps the conversation going in a dedicated thread per question.

## How it works

- `/dnd <question>` and `/sw <question>` are slash commands (registered via
  `commands.js`). Discord sends the interaction to `POST /interactions`
  ([app.js](app.js)), verified with Discord's Ed25519 request signing
  (`verifyKeyMiddleware`, not a shared-secret HMAC).
- The handler creates a new public thread named after the question (or, if
  the question is too long for Discord's 100-character thread name limit,
  a truncated name plus the full question as the thread's first message —
  see `buildThreadName` / `DISCORD_THREAD_NAME_MAX_LENGTH`), then asks the
  configured OpenAI assistant (`askAssistantQuestion` in `genai.js`) with
  file search scoped to that RPG's vector store.
- Follow-up messages posted inside a bot-created thread are picked up by the
  `messageCreate` listener in `app.js` and answered with the thread's
  accumulated history as context (`getThreadHistory` in
  `discord-thread.js`), so a thread behaves like an ongoing conversation.
- `GET /health` reports whether the Discord client has finished logging in
  (`botReady`), used by Docker's healthcheck.

## Local development

```bash
npm install
cp .env.example .env   # fill in the values below
npm run register       # (re)registers the /dnd and /sw slash commands with Discord
npm run dev             # nodemon, restarts on file changes
```

### Required environment variables (see `.env.example`)

| Variable | Purpose |
|---|---|
| `DISCORD_TOKEN` | Bot token, used to call the Discord API |
| `PUBLIC_KEY` | Discord app's public key, used to verify interaction requests |
| `APP_ID` | Discord application ID, used when registering slash commands |
| `OPENAI_API_KEY` | OpenAI API key |
| `DND_PLAYER_VECTOR_STORE_ID` | Vector store (file search) ID backing `/dnd` |
| `SAVAGE_WORLDS_VECTOR_STORE_ID` | Vector store (file search) ID backing `/sw` |
| `PORT` | Express port (defaults to 3000) |

Discord's Interactions Endpoint URL (in the Discord Developer Portal) needs
to point at this app's public `/interactions` route.

## Deployment

Runs as a single Docker container (`docker-compose.yml`), built with a
`GIT_SHA` build arg baked in at build time and logged on startup so you can
tell which commit is actually running (`docker logs makearoll-discord`).
There's no ngrok/tunnel service in this repo anymore — the public endpoint
is shared with other apps on the same Pi via a reverse proxy in the
separate `pi-deploy` repo, which also handles redeploys: a push to `main`
here triggers a webhook that pulls and rebuilds this container. See that
repo's README for how that's wired up.
