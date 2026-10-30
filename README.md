# Green Room

**Mosaic tells you who. Green Room gets them on your show.**

A booking desk for creators at Edge City India. Your Agent Village agent finds guests through Mosaic. Green Room researches them with TinyFish, drafts the invite with an open model on Groq, issues a World ID–verified invite card (5 per human per day), and tracks the guest's answer.

- Design: [docs/superpowers/specs/2026-10-29-green-room-design.md](docs/superpowers/specs/2026-10-29-green-room-design.md)
- Plan: [docs/superpowers/plans/2026-10-30-green-room.md](docs/superpowers/plans/2026-10-30-green-room.md)

## Run locally

```bash
cp .env.example .env.local   # fill in the keys
npm install
npm run db:migrate
npm run dev
```

## Checks

```bash
npm test          # vitest
npm run typecheck # next typegen + tsc
npm run build
```

## How it fits together

| Piece | Where |
|---|---|
| Telegram login, sessions | `src/lib/auth/`, `src/app/api/auth/` |
| World ID (one human, one account) | `src/lib/worldid/verify.ts`, `src/app/verify/` |
| Agent handoff ("Add to desk" link, public fields only) | `src/lib/handoff.ts`, `src/app/add/` |
| Guest research (TinyFish search + fetch, sourced facts) | `src/lib/tinyfish.ts`, `src/lib/brief.ts` |
| Invite drafting (Groq, `openai/gpt-oss-120b`) and the 5-a-day limit | `src/lib/invite-draft.ts`, `src/lib/invites.ts` |
| Public invite card | `src/app/i/[code]/` |
| Desk chat assistant | `src/lib/chat/`, `src/app/api/chat/` |
| Public MCP for the Agent Village mini-app | `src/app/api/mcp/`, `mini-app/green-room/` |

## Privacy

Nothing from a Mosaic pair page leaves the creator's Telegram chat. The desk only accepts allow-listed public fields (name, public links, public "looking to meet" text, topic), the AI only sees public web pages, and every fact in a brief carries the URL it came from.

## Deploy

1. `vercel login`, `vercel link`, add the env vars from `.env.example` (`vercel env add`), `vercel deploy --prod`.
2. Set `NEXT_PUBLIC_APP_URL` to the production URL and redeploy.
3. In @BotFather: `/setdomain` for the login bot → the production domain.
4. `npm run db:migrate` with the Neon `DATABASE_URL`.
5. Update `mini-app/green-room/manifest.json` `baseUrl`/`homepage` to the production URL.

See [docs/iteration-log.md](docs/iteration-log.md) for what we tested and changed.
