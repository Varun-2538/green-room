# Green Room: design

*Edge City India Buildathon · written 2026-10-29 · submissions close **Fri 30 Oct 18:00 IST***

> **Mosaic tells you who. Green Room gets them on your show.**
> It researches the guest, writes the invite, proves you're a real human, and tracks the booking.

---

## 1. Intent and why

Creators in the village (podcasters, YouTubers, writers) don't know who in a 500-person village would be a great guest or collaborator, what angle to pitch, or how to ask without sounding like spam. Agent Village's **Mosaic** already knows who fits whom, but it stops at "who". Nobody helps the creator get from a match to a booked, recorded episode.

The first user is **Varun**, host of **In Between**, a show about people's journeys rather than their milestones. The demo books real village guests for In Between.

### What exists vs what we build

| Already exists (we use it) | We build |
|---|---|
| Mosaic: matching, pair pages, team | **Booking desk (web):** guest pipeline across episodes |
| Agent Village agent on Telegram | **Guest research (TinyFish):** public story, recent work, episode questions |
| Rolodex: public profiles | **Verified invite (World ID):** invite card, "verified human" badge, daily limit, guest's answer |
| Index: introductions, opens a Telegram chat | **Desk assistant:** a web chat that researches and drafts |
| | **Handoff:** a prompt and link that bring Mosaic matches into the desk |

## 2. Goals, non-goals, anti-goals

**Goals (demo by Fri 18:00)**
1. A creator signs in to the desk with Telegram and verifies once with World ID.
2. Mosaic matches get into the desk in one click, from the creator's own agent chat.
3. Each guest gets a TinyFish-built brief: their story so far, recent public work, 8 episode questions.
4. The desk drafts an invite. The creator edits it and creates a verified invite link (5 per human per day).
5. The guest opens an invite card and answers: I'm in, Suggest a time, or Not now.
6. The pipeline shows each guest's status.
7. **Real evidence:** 2–3 real village guests invited through it, at least one acceptance, ideally a recorded clip.

**Non-goals**
- Our own matching (Mosaic does it).
- Our own messaging between people (Index introductions plus Telegram do it).
- A mobile app.
- Guests from outside the village. That's a stretch goal only (section 9).

**Anti-goals: failure even if it "works"**
- **Leaking Mosaic.** Showing a guest, or storing on our server, what *they* told Mosaic. This breaks Edge City's privacy rules and loses the Agent Village prize.
- **Logging into the user's Telegram account** (userbot) to mirror chats. It needs full account access, and it bypasses Mosaic's private-chat guard.
- **Spam.** Unlimited or unverified invites.
- **Invented facts.** Any brief or invite that states things about a guest not found in a public source.

## 3. Hard constraints (found during research and the dry run, 2026-10-29)

1. **Mosaic is only readable by the owner's hosted agent,** via the native `village` tool (`mini-app.read`, appId `mosaic`: `top_matches`, `collaborators`, `team`, `pair_pages`). It answers only in the owner's private Telegram DM (`private_owner_chat_required` otherwise). There's no public API, and the web page needs a login.
2. **Privacy rules (Mosaic SKILL.md):** never share pages or a match's answers with other apps, agents or the people named; never tell someone they're on the list; no scores. → The handoff to the desk carries **only public identity plus the creator's own words**: no `them` lines, no `why` lines, no page text.
3. **A generic mini-app** (to run *inside* the agent) is a public, read-only MCP server (`auth: none`, every operation `class: read`) plus one `SKILL.md` of at most 32 KiB, with a non-reserved id. Edge City staff must review it and allowlist it for the tenant. **Not guaranteed by Friday.** The core demo must not depend on it.
4. **Dry run findings:**
   - Pair pages exist only once the owner opens their link: **5 of 93** were written.
   - The best topical guest was **rank 54**, so search by topic, not by rank.
   - `mini-app.context.read` for Mosaic returned `mini_app_not_installed`. It isn't needed.
   - `rolodex.person` returns rich public cards: here for, looking to meet, offers, curious about, X and GitHub links.
   - TinyFish search and fetch on those links returns a rich public story in about 2 seconds.
5. **Agent Village doesn't search the web** (Index skill: "Do not look up public pages"). Web research is our gap to fill.
6. **Judging:**

   | Criterion | Weight |
   |---|---|
   | Real value for its people | 30% |
   | Originality | 25% |
   | Tangible result | 30% |
   | Iteration | 15% |

   Submission: description, link, video of at most 2 minutes, evidence of iteration.

## 4. User flows

### 4.1 Creator, one-time setup
1. In the Agent Village app, add the creator side to Mosaic (show, themes, wanted guests) so creator matches rank higher.
2. Open the desk → **Log in with Telegram** → **Verify with World ID** (once; links one human to one desk account).
3. Settings: show name, one-line pitch, and the agent's Telegram username (for the "Ask my agent" button).

### 4.2 Creator, booking a guest
1. **Desk → New episode:** topic "people who quit a safe path to build something".
2. **Ask my agent:** opens Telegram with a pre-typed prompt (section 6.3). The agent reads Mosaic plus the Rolodex and replies with 3 guests. Each has a "why you two" (private, stays in Telegram) and an **Add to desk** link.
3. Tap **Add to desk** → the guest lands in the pipeline as *Shortlisted*.
   - If a link is missing, use **Add guest** manually: name plus public links.
4. The desk builds a **guest brief** with TinyFish → *Brief ready*.
5. **Desk chat:** "draft an invite for Arun, warm, mention his What's your dream series" → *Invite drafted*.
6. Edit → **Create invite**. The quota is checked ("3 of 5 left today"), and you get an invite link → *Invited*.
7. Ask the agent on Telegram to introduce you (Index). When both accept, a Telegram chat opens. Paste the invite link there.
8. Watch the status: *Opened → Accepted / Time suggested / Declined*. Mark *Recorded* after the session.

### 4.3 Guest
1. Accepts the Index introduction, and receives the invite link in Telegram.
2. Opens the **invite card**:
   - who's asking, with **✓ Verified human**
   - what the show is
   - why them (public facts only)
   - the proposed angle and 2–3 time options
3. Taps **I'm in / Suggest a time / Not now**, plus an optional note. No login needed.

## 5. Sequence diagrams

### 5.1 Find guests and hand off (works today, no mini-app needed)
```
Creator          Desk (web)           Telegram: own agent          Mosaic / Rolodex
  │ New episode ──►│                          │                           │
  │◄── "Ask my agent" (t.me link, prompt pre-typed)                      │
  │ taps, sends ─────────────────────────────►│ village: pair_pages ─────►│
  │                │                          │◄── written pages ─────────│
  │                │                          │ village: rolodex.person ─►│
  │                │                          │◄── public profile ────────│
  │◄── 3 guests: private "why" + "Add to desk" links (public fields only)│
  │ taps link ────►│ /add?n=…&x=…&gh=…&t=…   │                           │
  │                │ confirm → guest saved (Shortlisted)                  │
```

### 5.2 Brief and draft
```
Creator          Desk (web)                 TinyFish API          AI model API
  │ open guest ───►│ search(name + org) ──────►│                        │
  │                │ fetch(public links) ─────►│                        │
  │                │◄── pages ─────────────────│                        │
  │                │ summarise into brief + questions ─────────────────►│
  │                │◄── brief (every fact carries a source URL) ────────│
  │◄── Brief ready │                                                    │
  │ "draft invite"►│ chat with tools: brief + show pitch + my note ────►│
  │◄── draft ──────│◄───────────────────────────────────────────────────│
```

### 5.3 Verify, invite, answer
```
Creator        Desk (web)         World ID (app + portal)    Guest
  │ (once) Verify►│ POST /api/rp-signature                     │
  │◄── IDKit QR ──│                                            │
  │ World App ───►│◄── proof ──── verify v4 ───► ok + nullifier│
  │               │ nullifier ↔ creator (one human per account)│
  │ Create invite►│ quota: invites today < 5 for this nullifier?│
  │◄── /i/<code> ─│                                            │
  │ sends link in the Index-opened Telegram chat ─────────────►│
  │               │◄── GET /i/<code> (Opened) ─────────────────│
  │               │◄── POST answer (Accepted / time / no) ─────│
  │◄── status ────│                                            │
```

## 6. Architecture

```
┌──────────── PRIVATE: stays in the creator's Telegram DM ─────────────┐
│  Creator ⇄ Agent Village agent (Hermes) ── village tool ──► Mosaic    │
│                                   └── village tool ──► Rolodex        │
│                                   └── Index MCP ──► introductions     │
│  (optional, if Edge City allowlists it) green-room SKILL.md            │
│                                   └── MCP ──► our /api/mcp (reads)    │
└──────────────────┬────────────────────────────────────────────────────┘
                   │ "Add to desk" link: PUBLIC fields only
                   ▼
┌──────────── GREEN ROOM: Next.js on Vercel ───────────────────────────┐
│ Pages                         API routes                              │
│  /            landing          /api/auth/telegram  (verify login hash) │
│  /desk        pipeline board   /api/rp-signature   (World ID signing)  │
│  /episode/[id]                 /api/verify-proof   (World ID verify)   │
│  /guest/[id]  brief + chat     /api/guests, /api/invites               │
│  /add         handoff import   /api/brief          (TinyFish + AI model) │
│  /i/[code]    guest card       /api/chat           (assistant + tools) │
│  /settings                     /api/mcp            (public read tools) │
│                                                                        │
│ Postgres (Neon): creators, episodes, guests, briefs, invites,          │
│                  invite_events, chat_messages, worldid_nullifiers      │
└──────┬──────────────┬───────────────┬───────────────┬─────────────────┘
       ▼              ▼               ▼               ▼
  TinyFish API    AI model API     World ID portal   Telegram (Login
  search/fetch    briefs, drafts  verify v4         Widget, our own bot)
```

### 6.1 Data (minimum)
- **creators:** telegram_id, name, show_name, show_pitch, agent_username, nullifier (unique), verified_at
- **episodes:** creator, topic, status
- **guests:** episode, name, links[], rolodex_url?, looking_to_meet?, creator_note, status
- **briefs:** guest, story, recent_work[], questions[], sources[] (URL per fact), created_at
- **invites:** guest, code, message, angle, time_options[], created_at, opened_at, answer, answer_note
- **worldid_nullifiers:** nullifier NUMERIC(78,0), action. Quota = count(invites today for creator's nullifier) < 5
- **chat_messages:** creator, guest?, role, content

### 6.2 Desk assistant (web chat)
An AI model with these tools:
- `get_brief(guest)`: runs or reads a TinyFish brief
- `draft_invite(guest, tone, note)`
- `set_status(guest, status)`
- `list_pipeline()`

It answers only from the desk's data and public sources. It never claims Mosaic facts it wasn't given.

### 6.3 Handoff prompt (the "Ask my agent" button)
Pre-typed text, built by the desk:
> Green Room: using my Mosaic pair pages and top matches, find 3 guests for my show *<show>* on *<topic>*. For each, look them up in the Rolodex. Tell me why we fit (for me only). Then give an "Add to desk" link exactly like `https://<desk>/add?n=<name>&x=<x url>&gh=<github url>&web=<other url>&lm=<their public "looking to meet", short>&t=<topic>`, URL-encoded. Put only public Rolodex info in the link, never anything from our Mosaic page.

### 6.4 Optional mini-app (`green-room`)
- `/api/mcp`: public, read-only MCP tools `guest_brief(name, links[])` and `episode_questions(name, links[], topic)`. Public inputs only.
- `SKILL.md`: the same workflow as 6.3, plus calling these tools in Telegram.
- Submitted to Edge City for sandbox allowlisting. If it goes live, step 4.2.2 happens without the pasted prompt, and briefs also appear in Telegram.

## 7. Decided so far

| Decision | Who decided |
|---|---|
| Handoff design (no userbot, no live Mosaic on the web) | Varun |
| Booking desk is the heart of the product | Varun |
| World ID: verified-human badge + daily invite limit (1+2) | Varun; already verified |
| Mosaic privacy line (public fields only leave Telegram) | Edge City's rules |
| Solo builder. **No scope cut; code quality matters** (typed, tested, clean). Order the work so a full demo path exists early. | Varun |
| AI model provider: **Groq** (`openai/gpt-oss-120b`, OpenAI-compatible), using Varun's key. No AI model API credits. (First recorded as xAI Grok; corrected 30 Oct.) TinyFish fetches the facts; Groq (openai/gpt-oss-120b) writes the briefs, drafts and chat replies. | Varun |
| Varun's agent: **@edge_city_agent_qbdffu_bot**. This is the default for the "Ask my agent" link; each creator sets their own in Settings. | Varun |

## 8. Decisions left to the builder
- **Stack: Next.js (App Router) + TypeScript on Vercel, Neon Postgres, Tailwind.** *Builder's call.* World ID's docs are Next.js-first, and Vercel gives the public HTTPS URL that Telegram login and World ID need.
- **Model access:** the Vercel AI SDK Groq provider (`@ai-sdk/groq`). The model id comes from `GROQ_MODEL` (default `openai/gpt-oss-120b`). *Builder's call.*
- **Accounts and keys Varun sets up:**
  - Groq API key (a separate key from the other project, so they don't share a rate limit)
  - TinyFish API key (with the event coupon)
  - World ID Developer Portal app (`app_id`, `rp_id`, signing key)
  - a new Telegram bot from BotFather for the login widget (`/setdomain` to the Vercel URL)
  - Vercel account
  - Neon Postgres database
- **Quota of 5 per day, IST day boundary.** *Builder's call.*
- **One World ID verification per account** (at sign-up), not per invite. *Builder's call.*
- **Guest answers without logging in;** the invite code is the capability. *Builder's call.*
- **Spikes to run first:**
  - (a) does `t.me/<username>?text=` pre-fill a DM to a bot? Fallback: a copy-prompt button
  - (b) IDKit with Varun's credential type
  - (c) Telegram Login Widget needs our own bot plus `/setdomain`
- UI look, component library, exact copy.

## 9. Stretch (only after section 2's goals work)
1. Mini-app MCP plus SKILL.md, live in Telegram (needs Edge City).
2. Guests from outside the village, found by topic on the web with TinyFish.
3. A "Live recording" event on the village calendar (EdgeOS), and a Gold Star after recording.
4. A Green Room Telegram bot mirroring the desk chat.
5. Crew suggestions from Mosaic `team` (for example, production help).

## 10. Timeline (IST)

| When | What |
|---|---|
*Revised Fri 30 Oct. The design was finished overnight, so all building happens today.*

| When | What |
|---|---|
| **Morning, first** | Keys and accounts (section 8). Spikes. Scaffold, database, deploy to Vercel straight away so the public URL exists. |
| **Morning** | Telegram login, World ID verify, `/add` handoff, TinyFish brief. |
| **Midday** | Invites, quota, guest card, pipeline, desk chat. Send the first real invite as soon as the invite card works. |
| **Early afternoon** | Real guests (e.g. Arun, Yudhishthra, Raj). Mini-app MCP + SKILL.md if Edge City allowlists. Fix what real use breaks. |
| **15:30–17:00** | Record the 2-minute video. Write the description and the evidence of iteration. |
| **17:30** | Submit (30 minutes of buffer before 18:00). |

**Evidence of iteration** already exists in the dry run. Keep a running log:
- context read failed
- 5 of 93 pages written
- best guest at rank 54 → search by topic
- web gap → TinyFish
- userbot rejected → handoff
