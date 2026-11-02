# Plan — Levels 1–4 COMPLETE (replaces `levels-1-4-strengthening.md` + `arena-starter-build-and-verify.md`)

> Written 2026-11-02 at the close of the arena/starter execution session. Every buildable
> item in BOTH superseded plans is implemented, unit-tested, and **live-verified in
> Playwright with zero console errors**; baselines were restored (test-campaign
> change-data `{}` + log `[]`, verified two-pass closed-tab; no `qa-*` folders left;
> production campaigns untouched). This file carries only the genuinely-open work —
> the owner-deferred **Level 5 re-analysis** — plus small accepted deviations and
> optional polish so nothing is silently dropped.

## 1. Completion ledger (evidence, not intent)

| Phase | Delivered | Live proof (2026-11-02, localhost:5173 + LAN tab) |
|---|---|---|
| 3.1 Arena | `seededCampaign.js` orchestrator + ARENA_PRESET (2 `carveArena` halls, first activated; 3 sparring encounters, real bestiary names), `SeededCampaignModal` + New Arena button (localhost-only), teams = 🤝 Allies, XP/loot opt-in | Created `qa-arena` in one click → maps + pool render → joined Goblin Pack (AC 15 / 7(2d6) / art resolved) → 🎮 assigned Goblin 1 to FeyRanger → **LAN player tab opened its full stat block and rolled a real d20 (19+4=23 popup, `attack` log row)** → ally team assignment → friendly-fire confirm (verbatim message + log-flagged row) → TV spotlight/up-next → Clear → honest victory ("0 foes defeated · 5 drove off") → typed-name Admin delete → folder gone, production clean, 0 console errors |
| 4 Starter | STARTER_PRESET (village + layer rumours, hex wilds w/ settlement + dungeon-POI portal + party marker, BSP dungeon w/ chest loot, 3 generated quests, Wave 1-3, `data/starter-seed.json` via new GM-write route), `FirstSessionChecklist` (generated names, per-step deep links, dismissible, zero writes), Admin → Regenerate adventure (layer counter, `pastTitles` re-pointing) | Created `qa-starter` → checklist named the rolled entities ("Hartwell", "The Crystal Tomb of the Dead") → settlement/hex/dungeon/quests all render → joined Wave 1 + TV + victory → **Regenerated twice: new dungeon file + md5 differs, old map deleted, POI + ALL quests + village rumours re-pointed (zero stale titles), settlement + party + log kept, checklist live-refreshed without reload, layer 1→2→3** → delete verified, 0 console errors |
| 3.2 validation | Audited every ally/hostility consumer (the `type==='player'` grep): auraOfProtection, elderChampion, auraDamageService, savePromptUtils, handleAoeDamage (careful), spellGates = already ally-aware, flip tests pre-existing; **fixed genuine assumptions**: wolf/lion bearer gate (grantor-side), sneak flanking (attacker-list override), opportunity-attack hostility (mover-list override, legacy default kept), duplicity/corona adjudicated NOT-assumptions (explicit per-use grants/enemy lists); NEW friendly-fire confirm on tracker target arming | Flip tests: wolf/lion (+4), sneak (+2), OA (+3), friendly-fire (+6 incl. cancel-inert), `hasExplicitAllyList` (+4); test-campaign ally edits persisted with verbatim audit rows (screenshot) |

Gates at close: `npm run lint` 0 warnings · `npm run test:run` 33,057+ green ·
`npm run guard:no-timers` OK (checklist/floaters add zero timers).

## 2. Defects found by LIVE verification that unit tests had missed (all fixed + pinned)

1. **Fresh-campaign tracker blank** — legacy SSE-timing gate hid the whole board until
   `characters.length > 0`; a pickup arena with joined monsters showed nothing. Now
   `boardHasSubjects()` (players OR creatures). Pinned in the friendly-fire test file.
2. **`handleClear` crash on zero characters** — `newSummary.creatures[0].name` threw.
   Now `?.` + skip re-arm. Pinned.
3. **Seeded quests 409'd the resurrection guard** — fresh-create rows must NOT echo
   `updatedAt`. Pinned (`q.updatedAt === undefined`).
4. **Settlement GET-single answers `{settlement}` envelope** — rumor re-point PUT'd
   `/settlements/undefined`. Unwrapped + pinned with the wrapped mock.
   (Plus `pastTitles` so a 2-generations-old dungeon title can't haunt village rumours.)

Recurring lesson for future sessions: **the fetch-mocked suites cannot see the CRUD
concurrency guards or the campaign-shape envelopes; any new orchestrator lane must get
at least one live run against the real server.**

## 3. Accepted deviations (owner-sanctioned by the newer plan's text)

- **Arena carve** post-processes `generateDungeon` output (`carveArena`, documented
  options gridSize 24/20 · density 0.55 · hall rect + twin side entrances) instead of
  adding generator knobs (parent §3.1 "expose presets"). One orchestrator-local
  function; the generator pipeline stays untouched.
- **Checklist writes nothing** (arena-starter §3.3 supersedes parent §4.2's
  `starter-checklist.json` done-flags). Dismiss is per-client UI state.
- **Teams popover** = the 🤝 Allies editor (arena-starter §2.4 supersedes the parent's
  dedicated popover). A thinner "Team A/B" convenience remains OPTIONAL polish below.
- **Rematch** rides existing lanes: re-Join the saved encounter (fresh monster roster)
  + rest flows restore heroes — no new code (parent §3.1 flow intent satisfied).

## 4. OPEN — the deferred work

### 4.1 Re-analyze Level 5 (solo / GM-optional) — PRIMARY
The owner parked this until Levels 1–4 were strengthened; they now are. Re-open
`.opencode/plans/level-5-architecture.md` (v2.1) with a fresh pass:
1. **Re-verify §2 findings against today's code** — the L1–4 strengthening landed new
   rails L5 must reuse, not rebuild: `controller` on cs rows + `creatureControl.js`
   precedence (turn-ownership primitive for §12 authority), `selectedAllies` +
   `hasExplicitAllyList` as the single allegiance model (hostility for OA/enforcement),
   `boardHasSubjects` + zero-char clear (arena/solo-table boards), the
   enforcement-accepted `control_assigned` audit rows, and the seeded-campaign
   orchestrator (solo sandbox bootstrap — a starter-roll could seed a solo L5 run).
2. Re-check the gate call-site census (~30 then), the GM-enforced marker count (~1,015
   then), and round-latch keys against current code before touching D2.
3. Confirm Phase 0–4 shipped-state vs the hardening-pass §17 checklist; update
   `docs/app-exploration.md` coverage rows for anything L5 work touches.
4. Owner decisions needed: does solo mode default a starter-roll campaign? does
   turn-lock accept `controller` devices as first-class (the §2.4 L5 rail was seeded
   in Phase 2)?

### 4.2 Optional polish (tiny, only if nearby)
- `starter-seed` PUT publishes no SSE — cross-tab regenerate refresh is reload-only
  (same-tab live refresh already via `starter-seed-changed`). Publish
  `starter-seed-<campaign>` + subscribe if a real table stumbles on it.
- "Assign Team A/B" one-click popover writing ally lists (parent §3.1 sketch) — only
  with owner ask; the editor covers today.
- `users-guide` §3 level table already links TV; consider a "Starter" hint in §4's
  first step once L5 re-analysis settles naming.

## 5. Housekeeping done this session
- QA-locked API doctrine (`CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter'`) +
  closed-tab two-pass baseline restore re-proven; screenshots under gitignored
  `.playwright-mcp/qa-*.png`.
- Server gotcha recorded in AGENTS.md: starter-seed route mounts BEFORE
  `campaigns-changedata.js` (else the `:key` wildcard swallows it).
- Docs updated: `docs/users-guide.md` (§4 Arena/Starter quick-starts + §7
  Teams/Alliances/Betrayal), `README.md` (Arena, Starter, Allegiance bullets),
  status tables in BOTH superseded plans now read DONE + LIVE-VERIFIED.
