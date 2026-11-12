# bug-npcs-factions-settlements-lanes-no-origin-guard

## Summary

Three planner/management CRUD lanes — `server/routes/npcs.js`,
`server/routes/factions.js`, and `server/routes/settlements.js` — carry NO
origin guard of any kind (grep-zero for `isLocalhost`/`refuseUnlessGm`/403 in
all three files), while all three sidebar entries are `localhostOnly: true`
(`src/components/sidebar/Sidebar.jsx`: factions :38, npcs :47, settlements :51).
A network (LAN/visitor) client can therefore GET the full lists and
POST/PUT/DELETE rows outright — violating the AGENTS.md doctrine "GM features
are localhost-only: … map editing, quest/faction/NPC management … network
clients get read-only view." This is the same family fixed three times in one
session (notes → 8d93705a5 GM-writes gate, sessions → 2081e3a65 whole-lane
gate, quests → eced35cf6 whole-lane gate); discovered by the quests fix run
(grep census reported in its return message, re-verified by the primary 2026-11-12).

Where a lane has a visibility filter on reads, the missing write gate also
reproduces the hidden-label 409 leak mechanism documented in
bug-players-can-never-save-notes-when-any-private-note-exists and
bug-quests-write-lane-no-gm-guard-leaks-hidden-quest-labels (a visitor's
snapshot can never include rows the read lane hides, so the concurrent-save
guard 409s naming hidden GM content).

## Steps to reproduce

1. In test-campaign, as GM (localhost), ensure at least one row exists in each
   lane (NPC / Faction / Settlement list views, or the equivalent whole-array
   POST).
2. From a visitor origin, read:
   `curl -H 'Host: 192.168.0.44' http://localhost/api/campaigns/test-campaign/npcs`
   (and `/factions`, `/settlements`) → HTTP 200 with the full GM lists.
3. From the same visitor origin, POST a whole-array snapshot appending one row
   to any of the three lanes → 200 `{"success":true}` (when the snapshot
   matches disk, e.g. empty-state campaigns or after the GET in step 2), and
   GET on localhost shows the visitor row persisted to
   `public/campaigns/test-campaign/data/*.json`.
4. Per-row PUT/DELETE lanes likewise have no origin check.

(Steps 2–3 are the doctrine-level face and are code-confirmed grep-zero; the
live POST-lands witness must be confirmed in test-campaign by the fixer before
code changes, per the verify-then-fix protocol.)

## Expected behavior

Per the GM-only doctrine and the three shipped siblings, non-localhost clients
must be refused on the write lanes with 403 `Access denied: GM-only feature`
before any conflict logic runs; the read face per lane is a triage call the
fixer must ground in a client-consumer grep (see Suggested fix).

## Likely location

- `server/routes/npcs.js`, `server/routes/factions.js`,
  `server/routes/settlements.js` — all built on
  `server/utils/jsonEntityCrud.js` `createJsonEntityRouter` with no origin
  hook; any custom lanes mounted alongside have no gate either.
- Reference implementations (shipped this session): `server/routes/notes.js`,
  `server/routes/sessions.js`, `server/routes/quests.js` — path-scoped
  `refuseUnlessGm` wrapper `Router()` mounted BEFORE `router.use(baseRouter)`,
  canonical 403 copy + `[<lane>] BLOCKED non-localhost <METHOD> <URL> — GM-only`
  dev-log.

## Suggested fix

Mirror the sibling wrapper per lane (do NOT modify the shared
`jsonEntityCrud.js` factory — the per-route wrapper is the shipped pattern).
Read-face decision per lane: grep the client for every consumer of each
endpoint and check whether any visitor-visible view legitimately reads it
(the quests fixer's method). Precedent: lanes with no legitimate visitor read
consumer became whole-lane GM gates (sessions/quests); lanes where visitors
legitimately read but must not write get the writes-only gate (notes). Known
nuance to verify: npcs data may be consumed by player-side features (e.g.
runtime NPC references) — confirm each consumer's origin before gating GETs.
Pin each lane with a `<lane>-localhost-guard.test.js` mirroring
`notes-write-localhost-guard.test.js` / `quests-localhost-guard.test.js`.
Correct any stale read/write-authority claims about these lanes in
`docs/app-exploration.md` / playbook §36 in place afterwards.

## Severity

Data-integrity risk / enforcement hole — any LAN player can silently rewrite
the GM's NPC, faction, and settlement planning stores, and any visibility-
filtered read in these lanes leaks hidden GM labels via the 409 conflict copy.
No player-visible UI path (sidebar hides all three) but the API is directly
reachable.

## Resolution

FIXED 2026-11-12 (fix run). All three lanes reproduced live in test-campaign
BEFORE any code change (forged `Host: 192.168.0.44` through the :5173 proxy —
the en0 IP is literally 192.168.0.44, so this matches a genuine LAN origin):
visitor GET 200 full GM dumps on all three lanes; visitor whole-array POST
(factions, honestly-echoed snapshot) 200 `{"success":true}` and the probe row
PERSISTED to `data/factions.json` (md5 moved); visitor DELETE 200 landed (probe
row removed). Probe rows cleaned; `factions.json` md5-restored byte-exact
before touching code. No lane was already guarded — none DISPROVED.

### Per-lane read-face decisions (client-consumer grep witnesses)

- **npcs → WRITES-ONLY gate (notes face).** Legitimate visitor READ consumers:
  `src/components/initiative/Initiative.jsx:421` mount effect `loadNPCs(...)`
  with NO isLocalhost condition (Initiative is visitor-visible — sidebar NAV
  item has no `localhostOnly`); `src/services/automation/contextBuilder-map.js:25`
  and `src/services/automation/common/damageRoll.js:63` `loadNPCs(...)` inside
  the PLAYER attack pipeline, which runs on visitor-origin tabs — a 403 there
  rejects the Promise.all and the `.catch(() => basePromise)` / `catch` fallbacks
  silently strip map-aware cover/range/melee-proximity math from player rolls.
  So GET stays open; every non-GET method now 403s before any conflict/image
  logic runs.
- **factions → WHOLE-LANE GM gate (sessions/quests face).** Only client consumers
  of `/factions` are `src/components/factions/Factions.jsx` (sidebar entry
  `localhostOnly: true`) and `src/services/campaign/draftActions.js`
  (CampaignBuilder Drafts, `localhostOnly: true`). No visitor read consumer →
  every method 403s. No lane-level visibility options existed to remove (the
  factory-wide draft-hiding stays as-is; unreachable-but-shared code).
- **settlements → WHOLE-LANE GM gate.** All `/settlements` consumers are
  GM-only surfaces: `Settlements.jsx` (sidebar `localhostOnly`), the Sessions
  planner picker (`Sessions.jsx`, lane fully GM-gated since 2081e3a65), Campaign
  Admin `AiWorldConsole.jsx` (Admin footer renders only `isLocalhost &&`),
  `draftActions.js` (Drafts, `localhostOnly`), `seededCampaign.js` (Admin
  regenerate flow). No visitor read consumer → every method 403s, including the
  custom PUT-upsert lane (the path-scoped gate wraps the whole router).

### Files changed

- `server/routes/npcs.js` — `Router()` wrapper, path-scoped
  `refuseUnlessGm` on non-GET under `/api/campaigns/:campaign/npcs` BEFORE
  `router.use(baseRouter)`; canonical 403 `Access denied: GM-only feature` +
  `[npcs] BLOCKED non-localhost <METHOD> <URL> — GM-only` dev-log. Factory
  untouched.
- `server/routes/factions.js` — same wrapper face, EVERY method; export
  converted from bare factory router to wrapper `Router()`.
- `server/routes/settlements.js` — same wrapper face, EVERY method (covers the
  custom PUT upsert too).
- NEW `server/routes/npcs-localhost-guard.test.js`,
  `server/routes/factions-localhost-guard.test.js`,
  `server/routes/settlements-localhost-guard.test.js` — mirror the
  notes-write/quests guard-test conventions (real factory, mocked fs/paths/
  changeData): visitor-origin 403 + canonical copy + disk inert + zero
  broadcasts for every gated method (incl. PUT upserts), localhost lanes
  byte-unchanged (GET/POST/PUT/DELETE + stamped writes + `*-list-<campaign>`
  replaced/created/deleted broadcasts), npcs file additionally pins visitor
  GET-open (list + single row 200).

### Verification

- Unit: `npx vitest run` on the 3 new guard files → 78/78 pass; full
  `server/routes` folder → 108 files / 1704 tests pass (no pre-existing pin
  encoded the old visitor face — none needed updating); `npm run lint` clean
  (zero warnings); `no-timers-guard` OK.
- Live (API restarted post-fix, dev pair on :80/:5173, forged-Host census):
  visitor POST/PUT/DELETE all three lanes → 403 `Access denied: GM-only
  feature` (verbatim bodies), `[npcs|factions|settlements] BLOCKED
  non-localhost …` dev-log lines, disk md5s byte-matched baselines
  (npcs db6666c1…, factions 9ba33154…, settlements ac5681f4…); visitor GETs:
  npcs 200 (full list), factions 403, settlements 403 (list AND single row);
  localhost GETs all 200.
- GM UI CRUD re-lived on all three lanes (create → edit → native-confirm
  delete of probe rows; confirms byte-pinned `Delete NPC "<name>"?` /
  `Delete Faction "<name>"?` / `Delete Settlement "<name>"?`; fixtures untouched —
  npcs.json stayed Marta-only, no bestiary names written).
- Visitor-facing adjacent flow (npcs keeps visitor reads): genuine LAN tab at
  `http://192.168.0.44:5173` → test-campaign → Initiative mounts clean, its
  mount GET /npcs 200, in-tab probes 200/403/403, zero pageerrors, GM-only
  sidebar entries hidden.
- Exit hygiene: change-data `{}` + log `[]` (closed-tab two-pass admin clears),
  all three lane files md5 = pre-run baselines, `git status --porcelain
  public/campaigns/` EMPTY, servers killed by port-PID.

Note for the owner-facing doctrine line in AGENTS.md ("network clients get
read-only view" for quest/faction/NPC management): factions/settlements (like
quests/sessions before them) are now STRICTER than read-only — the whole lane
403s non-localhost; npcs is the read-only exception by the runtime-consumer
evidence above.
