# BUG MA-1060 / MA-1061 — Kraken "Unnamed lair actions 2/3" — prose-only, no affordance + chain mis-copy

**Verdict:** MA-1060 FAIL(b)-DATA/UI · MA-1061 FAIL(b)-DATA/UI — text renders, zero mechanic affordance. MA-1059 precedent lane (twin MA-1016).

## Data shape (disk, `public/data/monsters.json`, Kraken `lair_actions[1]` / `[2]`)

**[1] MA-1060** — nameless dict, NO `name`, NO `save_dc`:
- `description`: "Creatures in the water within 60 feet of the kraken have vulnerability to lightning damage until initiative count 20 on the next round."
- `save_type`: `"Strength"` — **stray**: the described effect is a no-save vulnerability aura; there is no saving throw anywhere in this text.
- `save_effect`: "Failure: Each creature within 60 feet of the kraken is pushed up to 60 feet away… Success: pushed 10 feet…" — **mis-copy of lair_actions[0] (strong-current push) text** (MA-1059's row).

**[2] MA-1061** — nameless dict, NO `name`, NO `save_dc`, NO `save_type`:
- `description`: "The water in the kraken's lair becomes electrically charged. All creatures within 120 feet of the kraken must succeed on a DC 23 Constitution saving throw, taking 10 (3d6) lightning damage on a failed save, or half as much damage on a successful one." (CONFIRMED verbatim)
- `save_effect`: "Creatures in the water within 60 feet… vulnerability to lightning… next round." — **mis-copy of [1]'s vulnerability text**.

**Chain mis-copy:** `[1].save_effect ← [0].mechanic`, `[2].save_effect ← [1].description` — each row's payload field carries the PREVIOUS row's content. Content offset-by-one; only `[0]` (raw string) is internally consistent.

## Live evidence (test-campaign, :5173 REUSE, header verified "test-campaign")

- Session start: leftover `.spell-popup-parent` node turned out to be the AasimarTest sheet's Spells block (false positive, z-index auto, no modal styling); real modals at start: 0.
- Stale Kraken card found open from prior session → closed via ×, then reopened FRESH via portrait click (Kraken 1, initiative 29, HP 481/481).
- Lair Actions section, rows verbatim from DOM:
  - [l1]: `<div class="mc-action"><strong>.</strong> <span>Creatures in the water within 60 feet of the kraken have vulnerability to lightning damage until initiative count 20 on the next round.</span></div>` — buttons 0, `.mc-dice-link` 0, `[role=button]` 0.
  - [l2]: `<div class="mc-action"><strong>.</strong> <span>The water in the kraken's lair becomes electrically charged. All creatures within 120 feet of the kraken must succeed on a DC 23 Constitution saving throw, taking 10 (3d6) lightning damage on a failed save, or half as much damage on a successful one.</span></div>` — buttons 0, `.mc-dice-link` 0, `[role=button]` 0.
- Cosmetic artifact: empty `<strong>.</strong>` renders as a stray "." bullet — `la.name` is empty in the static branch.
- **Zero-press proof:** no affordance existed on either row to press; card open was view-only. Log delta 0 (500→500 entries, sha256[:16] `d53e5078fe08b9d6` unchanged across the visit). No mechanic writes.
- Console errors: 0 (2 warnings only, non-blocking).
- Card closed via ×; visible modals 0. Rig cond-clean: `Bandit 1.activeConditions = []` via `GET /api/campaigns/test-campaign/change-data`.

## Code gate (cites)

- `src/services/encounters/monsterLairActions.js:26` — `isLairRowClickable`: `if (!row || typeof row !== 'object' || !row.name) return false;` → BOTH dicts die on `!row.name` despite [2] carrying a fully-specified save mechanic in prose.
- `src/services/encounters/monsterLairActions.js:39` — `lairRowAffordance` returns null for non-clickable rows.
- `src/components/encounter/MonsterCardBody.jsx:339-352` — `MonsterLairAction` static branch (`typeof la === 'string' || !isLairRowClickable(la)`) → plain span prose; interactive branch (save chip at authored DC, damage chip, `handleLairRow`) unreachable.

## save_effect-vs-description mismatch ruling ([l1], one line)

[l1] `save_effect` prescribes a Strength push ("Failure: pushed up to 60 feet…") while its `description` is a save-less lightning-vulnerability aura — the two fields describe **different lair actions** ([0]'s mechanic pasted into [1]'s payload), so no consumer could ever adjudicate them coherently even if the row were clickable.

## Fix lane (authoring; manifest NOT edited per task rules)

- **[l2] MA-1061** (mechanic complete in prose): `{"name": "Charged Water", "description": "<verbatim>", "save_type": "Constitution", "save_dc": 23, "damage_dice_primary": "3d6", "damage_type": "lightning", "save_effect": "Failure: 10 (3d6) lightning damage. Success: half damage."}` → routes through `save` affordance (existing save seam, half-on-success math untouched, MV-20/MV-27).
- **[l1] MA-1060** (no save in rules text — do NOT fabricate one): `{"name": "Lightning Vulnerability", "description": "<verbatim>", "advisory": true}` → advisory lane (GM-enforced aura + initiative-20 cadence note, CLA-325 precedent). Strip stray `save_type: "Strength"` and the mis-copied push `save_effect`.
- **Mis-copy repair:** re-align every row's `save_effect` to its own mechanic or drop it (advisory rows carry none).

## Read-back

File written; on-disk gate re-read confirms line 26 name-guard verbatim; verdicts stable: **MA-1060 FAIL(b), MA-1061 FAIL(b)**.

## Rig state

Kraken card closed (×); overlays clean (0 modals); log 500 entries, hash `d53e5078fe08b9d6`; Bandit 1 cond-clean; no manifest edits; no git writes.
