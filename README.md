# Green Room

**Mosaic tells you who. Green Room gets them on your show.**

A booking desk for creators at Edge City India. Your Agent Village agent finds guests through Mosaic. Green Room researches them with TinyFish, drafts the invite with Grok, issues a World ID–verified invite card (5 per human per day), and tracks the guest's answer.

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
