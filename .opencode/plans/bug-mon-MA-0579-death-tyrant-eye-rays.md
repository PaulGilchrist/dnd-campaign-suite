# BUG MA-0579 — Death Tyrant "Eye Rays" (actions[2]): rays[] absent → inert mod-0 VAR save-shell, no picker, zero damage/conditions/latch (MA-0374/0577 twin class)

## Overview
Manifest row MA-0579 is the Death Tyrant **Eye Rays** row itself. Disk `public/data/monsters.json` (`index: death-tyrant`, `actions[2]`) carries `save_dc: 17` numeric but **no `rays[]`**, plus unparseable multi-string `save_type` / `damage_dice_primary` / `damage_type_primary`. The MA-0374/MA-0383 eye-ray-picker conversion reached Beholder (rays: 10) and Beholder Zombie (rays: 4) but missed this row. Live, its chip fires a generic mod-0 "VAR" save shell: no d10 picker, no named ray, per-ray DC/ability never enforced, half-damage never computed, zero conditions granted, and the reroll-if-used `eyeRaysUsed` latch is never stamped — every ray resolution in the row's own prose is inert. Fresh session evidence below (campaign cleaned after).

## Expected (row description, quoted)
> "The death tyrant randomly shoots one of the following magical rays at a target it can see within 120 feet of itself (roll 1d10; reroll if the death tyrant has already used that ray during this turn):"

10 named rays, each with its own **"Saving Throw: DC 17"**: Charm WIS 3d8 Psychic + Charmed 1 hr (half on save); Paralyzing CON, Paralyzed + repeat-save ladder; Fear WIS 3d6 Psychic + Frightened (half on save); Slowing CON 4d8 Necrotic + halved Speed/no Reactions/action-XOR-bonus-action (half on save); Enervation CON 3d10 Poison + Poisoned, can't regain HP (half on save); Telekinetic STR, moved up to 30 ft + Restrained; Sleep WIS, Unconscious 1 min; Petrification CON, Restrained→Petrified ladder; Disintegration DEX 8d8 Force (half on save, zero-HP disintegrate); Death DEX 10d10 Necrotic (half on save, zero-HP death). "Success on damage rays: Half damage."
Expected affordance: the §88 generic eye-ray picker — authored `rays[]` rows + len(rays)-inferred d10, reroll-if-used-per-round latch (`eyeRaysUsed`), row DC 17 stamped onto the chosen ray, per-ray single-ability save + half/full damage + condition grants through `executeBlockSaveRoll`→`saveProcessing` (byte-shape templates: MA-0374 Beholder rays:10, MA-0383 Beholder Zombie rays:4).

## Static disk evidence (this session)
- `actions[2]` keys: `damage_dice_primary, damage_type_primary, description, name, save_dc, save_effect, save_type` — **`rays` ABSENT**. `save_dc: 17` numeric present.
- `save_type: "Varies (Wisdom, Constitution, Strength, Dexterity)"` and `damage_dice_primary: "3d8, 3d6, 4d8, 3d10, 8d8, 10d10"`, `damage_type_primary: "Psychic, Psychic, Necrotic, Poison, Force, Necrotic"` — misleading multi-strings (twins dropped all three fields).
- Field-vs-prose ray numbers: the six dice pools agree with the six damage rays in order (Charm 3d8, Fear 3d6, Slowing 4d8, Enervation 3d10, Disintegration 8d8, Death 10d10) — but the flat list carries **no ray identity**, cannot map dice→ray→save-ability, and silently omits the four non-damage rays. **"Roll 1d10, reroll-if-used" is not expressible without `rays[]`**: no per-ray key, no latch field, no picker die source.
- Minor prose drift: row `save_effect` Slowing-Ray text drops the "either an action or a Bonus Action, not both" clause the description carries; manifest conditions list includes `incapacitated`, which the prose only references as the Telekinetic-ray *termination* clause (no ray grants it).

## Grep evidence — no consumer can resolve the multi-strings (this session)
- `MonsterCardHelpers.js:1863` `parseEyeRays`: `if (!Array.isArray(rays) || rays.length < 2) return null;` — byte-inert null for this row.
- `MonsterCardModal.jsx:1666` gate `Array.isArray(stageAction.rays) && stageAction.rays.length > 0` never true → falls through at `:1672` to generic `executeBlockSaveRoll` (VAR shell). `resolveEyeRayFire` (:331) never runs.
- `MonsterCardHelpers.js:454-456` `toAbbr("Varies (…)")` → `substring(0,3).toLowerCase()` = `"var"` → `getSaveModifierForSaveType` (:470) finds no `var` save key → mod 0, chip/save name "VAR".
- Node-verified: `canRollExpression("3d8, 3d6, 4d8, 3d10, 8d8, 10d10")` → **false** (diceRoller.js:68 splits only on "or"/"plus"); `canRollExpression("3d8")` → true.
- `rg "Varies|split\(','\)"` over `src/services/combat` + `src/hooks/combat` (non-test): **zero matches** — no save/damage/hp consumer parses `Varies (...)` or comma-multi dice. `saveProcessing.js` passes `saveType` through opaquely (:22,:31,:39).
- Twins authored: beholder `rays: 10`, beholder-zombie `rays: 4` with `{key, name, save_ability, damage_dice, damage_type, dc_success, conditions, …}` and no `save_type`/`damage_dice_primary`/`damage_type_primary`.

## Actual (live, test-campaign, :5173, fresh this session)
- Joined `Death Tyrant 1` (cs 195/195) + `Bandit 1`, staged Bandit 1 to **999/999** via full-store POST `/combatSummary {value:{…}}`. Armed Bandit 1 on Death Tyrant's own initiative-card target-select (`armed: "Bandit 1"` verified).
- Multiattack row: text, zero chips (accepted header standard). Eye Rays row chip text: `DC 17 Varies (Wisdom, Constitution, Strength, Dexterity)` — generic save-shell, NOT the §88 picker.
- Two fired probes (fresh-rect clicks, both landed first try this session): popup both times —
  `"VAR | 3 (then 11) | d20 3/11 | Advantage | Disadvantage | DC Unknown — no success or failure | click to dismiss"` — no ray name, no picker die, no list.
- Log deltas (`/api/campaigns/test-campaign/log`, 8 entries total): attacker dupe `roll save name:"VAR" who:"Death Tyrant 1" total:3 / total:11`; victim `Bandit 1 roll save name:"Eye Rays" saveDc:17 saveType:"Varies (Wisdom, Constitution, Strength, Dexterity)" bonus:0 saveResult:"failure"` ×2. **Both saves FAILED and still: ZERO `save-damage`, ZERO `hp_change`, ZERO `condition applied`, ZERO `ability_use` entries** (filtered query returned `[]`). Bandit 1 cs `currentHp` re-checked after both fires: **999/999 — HP delta 0**.
- Machine truth `lastAttack`: `{saveDc:17, saveType:"Varies (Wisdom, Constitution, Strength, Dexterity)", saveResult:"failure"}` — failed save grants nothing.
- Reroll-if-used latch: `change-data['Death Tyrant 1']` keys = `["lastSaveRoll","_lastRollContext"]` — **`eyeRaysUsed` key ABSENT** after 2 fires (picker code never runs); unlimited un-identified re-fires confirmed, ray identity never recorded.

## Verdict
**FAIL (b) / DATA.** The row's 10-ray picker, per-ray DC 17 enforcement, half-on-save damage, condition grants (charmed/frightened/paralyzed/petrified/poisoned/restrained/unconscious), zero-HP disintegrate/death clauses, and reroll-if-used latch are ALL inert — generic unparseable VAR shell, zero effect delta. Same fingerprint as MA-0577 (multiattack framing of this same monster, already filed); this row itself is the defect carrier. §50: "Varies save_type / multi-dice → unparseable save-shell, mod-0 VAR — all such rows FAIL."

## Steps to Reproduce
1. :5173 → select **test-campaign** (verify sidebar header).
2. Encounters → search `Death Tyrant` → check exact row (verify `input.checked`) → Join Encounter → poll cs: `Death Tyrant 1` present.
3. Search `Bandit` → check exact CR 0.125 row (not Bandit Captain) → Join → `Bandit 1` in cs; stage 999 HP: GET `/api/campaigns/test-campaign/combatSummary`, mutate `Bandit 1.currentHp/maxHp=999`, POST same URL `{value:{…full cs…}}`.
4. Arm Bandit 1 on Death Tyrant's OWN initiative card `[data-testid="target-select"]` (`.creature-card:has(img[alt="Death Tyrant 1"])` scope; self-excludes own name).
5. Open Death Tyrant card (avatar alt `Death Tyrant 1`); scope Eye Rays row via `strong.textContent.startsWith('Eye Rays')` (Multiattack row text contains "Eye Rays").
6. Click chip `span.mc-dice-link` (text `DC 17 Varies (…)`); dismiss popup; refire. Observe `VAR … DC Unknown` both times.
7. GET `/log`: victim saves `saveDc:17 saveResult:"failure"` with no `save-damage`/`hp_change`/`condition applied`; GET `/change-data`: `eyeRaysUsed` key absent; cs Bandit HP unchanged at 999.

## Likely Location
- **PRIMARY: `public/data/monsters.json`** — death-tyrant Eye Rays row missing the §88 `rays[]` conversion (family twin drift: Beholder rays:10, Beholder Zombie rays:4). Fix = author `rays[]` in the twins' byte-shape (10 rays, per-ray `save_ability`, single `damage_dice`, `dc_success`, `conditions`, Petrification ladder, zero-HP clauses, Gargantuan/Construct-Undead auto-success where prose says so) and DROP `save_type`, `damage_dice_primary`, `damage_type_primary`. One-field-family fix; code layer needs no change.
- `src/components/encounter/MonsterCardHelpers.js:1863` `parseEyeRays` — correct, inert without rays[] (no change).
- `src/components/encounter/MonsterCardModal.jsx:1666` — routing correct, never reached (no change).
- `src/hooks/combat/saveProcessing.js` — generic shell ran; `var` ability unresolvable so no grants (no change).

## Notes
- `save_dc: 17` numeric IS present (row DC rides the shell; victim saves correctly print DC 17) — identity/payload, not DC, is the gap.
- MA-0577 twin row (same monster, Multiattack framing) already filed — do NOT re-file the behavior; this file carries the MA-0579 row verdict.
- §88 fix template rides byte-for-byte: author rays[] per MA-0374/0383 shape, drop multi-string fields; ladder service (`beholderEyeRayService`) honors row DC stamp (Death Tyrant 17).
- This session's clicks landed first-try (no absorbed-first-click observed on this chip).
- Playbook anchors: §50 (Varies/multi-dice = FAIL family), §88 (picker requires authored rays[]), §153/§154 (Eye Rays scoping + family fingerprint), §128 (joined names suffixed "Death Tyrant 1").
- Session hygiene: test-campaign only; npc-remove + admin clear change-data/log at end; no src/, public-data, manifest, or git edits.
