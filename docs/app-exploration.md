# App Exploration Map

**FRESHLY FOLDED — new generation, fold stamp 2026-11-23** (prior generation 2026-10-30→2026-11-22 archived whole to `docs/app-exploration-archive-2026-11-22.md`). Facts below are either live-verified by the run named on the row (dated) or `(carried — unverified)` from the archive. Per-run narratives live in the archive; durable mechanics live in `docs/test-setup-playbook.md`.

**Run WW 2026-11-23** — novelty: first live descent of the LAN-visitor × ct-* kit chrome (two-host rig, GM-localhost vs LAN-IP isolated context) — 2 bugs filed (`bug-visitor-arms-any-pc-target-cross-player-write`, `bug-visitor-edit-wizard-unguarded-character-file-put`); first live descent of token-art prune × map rename / DELETE / Admin Regenerate — 1 bug filed (`bug-map-delete-regenerate-strand-token-art-forever`: map DELETE + regenerate strand `images/token-*` forever); stale-since-RT throwaway quick-create rows re-derived live on qa-arena + qa-starter — clean (preset-affinity prefill, sync type stamp, refuse→focus-restore, typed-name delete both faces), both throwaways deleted, no re-materialization; narrow-viewport GM kit-tier measurement — 1 improvement bullet.

## Baseline Fingerprints (live WW 2026-11-23, re-verify at entry and exit)

- change-data `{}` + log `[]` + overlays `[]` at exit, closed-tab two-pass survives (no select-rehydrators with tabs closed).
- battle-arena md5 `94fcd0bfe9e4cf6e1118f736b920e7a2`; `data/npcs.json` `db6666c122d32291ff11d340a6564c02`; `data/inventory.json` `7638da675a912f7a334276a2b6624dfb`; 13-char aggregate (`md5 -q *.json | md5 -q` from campaign root) `fb536d55e68b047904c6943c05b0c0f8`.
- `images/` holds ONLY `ElderPaladin.png`; `maps/` = battle-arena, item-showcase, poi-showcase, test-map (none active); `public/campaigns/` = 5 baseline folders.
- Mount-merge caveat confirmed: GM+visitor Initiative mounts leave a `combatSummary` (13-PC placeholder board) in change-data with zero deliberate writes — admin clear is still mandatory at closeout.

## Coverage

Rows tagged with verifying run + key source paths. Unlisted lanes' prior depth lives in the archive generation; treat as `(carried — unverified)` until re-entered and event-checked.

| Surface | Depth | Verified | Notes / key paths |
|---|---|---|---|
| LAN-visitor × ct-* kit chrome | deep | WW 2026-11-23 | Two-host census (GM :5173 vs LAN-IP isolated ctx): visitor sidebar is an honest reduced set (no Drafts/Encounters/Factions/GM Screen/Notes/NPCs/Quests/Sessions/Settlements/Admin; Maps→Map); Initiative = 13 cards/0 inputs/13 target-selects; Log composer note-voice, no `#log-note-type`; Inventory read-only (0 buttons); Quest Board = read-only standings+cards, click opens NO modal; Map empty state `Waiting for the GM to open a map…` + `Check Again`; avatar click opens read-only sheet; console 0 errors/warnings visitor-side. FOUND 2 BUGS: PC target-select arms any character cross-player (filed) and sheet Edit/`Upload` ungated + char-file PUT unguarded (filed). `src/components/initiative/TargetSelect.jsx`, `src/components/initiative/createCreatureHandlers.js`, `src/components/char-sheet/char-summary/CharSummary.jsx`, `server/routes/campaigns-character.js` |
| token-art prune seam (PUT lane) | deep | WW 2026-11-23 | Live: replace → superseded file unlinked; shared-token keep-set (row2 on same path survives row1 delete); prune works through a RENAMED slug; rename itself never touches art (imagePath is campaign-images-relative). `server/routes/maps.js` (orphanedTokenArt/pruneOrphanedTokenArt, PUT handler) |
| map DELETE + Admin Regenerate × token art | deep | WW 2026-11-23 | Strand CONFIRMED both legs, FIXED 2026-11-23 (DELETE route now runs disk-wide `pruneStrandedTokenArt`, regenerate inherits): API map-delete had left referenced `images/token-*` behind (reclaim lanes were only PUT-seam unlink + whole-campaign rmSync); UI ride in qa-starter: art placed on seeded dungeon → Admin Regenerate → old dungeon file deleted, POI/quests/layer/pastTitles honest, but art orphaned → `bug-map-delete-regenerate-strand-token-art-forever`. `server/routes/maps.js` DELETE, `src/services/campaign/seededCampaign.js regenerateAdventure` |
| Quick-create throwaways (arena/starter) | deep | WW 2026-11-23 (re-derived — 5 commits landed since RT: 923cb9723/a1103ebac/454b1dcab/31746ce47/7ea86b333) | Starter modal prefills `qa-starter` (preset affinity), Arena modal `qa-arena`; honest lock-note from current input; `role=dialog` tier on overlay; duplicate-name refuse → `Campaign already exists` inline, modal stays, FOCUS RESTORED to name input (454b1dcab live); type map answers `starter`/`arena` immediately post-create (31746ce47); seeded content: starter = hex+countryside POI+dungeon+3 quests, arena = 2 halls + 3-row sparring pool; Admin typed-name delete: disabled→armed transition both faces, deletes folder, no re-materialization; delete from within throwaway routes back to campaign-select. `src/components/campaign-selection/`, `src/services/campaign/seededCampaign.js`, `server/routes/campaigns-starter-seed.js` |
| Admin → Regenerate adventure (core roll) | deep | RT 2026-11-22 (archive) + WW 2026-11-23 partial re-ride (success strip, maps-dir exactly-2, POI/quest re-point, layer/pastTitles, audit strip copy) — all held | Extra face found WW: token-art strand (filed above). `src/services/campaign/seededCampaign.js` |
| Initiative board (GM) | deep *(carried — unverified)* | archive ER/EQ/FU/OC etc. | Join/renumber/walk/clear laws in playbook §4; not re-entered GM-deep this run (only mount + ct census + narrow-viewport measurement) |
| Combat pipeline / monster chips / save prompts | deep *(carried — unverified)* | archive | See playbook §4/§10 + archive generation; untouched this run |
| Maps: hex board, fog, lighting veil, 3D | mixed *(carried — unverified)* | archive | Lighting veil × visitor multi-tab NOT descended (next-run target) |
| TV presentation / victory banner / sound owner | mixed *(carried — unverified)* | archive ER/CV/TT + cc359c8ef | TV-presence beacon × mid-ceremony reload NOT descended (next-run target) |
| Encounters EB / draft modal / refine hosts | deep *(carried — unverified)* | archive PPP/RT | Not entered this run |
| Log (composer faces, ai_* chrome, session stamp) | shallow-live this run | WW 2026-11-23 | Only visitor composer face + empty state + clear/verify lane re-derived; GM faces carried-unverified |
| Notes/Sessions/Inventory/Quests management | shallow *(carried — unverified)* | archive NN | Visitor read faces witnessed WW; editor lanes not entered |
| Character wizard (edit mode) | shallow | WW 2026-11-23 | Opened via ungated visitor Edit (bug filed); opens at Step 2 pre-filled from disk; close (×) with no changes = zero confirm, zero writes. Full walk laws in playbook §11 |
| ct-kit narrow-viewport tier (GM) | shallow | WW 2026-11-23 | At 420px Initiative/Encounters toolbars park buttons off-window (see Improvement backlog); Quests/NPCs clean |
| SSE multi-client fan-out, dual-ruleset mixed boards, print face | not explored this run | — | Floor-menu surfaces left for next cycle |

## Priority Targets (next descent)

1. **Carries from prior stub not yet ridden:** TV-presence beacon × mid-ceremony reload/bfcache (`useTvSoundPresence`, cc359c8ef); lighting veil × visitor multi-tab fan-out (`2c2d7217b`); ct-converged CharSheet `@media print` face; nested-modal + `.ct-btn-sm` screenshot pass at narrow widths (GM side).
2. **Aftermath legs of this cycle's bugs** (re-derive once fixed): visitor arm-gate faces (`TargetSelect` ownership predicate + does sheet-lane arming still work for the owning player?); char-PUT GM gate (wizard unreachable from visitor + does Download stay?); DELETE-seam prune (`ls images/` after map delete + regenerate).
3. **Blocked-ledger carries** (owner/infra-gated, unchanged): Nature's Sanctuary/Smite cover forks; Load-seam race; Grease fail/prone leg; real-model autopilot/director round-trips; DeleteLockNote UNLOCKED face; audible audio legs.

## Key UI Patterns & Selectors (live WW 2026-11-23 unless noted)

- Campaign select: `.campaign-button` (verify list rendered before judging siblings); quick-create trio `New Campaign` / `New Arena Battle` / `New Starter Adventure`; seeded modal = `.modal-overlay` + `input` (placeholder `Enter campaign name`), `Create`/`Cancel`.
- Visitor-origin proof: LAN-IP tab via `browser.newContext({isolatedContext:'lan'})` → `http://<en0-ip>:5173`; confirm `window.location.hostname`; localStorage is per-origin so GM/visitor tabs hold independent pref keys.
- Sidebar: `button.sidebar-section-header` — click navigates (Log is two-behavior); visitor set is the reduced list above (census it before judging "navigation frozen" — a click on a header a visitor doesn't have silently no-ops, WW false-scare).
- Initiative: `.creature-card`; GM inputs `input[aria-label="<Name> current HP"]`; target select `select[aria-label="<Name> target"]` (`data-testid="target-select"`) renders on EVERY PC card for EVERY origin (bug-1) and only for controlled rows on monster cards; visitor cards are plain spans + enabled selects.
- Character sheet: `.char-sheet`; header buttons aria-labelled `Edit "<Name>"` / `Delete "<Name>"` (quoted — build selectors inside page-evaluate, escaped-quote CSS selectors die); `.ct-container` kit root in sheet too.
- Log: `#log-note-type` GM-only; visitor composer placeholder `Add a note to the log...` + button `Post note`; testid `campaign-log-view`.
- Admin: in-app `DeleteConfirmModal` on `.modal-shell-overlay`/`[role=dialog]`; Delete Campaign typed-gate (`Delete "<name>"` armed after exact type); Regenerate confirm copy `Yes, Regenerate`; success strip `.admin-status--success`.
- Server truth: `GET /api/campaigns` = `{folders, types}`; change-data aggregate `GET /api/campaigns/<c>/change-data`; overlays `GET /spell-overlay?campaign=` (NO `/api` prefix — `/api/spell-overlay` honestly 404s).

## Known Quirks / Gotchas (this run's additions; durable set in playbook)

- `page.waitForFunction(() => document…)` inside `browser_run_code_unsafe` threw `ReferenceError: document is not defined` in this harness build — `locator.waitFor()` / polling `page.evaluate` are the safe lanes (playbook §12).
- `setDefaultTimeout` is PER-PAGE — a second tab opened from run_code needs its own call or waiters burn the 30 s default.
- Visitor-origin write reality: PC target select PATCHes shared `combatSummary` (200 `applied:1`); character-file `PUT <Name>.json` from visitor Host answers `Character updated successfully` (update-only — PUT on a fresh name honestly 404s, creation stays gated).
- Byte-safe visitor PUT probe recipe: PUT the file's exact bytes back (`--data-binary @backup`), md5 before/after identical, zero fixture drift.
- Map DELETE runs a disk-wide strand sweep (`pruneStrandedTokenArt`, FIXED 2026-11-23): reclaims the deleted doc's `images/token-*` art plus pre-existing strays, keeps anything a live sibling doc (map/char/data JSON) still names; Admin Regenerate inherits; rename remains art-untouched.

## Improvement backlog

<!-- Open items only. e2e-explore appends dated bullets here; e2e-improve consumes and REMOVES them. -->

- **2026-11-23 run WW — GM Initiative/Encounters toolbars overflow narrow viewports:** at a 420×760 viewport (GM tab) the Initiative ct-toolbar renders `+ Monster`, `Split Party`, `← Prev`, `Next →` beyond the container and window (`Next →` right-edge 573px vs innerWidth 420; `.ct-container` right 330px, `overflowX: visible`; Encounters same face for `Generate`/`Add player`). The document scrolls horizontally (~242px) so controls are technically reachable, but on the phone/tablet-class devices that LAN players actually use, core board controls start off-screen and Quests/NPCs wrap honestly by contrast. Likely fix: flex-wrap the `.ct-container` toolbar rows (shared law in `src/App.css` kit section + `src/components/initiative/Initiative.css`, `src/components/encounter/EncounterBuilder.css`), or move Prev/Next into a wrapped action row below the search tier at `@media (max-width: ~640px)`. Nested-modal widths not yet measured — pair with the PT#3 screenshot pass.
- **2026-11-23 run WW — visitor Map empty-state offers only a manual `Check Again`:** the no-active-map visitor face (`Waiting for the GM to open a map…`) depends on the visitor pressing the button; map activation broadcasts `maps-list`/`map-data` SSE events to every tab, so the empty state should be able to adopt the newly-opened map live without the manual re-check. NOT confirmed broken (activation fan-out into that specific empty state was not ridden this run) — verify then wire if it really requires the press. `src/components/map/` host + `MapContextSync`/`useActiveMapType` lane.
