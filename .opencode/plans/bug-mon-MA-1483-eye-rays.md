# BUG MA-1483 — Spectator "Eye Rays" launcher row is inert (DATA)

**Verdict: FAIL(b)/DATA** — inert launcher, grep-zero path, zero live delta.

## Row (verbatim, manifest)
`{"id":"MA-1483","stableKey":"spectator|actions|2","monsterIndex":"spectator","monster":"Spectator","actionIndex":2,"actionType":"other","description":"The spectator randomly shoots one of the following magical rays at a target it can see within 90 feet of itself (roll 1d4; reroll if the spectator has already used that ray during this turn)","verified":"not verified"}`

## Expected
The row is a random-1d4 eye-ray picker launcher: clicking it opens the §88 generic eye-ray picker (`.mc-eye-ray-chooser`), rolls 1d4 (die inferred from `len(rays[])`=4), rerolls if the spectator already used that ray this turn (eyeRaysUsed round latch), stamps the row DC onto the chosen ray's save leg, and fires that ray against the armed target.

## Actual
Row on disk (`public/data/monsters.json` spectator.actions[2]) has keys `['description','name']` ONLY — **rays[] ABSENT** (no save_dc, range, automation, save_effect). It renders as plain prose `<div class="mc-action"><strong>Eye Rays.</strong><span>…1d4…</span></div>` with **zero affordances** (0 chips / buttons / role=button, cursor:auto). Two presses (twice, armed-table live combat, Bandit 1 818/AC12 in range): log 114→114, zero `.popup-overlay`, zero `.dsp-overlay`/`.sp-modal`, zero `.mc-eye-ray-chooser`, no 1d4 roll, no `ability_use`, console 0 errors.

## Grep evidence (launcher unreachable without rays[])
- `parseEyeRays` MonsterCardHelpers.js:2773 — `if (!Array.isArray(rays) || rays.length < 2) return null;` → null for this row.
- Fire gate MonsterCardModal.jsx:2082 — `if (Array.isArray(stageAction.rays) && stageAction.rays.length > 0) { resolveEyeRayFire(...) }` → false; row falls through to executeBlockSaveRoll with no save context → inert.
- `resolveEyeRayFire` :474 re-guard `if (!rays) return;`.
- eyeRaysUsed latch (`EYE_RAYS_USED_KEY` :451, `eyeRaysUsedKeys` :459, `pickEyeRay` reroll-if-used Helpers.js:2790, `usedKeys` :488) armed ONLY inside resolveEyeRayFire → never armed here. §88 picker + latch structurally unreachable. §157 VAR-shell fingerprint.

## Scope note
The 4 individual rays (Confusion/Paralyzing/Fear/Wounding) exist as SEPARATE authored rows with live chips (verified: 2d4/DC12 Wis, DC12 Con, 2d4/DC12 Wis, 3d10/DC12 Con; fired exact at MA-1481). That does not revive THIS launcher row: the RAW random-1d4 selection + reroll-if-used gate have no consumer on this row — GM must hand-pick ray chips.

## Fix (DATA only, no code)
Author `rays[]` on spectator.actions[2] per gazer MA-0765 byte-shape (dumped; beholder-zombie MA-0383 twin len=4→d4):
- row add: `save_dc: 12`, `range: "90 ft."`, `rays: [4 dicts]`, `save_effect` as needed; keep `name`/`description` byte-unchanged.
- ray dict shape: `key, name, save_ability, damage_dice, damage_type, dc_success, conditions, te_grants, clock_rounds, duration_note, save_effect` —
  - one dict per sibling ray row, damage/save data harvested byte-from spectator's own actions[3..6] rows (each carries save_dc:12 + save_type + save_effect; live chips: Confusion `2d4`/`DC 12 Wisdom`, Paralyzing `DC 12 Constitution` no-damage, Fear `2d4`/`DC 12 Wisdom`, Wounding `3d10`/`DC 12 Constitution` — MA-1481 proved Wounding=3d10 Necrotic, Fear=2d4 Psychic): keys confusion/fear/paralyzing/wounding, conditions + te_grants + clock_rounds + dc_success per each row's save_effect prose.
- len(rays)=4 arms d4 picker (§88); reroll-if-used latch activates via existing MA-0374/0383 machinery. Zero code change required.

## Evidence files
- `.opencode/plans/checkpoint-mon-MA-1483.md`
- screenshot `ma1483-eye-rays-row-zero-affordance.png` (card open, Eye Rays row prose-only, ray chips below)
- console errors 0; log 114→114 across 2 presses.
