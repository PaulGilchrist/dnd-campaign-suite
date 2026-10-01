# Bug — MA-1748 Young Black Dragon "Unnamed lair actions 2": nameless structured save-dict lair row renders text-only, zero affordance (nameless-dict inert family — ONE-FIELD `name` fix, cheaper than MA-1747)

- ID: MA-1748 · Young Black Dragon · category other · actionType lair_actions
- Disk key: `young-black-dragon.lair_actions[1]` = **NAMELESS STRUCTURED DICT** — HAS `save_dc: 15` + `save_type: "Strength"`, NO `name`
- Verified: 2026-09-30 · campaign test-campaign (locked) · dev :5173/:80
- Verdict: **FAIL(b)/DATA** — one-field fix (add `name`); save lane already armed by existing numeric fields.

## Distinction from sibling MA-1747 (same card, same prose)
- MA-1747 (`lair_actions[0]`) is a **BARE STRING** — fix needs full dict authoring (name + save_dc + save_type) or MA-0043 zone dict.
- MA-1748 (`lair_actions[1]`, THIS bug) is a **structured dict that ALREADY carries the numeric save fields** (`save_dc: 15, save_type: "Strength"`). The ONLY missing key is `name`. Adding `name` alone flips the gate at monsterLairActions.js:26 → `lairRowAffordance` :42 returns `'save'` (save_dc != null) → `MonsterCardBody.jsx:372-389` renders `span.mc-dice-link-lair[role=button]` "DC 15 Strength" chip with the full save seam (handleSaveRoll, authored DC/type enforced). Cheapest fix in the lair family.
- §115 header-swallow nuance (save_dc rescues nameless rows) was LEGENDARY-only — does NOT apply here; lair lane hard-gates on `row.name`. Verified live: no rescue occurred.

## Disk quote (public/data/monsters.json → young-black-dragon.lair_actions[1])
```json
{
  "description": "Pools of water that the dragon can see within 120 feet of it surge outward in a grasping tide. Any creature on the ground within 20 feet of such a pool must succeed on a DC 15 Strength saving throw or be pulled up to 20 feet into the water and knocked prone.",
  "save_dc": 15,
  "save_type": "Strength"
}
```
Manifest adds extracted `conditions:["prone"]` — label only (§118 MA-0548), no engine key on disk.

## Live evidence (test-campaign, board IN initiative round 1, YBD 1 + Bandit 1 (720) + Bandit 2 (922))
- INNER `img.avatar-image` → `.mc-overlay` card "Young Black Dragon 1".
- Lair Actions `.mc-section` = 3 rows. Row idx 1 (MA-1748) = `<div class="mc-action"><span>Pools of water…</span></div>` — static branch.
- Affordance inventory row idx 1: `.mc-dice-link-lair`=0, `.mc-dice-link`=0, `button`=0, `[role=button]`=0, no `<strong>` name header, no fa-hurricane icon; whole-card `.mc-dice-link-lair` count **0**.
- Row idx 0 (MA-1747 sibling, same prose) identical inert shape — independent fingerprint.
- Pointer proof: span tabIndex=-1, cursor:auto; row/span onclick absent.
- Click probe on row idx 1: zero popup, zero modal, zero save prompt.
- Log GET before/after: 65 → 65 — **zero delta**, zero POSTs. Zero console errors.
- No chip rendered → step-3 exercise (raw d20 vs DC 15 vs Bandit, MA-1739 text-parse prone rider) NOT applicable — moot without a save leg.

## Grep citations
- `src/components/encounter/MonsterCardBody.jsx:358` — `typeof la === 'string' || !isLairRowClickable(la)` → static text span; `:365` name header conditional (null here).
- `src/services/encounters/monsterLairActions.js:26` — `!row.name` → false despite `save_dc != null` at :27 (name gate short-circuits FIRST — the exact kill for this row).
- `src/services/encounters/monsterLairActions.js:38-42` — `lairRowAffordance` :39 null (clickable false); had name, :42 `save_dc != null` → `'save'`.
- `src/services/encounters/monsterLairActions.test.js:1922` — existing unit guard: `isLairRowClickable(young.lair_actions[1])` toBe(false) — engine regression-protects the inertness until data changes.
- Pull/knock-prone residual unchanged from MA-1747: no `pull` consumer; prone rider lane per MA-1739 family applies to save prompts once chip lives.

## Fix template (Option B minimal — one field)
`{"name": "Surging Pools", "description": "<same prose>", "save_dc": 15, "save_type": "Strength"}` → 'save' chip "DC 15 Strength" renders (MonsterCardBody.jsx:372-389) → handleSaveRoll seam at authored DC/type; fail = pull/prone GM-enforced (no pull consumer), success = zero. MA-0378/named-row template governs naming. DO NOT edit `docs/monster-actions-manifest.json`.

## Evidence
- .opencode/plans/checkpoint-mon-MA-1748.md (probe record)
- .opencode/plans/ma1748-lair-row-nameless-dict-inert.png (overlay, text-only row idx 1, zero chips)
- Sibling bug: .opencode/plans/bug-mon-MA-1747-young-black-dragon-lair-pools-bare-string-inert.md
