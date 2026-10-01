# Bug — MA-1747 Young Black Dragon "Unnamed lair actions 1": bare-string pools-of-water lair row renders text-only, zero affordance (MA-0378 bare-string family)

- ID: MA-1747 · Young Black Dragon · category other · actionType lair_actions
- Disk key: `young-black-dragon.lair_actions[0]` = **BARE STRING** (no name, no structured dict)
- Verified: 2026-09-30 · campaign test-campaign (locked) · dev :5173/:80
- Verdict: **FAIL(b)/DATA** — data-shape fix required; engine lane exists and is proven (MA-0378 beholder).

## Expected (per §67)
A lair row with an authored mechanic (here: DC 15 Strength save, pull up to 20 ft + knocked prone) should render as a structured dict WITH `name` → clickable `span.mc-dice-link-lair[role=button]` chip (save affordance at DC 15 Strength, or MA-0043 zone dict). Raw-string/nameless rows are inert by design (§67) — this disk row is raw, so it is inert.

## Actual
- Disk byte-shape: `lair_actions[0]` is a plain string:
  "Pools of water that the dragon can see within 120 feet of it surge outward in a grasping tide. Any creature on the ground within 20 feet of such a pool must succeed on a DC 15 Strength saving throw or be pulled up to 20 feet into the water and knocked prone."
- Live `.mc-overlay` (INNER `img.avatar-image` alt "Young Black Dragon 1", board IN initiative round 1): row renders `<div class="mc-action"><span>Pools of water…</span></div>` — text-only. Whole-card `.mc-dice-link-lair` count **0**.
- Row probe: zero button/[role=button]/.mc-dice-link descendants, cursor:auto, tabIndex:-1.
- Click attempt on rendered span: zero popup, zero modal, **zero log delta** (GET /api/campaigns/test-campaign/log 65 → 65; zero POSTs to /log|save|lair). Zero console errors.
- Manifest `conditions:["prone"]` is a label only (§118 MA-0548) — no engine key on disk.

## Grep citations
- `src/components/encounter/MonsterCardBody.jsx:357` — `typeof la === 'string' || !isLairRowClickable(la)` → static text render, no chip.
- `src/services/encounters/monsterLairActions.js:25` — `!row || typeof row !== 'object' || !row.name` → `isLairRowClickable` false for strings and nameless dicts (nameless inert proof).
- `src/services/encounters/monsterLairActions.js:38-48` — `lairRowAffordance` returns null for this row.
- `src/services/encounters/monsterLairActions.js:2,23` — no initiative-20 lair seam app-wide (§70 advisory); named rows still GM-manual.
- Pull/knock-prone consumer grep-ZERO: no `'pull'` or `knocked_prone` te in `src/services/combat/conditions/targetEffectDefinitions.js`; no `pull` in `monsterLairActions.js`. Push marker te `push` (targetEffectDefinitions.js:1324) is wired only to breath-save lanes (MA-0079 `SaveAttackAoeModal.jsx:279,505`; MA-0138 `:724-728` §68), never lair rows. MA-1739 prone-save rider lane: grep-zero in src — moot, no save chip exists.

## Fix template (MA-0378 precedent — BEHOLDER lair_actions[0], VERIFIED)
Option A — MA-0043 zone dict shape (byte-exemplar on disk, `beholder.lair_actions[0]`):
`{"name": "Slimy Ground", "description": "...", "zone": {"radius_ft": 25, "no_save": true, "noun": "...", "effect_key": "lair_slimy_ground", "advisory": "..."}, "duration": "..."}` + `lair_*` te registration in targetEffectDefinitions.js.
For MA-1747 the row HAS an authored save, so Option B is the minimal fix:
Option B — named structured save row: `{"name": "Surging Pools", "description": "<same prose>", "save_dc": 15, "save_type": "Strength"}` → arms `lairRowAffordance` 'save' chip at DC 15 Strength (MonsterCardBody.jsx:372-389).
Residuals to note in fix advisory: pull-up-to-20-ft movement and knocked-prone application on NPC saves are GM-enforced (no pull consumer; prone save-rider lane per MA-1739 family if applicable); zone placement GM-enforced.

## Scope note
This is `lair_actions[0]` of a trio; sibling rows MA-1748 (nameless dict, same prose, save_dc:15 STR) and MA-1749 (insect swarm CON dict) are verified separately. DO NOT edit `docs/monster-actions-manifest.json`.

## Evidence
- .opencode/plans/checkpoint-mon-MA-1747.md (full probe record)
- .opencode/plans/ma1747-lair-row-zero-affordance.png (overlay open, text-only row, zero chips)
