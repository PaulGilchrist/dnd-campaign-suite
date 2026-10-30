# /spell-overlay sits outside the campaign-lock namespace — locked mode still accepts writes for ANY campaign name

## Summary

The spell-overlay transport is an app-level route (`/spell-overlay?campaign=<name>`), not under
`/api/campaigns/*`, so the two-phase campaign lock (`campaignLock.js:37` —
`if (!req.path.startsWith(CAMPAIGNS_PREFIX)) return null`) never inspects it, and the route itself has no
campaign-existence validation and no host gate. While the server runs `CAMPAIGN_LOCK=test-campaign`, any
network-reachable client can add/move/clear the live spell overlays of ANY other campaign (Frostfall,
Testing G1–G3) and broadcast the mutations into those campaigns' SSE streams — or grow unbounded in-memory
`spellOverlayData` entries for arbitrary campaign names.

## Steps to reproduce

Probe performed WITHOUT touching production campaigns (per campaign-lock doctrine the write leg was
exercised only against a nonexistent name):

1. Locked boot (`npm run dev:locked` — `GET /api/server-config` → `{campaignLocked:true, lockedCampaign:"test-campaign"}`).
2. `POST /spell-overlay?campaign=nonexistent-campaign-xyz` body `{"action":"clear"}`
   → **200 `{"ok":true}`** — accepted while locked, off-target, for a campaign that does not exist
   (a fresh entry is created in the server's `spellOverlayData` Map and a `spell-overlay-nonexistent-campaign-xyz`
   event is published).
3. `GET /spell-overlay?campaign=Frostfall` → **200 `{"overlays":[]}`** — cross-campaign reads of production
   campaigns are served too (read-only probe; the write leg is code-identical — the route never validates
   the campaign against the roster or the lock).
4. Contrast with the same requests against `/api/campaigns/Frostfall/npcs` (run-R/Q canon): off-target
   POST/PUT/DELETE → 403 `[campaign-lock] BLOCKED` / `Access denied`.

## Expected behavior

With `CAMPAIGN_LOCK` set, mutating requests whose `campaign` query param targets anything other than the
locked campaign must be refused (403), exactly like every `/api/campaigns/*` write lane. Ideally the route
should also 404 unknown campaign names (the characterChangeData lane has explicit phantom-campaign hygiene
in `changeData.js` saveFile).

## Actual behavior

The route accepts any campaign string in any mode: state mutations for production campaigns and memory
entries for garbage names are honored, each echoed live into the target campaign's SSE room
(`publish('spell-overlay-<campaign>', …)`). The GM-gate question is separate and intentional (the player
map toolbar deliberately keeps Spell/Ruler for the GM's own campaign) — this bug is the LOCK +
campaign-existence gap, not the player-write design.

## Likely location

Confident: `server/routes/spell-overlay.js` (no lock/existence/host checks anywhere in the file) +
`server/utils/campaignLock.js:37` (`CAMPAIGNS_PREFIX` scope) + `server.js` mount order. The route predates
the lock doctrine and was never migrated under `/api/campaigns/:campaign/...`.

## Suggested fix

Cheapest: in `spell-overlay.js`, before the switch, reject when the campaign is not the locked one — e.g.
read `getCampaignLock()` (campaignLock export) and 403 off-target writes while locked; additionally 404 when
`fs` campaign dir does not exist. Structurally cleaner: move the transport to
`/api/campaigns/:campaign/spell-overlays` so the existing lock middleware covers it automatically — but
that changes the URL the client hook + Vite proxy + SSE key convention all use (bigger blast radius).
Note the SSE key `spell-overlay-<campaign>` can stay as-is — it is already campaign-scoped.

## Severity

Data integrity risk — small blast radius (overlays are runtime-only memory, never persisted) but the
pattern is exactly the class previously adjudicated as security bugs worth closing (campaign-mgmt LAN 403
654b9ee2a, char-delete ac36b2e8b, map POST f92c49712): a network client can mutate/clear live state of
production campaigns while the lock promises it can't.

## Resolution

**FIXED — 2026-10-30 fix run (spell-overlay lock bypass).**

### What was actually wrong

As diagnosed: `/spell-overlay` is an app-level route whose campaign arrives as a
query param, so the path-based two-phase lock (`campaignLock.js` —
`describeCampaignPath` returns null outside `/api/campaigns`) never inspected it,
and the route had no lock check. Live repro on the locked boot (Express :80)
pre-fix: `POST /spell-overlay?campaign=nonexistent-campaign-xyz {"action":"clear"}`
→ **200 `{"ok":true}`**, an `add` leg created a phantom `spellOverlayData` entry
(read-back served it live), while the identical off-target shape on
`/api/campaigns/Frostfall/npcs` correctly 403'd.

One nuance vs the original guess: `campaignLock.js` exported **no** `getCampaignLock()`
getter (the bug file assumed one) — the lock name lived only as a param threaded
from `server.js` into the two middleware factories. And the lock doctrine for
READS is pass-through (`READ_METHODS` in the middleware let cross-campaign GETs
answer even while locked), so the fix mirrors that: **GET stays open, POST is
guarded**. The "also 404 unknown names" ideal is subsumed: while locked, every
unknown name is off-target → the cheap 403 already refuses it before the Map or
`publish()` are touched; an unlocked-mode existence check would break the
multi-campaign contract deliberately pinned by `spell-overlay.test.js`
(campaign-a/campaign-b writes → 200), so it was skipped.

### Files changed

- `server/utils/campaignLock.js` — added `setCampaignLock`/`getCampaignLock`
  (module-level runtime single source for the decoded lock) and exported the
  previously-private `blockRequest` so every enforcement point emits the identical
  `[campaign-lock] BLOCKED …` stderr line + 403 JSON shape.
- `server/routes/spell-overlay.js` — POST handler now calls
  `refuseLockedOffTargetWrite(req, res, campaign)` immediately after the 400
  param check and before touching `spellOverlayData`/`publish()`; GET untouched
  (read doctrine) + rationale comment.
- `server.js` — calls `setCampaignLock(CAMPAIGN_LOCK)` once at boot (after the
  existing env parse, single source preserved).
- `server/routes/spell-overlay-campaign-lock.test.js` — NEW regression suite
  (7 tests): locked+fake-name POST → 403 lock-canonical shape + log line + no
  Map entry + no publish; locked+Frostfall POST → 403 before state access
  (production overlays untouched); all four actions refused; locked on-target
  POST → 200 ok + publish unchanged; locked reads → 200; unlocked any-campaign
  POST → unchanged 200; 400 precedence kept.

### Verification

- Unit: `npx vitest run server/routes/spell-overlay-campaign-lock.test.js` → 7/7;
  folder+siblings → 66/66; **whole `server/` suite → 98 files / 1814 tests green**
  (existing `spell-overlay.test.js` untouched and passing = unlocked behavior unchanged);
  `npm run lint` → 0 errors / 0 warnings (one complexity hit fixed by extracting
  the guard helper).
- Live (fresh `npm run dev:locked` boot, `server-config` → `{campaignLocked:true,
  lockedCampaign:"test-campaign"}`): off-target fake-name `clear` and `add` POSTs →
  **403 `{"error":"Campaign locked to \"test-campaign\" — POST /spell-overlay denied"}`**;
  POST `campaign=Frostfall` → same 403 (guard checks lock FIRST — never reaches
  disk/Map); GET fake-name → 200 `{"overlays":[]}` (phantom `add` refused so the
  entry was never created; the pre-fix phantom died on the restart); on-target
  test-campaign POST → 200 `{"ok":true}`; `/api/campaigns/Frostfall/npcs` POST →
  403 unchanged; exactly 3 `[campaign-lock] BLOCKED POST /spell-overlay` audit
  lines in the server log matching the three refusals.
- Browser (Playwright, :5173, test-campaign, two tabs): Battle Arena map editor →
  Spell lane → cone placed (tab A `g.spell-overlay-group` 1, server overlay listed),
  tab B **SSE-mirrored within ~400 ms zero-reload**, Clear All → both tabs 0,
  server `{"overlays":[]}`. End-to-end overlay flow intact post-fix.
- Cleanup: test-campaign change-data cleared to `{}`, log cleared to `[]`,
  overlays `[]`; no `nonexistent-*` entry reachable (writes refused).

