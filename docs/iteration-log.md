# Green Room: iteration log

What we tested, what it taught us, and what we changed. Times are IST.

## Thu 29 Oct: research and a dry run on a real Agent Village agent

**Idea at the start:** "Use Mosaic to match creators with guests and draft an invite."

1. **Read Edge City's `agentvillage` repo.**
   - **Learned:** Mosaic has no public API. Only a resident's own agent can read it, through the `village` tool, and only inside their private Telegram chat. Its privacy rules forbid sharing pair pages with other apps or with the people named.
   - **Changed:** a website can't read Mosaic. Green Room became a booking desk that receives *public* facts from the creator's own agent, plus an optional mini-app (a public, read-only MCP service and a skill file) for Edge City to switch on.

2. **First dry run (top matches):** `not_in_mosaic`, even though the app showed matches.
   - **Learned:** Mosaic needs its guided questions finished before the agent can read anything.
   - **Changed:** setup now tells the creator to finish Mosaic first, and to add their creator side to it.

3. **Second dry run:** top 5 returned, but no pair pages were written yet.
   - **Learned:** the `why` lines followed my other goals (hiring, my developerbot), not my show.
   - **Changed:** search by episode topic across the pair pages, not by rank.

4. **Topic search:** the agent read **5 written pages out of 93 people**, and the best guest for my show was **rank 54**.
   - **Changed:** the "Ask my agent" prompt asks the agent to say which page links to open, so later searches cover more of the circle.

5. **Mosaic summary read:** `mini_app_not_installed`.
   - **Learned:** that part of Mosaic is switched off for now.
   - **Changed:** Green Room doesn't depend on it.

6. **Rolodex profile:** it holds public "looking to meet" and "offers" sections.
   - **Changed:** invites use them to say *what's in it for the guest*.

7. **TinyFish on a guest's public links** (GitHub and X): a full career story and a talk from 6 days earlier, in about 2 seconds.
   - **Learned:** Agent Village deliberately doesn't search the web (its Index skill says so), so this is the gap Green Room fills.

8. **"Can the web desk chat with Mosaic directly?"**
   - **Learned:** only by logging into the creator's personal Telegram account (a "userbot"). That means full account access, and it bypasses Mosaic's private-chat guard.
   - **Changed:** rejected for privacy. We built a handoff instead: the agent's "Add to desk" link, which carries only public fields.

9. **"Isn't this just the bot?"**
   - **Changed:** refocused on what doesn't exist yet: guest research with sources, World ID–verified invites with a 5-per-day limit, the guest's answer, and a booking pipeline.

## Fri 30 Oct: build, test first

| What we found | What we changed |
|---|---|
| The prompt template had placeholders with spaces (`<x url>`), so the link broke at the first space and lost the episode id. Caught by a test that fills in the template and parses the result. | Placeholders now have no spaces. |
| When a creator pastes an invite link, Telegram's link-preview bot fetches it straight away, which would mark the invite "Opened" before the guest saw it. | Link-preview bots don't count as opens (tested). |
| Two quick clicks could both pass the daily-limit check and create a 6th invite. | The limit check and the insert now run in one locked transaction. |
| The model could cite a URL it never read. | Facts and recent work whose source wasn't actually fetched or found are dropped, so no invented facts reach an invite. |
| A guest with almost no public web presence. | The brief says "limited public information" instead of guessing. |
| An "Add to desk" link carrying unexpected params (text pasted from Mosaic, `javascript:` links). | Only allow-listed public fields are ever read. |
| The full test suite timed out when 14 in-memory databases started at once. | Test workers capped at 4. 159 tests pass. |

## Still to verify on the live deployment

- [ ] Telegram login (needs the login bot's `/setdomain` set to the deployed URL)
- [ ] World ID with Varun's credential in the World App
- [ ] Does `t.me/<bot>?text=` pre-fill the message to the agent on phone and desktop? ("Copy prompt" works either way.)
- [ ] A real brief and draft with the xAI key
- [ ] 2–3 real guests invited, and at least one answer
- Telegram OIDC id_token: docs show `id` as a number, but real tokens send it as a string of digits. Found from production logs (claim names/types only), fixed with a test.
- World ID: World App rejected the request with "Feature unavailable: enable Selfie Check for your app" because Selfie Check (beta) needs World to enable it per app. Dropped it from the accepted credentials (Orb or passport remain).
- Groq strict structured output rejects any optional field: briefs failed in 0.3 s on the first real call (recentWork.date was optional). Made it nullable, added a test that every schema field is required, proved it against real Groq.
- Live end-to-end test: a desk brief took 79 s. Measured each stage: TinyFish ~12 s, Groq ~1 s per call, but the free tier's 8,000 tokens/min limit made the SDK wait and retry. Capped page text (2,500 per page, 9,000 total) to roughly halve tokens per brief; tested.
- Live end-to-end test: the desk brief took 79 s. TinyFish was 12 s; the rest was Groq's free tier (8,000 tokens/min) rate-limiting a burst of briefs while the AI SDK silently retried. Capped page text at 2,500 chars per page and 9,000 in total (about half the tokens), with a test.
