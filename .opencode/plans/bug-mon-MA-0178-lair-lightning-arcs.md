# Bug MA-0178 — Ancient Blue Dragon lair_actions[2] "Unnamed lair actions 3" (Lightning arcs) — inert

**Verdict: FAIL flavor (b)** — row renders with zero affordance; cannot fire its authored DC 15 Dexterity save / 3d6 lightning.

## Expected
Row `ancient-blue-dragon.lair_actions[2]` must be a clickable `.mc-dice-link-lair` chip that fires a DC 15 Dexterity save prompt with 3d6 lightning, half on success:

> "Lightning arcs, forming a 5-foot-wide line between two of the lair's solid surfaces that the dragon can see. They must be within 120 feet of the dragon and 120 feet of each other. Each creature in that line must succeed on a DC 15 Dexterity saving throw or take 10 (3d6) lightning damage."

## Actual
Inert `<div class="mc-action">` with stray-dot name. Registry: EB join "Ancient Blue Dragon 1" hp 481 ac 22 cs0 (clean re-join after MA-0177).

DOM captured (card open, target armed):
```html
<div class="mc-action"><strong>.</strong> <span>Lightning arcs, forming a 5-foot-wide line between two of the lair's sol…
```
- 0 `.mc-dice-link-lair` / a / button / [role=button] children in the row.
- Forced `el.click()` ×2 + one trusted Playwright click → zero popup, zero visible modal, zero log entry, change-data stays `{"value":null}`.
- Log window evidence: join noise only (`encounter` + `roll` @1789448098367/384, pre-click); lair-click window ≈1789448130–145 produced **zero** entries.
- **CONTROL live:** Rend "+16" chip clicked → `roll` entry @1789448157568, `characterName:"Ancient Blue Dragon 1"`, `name:"Rend"`, `bonus:16`, nat 20. Seam is live; only this lair row is dead.

## Data (verbatim, public/data/monsters.json lair_actions[2])
```json
{
  "description": "Lightning arcs, forming a 5-foot-wide line between two of the lair's solid surfaces that the dragon can see. They must be within 120 feet of the dragon and 120 feet of each other. Each creature in that line must succeed on a DC 15 Dexterity saving throw or take 10 (3d6) lightning damage.",
  "save_dc": 15,
  "save_type": "Dexterity"
}
```

## Likely Location
Nameless dict fails the name-gate `isLairRowClickable` (src/services/encounters/monsterLairActions.js:26, `!row.name → false`) → `lairRowAffordance` returns null → MonsterCardBody renders static `.mc-action` with `<strong>.</strong>` placeholder. Same wholly-nameless-dict fingerprint as siblings MA-0176 (ceiling) and MA-0177 (sand cloud) in this block.

## Double gap (MV-14 family)
save_dc/save_type ARE authored (distinguishing it from pure nameless rows), but **no `damage_dice_primary` field** — the 10 (3d6) lightning exists in description text only. Even past the name-gate, a save row without a damage field would roll an undamaged save.

## Fix recipe (data-only, MA-0074 + MA-0064 patterns)
```json
{
  "name": "Lightning Arcs",
  "description": "<unchanged verbatim>",
  "save_dc": 15,
  "save_type": "Dexterity",
  "damage_dice_primary": "3d6",
  "damage_type_primary": "Lightning",
  "dc_success": "half",
  "save_effect": "…"
}
```
- **MA-0064 line-shape advisory:** lair LINE descriptions lead with WIDTH ("5-foot-wide line … within 120 feet"); `breathAoeShape` first-token feet parse previously grabbed 5 — already fixed to MAX feet token for Line shape (gate = 120). Reuse existing handleSaveRoll/SaveAttackAoeModal seam untouched (half-on-success); no code change needed. Byte-mirror the Adult Blue MA-0064 fixed row.
