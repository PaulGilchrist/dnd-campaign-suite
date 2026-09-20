# BUG MA-0577 — Death Tyrant Multiattack / Eye Rays: Varies-shell mod-0, no ray picker, zero effects (MA-0374 twin)

## Overview
Death Tyrant (index `death-tyrant`) Multiattack row is the accepted header-text standard (inert, zero chips). Its component row **Eye Rays** was never converted to the §88 structured `rays[]` shape that Beholder (rays: 10) and Beholder Zombie (rays: 4) received. Live, its chip fires a generic mod-0 "VAR" save shell: no ray identity, no d10 picker, no per-ray DC/save-type, no damage, no conditions, no same-ray-per-round latch. Identical fingerprint to MA-0374 (Beholder) / MA-0383 (Beholder Zombie) BROKEN twins — the fix recipe already exists in the codebase; the Death Tyrant data row was simply missed in that pass.

## Expected (manifest description + disk numbers)
- Description (Multiattack): "The death tyrant uses Eye Rays three times." → three Eye Ray uses per turn, each a random ray of the tyrant's 10 rays (Eye Rays description: "roll 1d10; reroll if the death tyrant has already used that ray during this turn").
- Disk `public/data/monsters.json` death-tyrant Eye Rays row: `save_dc: 17` (numeric ✓). Rays per RAW + prose: 10 rays (Charm WIS, Paralyzing CON, Fear WIS, Slowing CON, Enervation CON, Telekinetic STR, Sleep WIS, Petrification CON ladder, Disintegration DEX 8d8, Death DEX 10d10), all DC 17, most half-damage on success.
- Expected affordance: §88 eye-ray picker — d10 roll, named ray popup, chosen ray's own single-ability save vs DC 17, half/full damage per ray, conditions granted on fail, `eyeRaysUsed` round latch reroll-if-used.

## Actual (live, test-campaign 2026-09-19)
- Multiattack row: text-only, ZERO chips — accepted MA-0009 standard (not itself the failure).
- Eye Rays chip text: `DC 17 Varies (Wisdom, Constitution, Strength, Dexterity)` — generic save-shell chip, NOT the §88 picker.
- Chip click opens popup: **"VAR 7 d20 7 … DC Unknown — no success or failure"** (no ray name, no picker die, no list).
- Machine truth (`/api/campaigns/test-campaign/log`, 13 entries): 3 fired saves —
  - attacker dupe: `roll save name:"VAR" bonus:0 dc:null` (totals 7, 20, 8)
  - victim: `Bandit 1 roll save name:"Eye Rays" saveDc:17 saveType:"Varies (Wisdom, Constitution, Strength, Dexterity)" bonus:0` — saveResults: failure(7), success(20), failure(8)
  - **ZERO `save-damage`, ZERO `hp_change`, ZERO `condition applied`, ZERO `ability_use` entries** — even the nat-20 success and both failures resolve to nothing.
- Same-ray latch absent-by-construction: `change-data['Death Tyrant 1'].eyeRaysUsed` = null after 3 fires (picker code never runs; key never stamped). 3 unlimited un-identified fires possible, ray identity never recorded → GM cannot even adjudicate the "three times" count or reroll-if-used rule.

## Data defects (public/data/monsters.json, death-tyrant, actions[2] "Eye Rays")
1. `rays[]` ABSENT (Beholder:10, Beholder Zombie:4 carry it). Gate `MonsterCardModal.jsx:1664` (`Array.isArray(stageAction.rays) && length>0`) never routes to `resolveEyeRayFire`; falls through to generic `executeBlockSaveRoll`.
2. `save_type: "Varies (Wisdom, Constitution, Strength, Dexterity)"` — unparseable multi-string → mod-0 "VAR" shell (§L50 fingerprint; fixed twins dropped this field).
3. `damage_dice_primary: "3d8, 3d6, 4d8, 3d10, 8d8, 10d10"` + `damage_type_primary: "Psychic, Psychic, Necrotic, Poison, Force, Necrotic"` — misleading multi-strings, must be dropped (twins have neither).

## Steps to Reproduce
1. :5173 → test-campaign → Encounters → search "Death Tyrant" → check exact row → Join Encounter (lands cs idx 0).
2. Join 2 Bandits (qty 2); stage victims 999 HP via full-store POST `/api/campaigns/test-campaign/combatSummary` `{value:{…}}`.
3. Arm Bandit 1 on Death Tyrant's initiative-card `[data-testid="target-select"]` (first select; self-excludes own name).
4. Open Death Tyrant card (avatar click → `.mc-overlay`). Multiattack = text, no chips.
5. Click Eye Rays chip (absorbed-first-click: dismiss backdrop/reopen, click again at fresh rect).
6. Observe "VAR … DC Unknown" popup; GET `/log`: victim save carries literal saveType "Varies (…)", no damage/condition entries ever; GET `/change-data`: `eyeRaysUsed` null.

## Likely Location
- **PRIMARY: `public/data/monsters.json`** — death-tyrant Eye Rays row needs §88 conversion: author `rays[]` (10 entries, byte-shape of Beholder's), delete `save_type`, `damage_dice_primary`, `damage_type_primary`. (Data fix, not code.)
- `src/components/encounter/MonsterCardHelpers.js` `parseEyeRays` (~:1847) — correct gate, inert without rays[] (no change needed).
- `src/components/encounter/MonsterCardModal.jsx:1664` — routing correct, never reached for this monster.
- `src/hooks/combat/saveProcessing.js` — generic shell ran; VAR type unresolvable so no grants; no change needed.

## Notes
- Registry: "Death Tyrant" absent from docs/test-monster-registry.json; Beholder MA-0374 / Beholder Zombie MA-0383 twin precedent; §88 eye-ray picker recipe applies verbatim.
- Playbook anchors: §L50 (Varies multi-string = FAIL family), §L88 (picker rides rays[] only), §L66 (multiattack count GM-adjudicated — count NOT the defect; ray identity/damage/conditions/latch ARE).
- Verdict basis: picker inert (generic shell), no named rays, half-damage not applied, conditions not applied, same-ray latch absent. Multiattack header inert-as-standard PASSes only as header.
