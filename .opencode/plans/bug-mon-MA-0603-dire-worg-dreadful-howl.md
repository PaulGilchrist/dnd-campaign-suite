# BUG MA-0603 — Dire Worg "Dreadful Howl" (actions[2], save, DC 16 Wisdom, recharge 5-6) — FAIL(a)

## Row (disk, public/data/monsters.json → dire-worg actions[2] verbatim)
- `save_dc` 16, `save_type` "Wisdom", `damage_dice_primary` "8d8" Psychic
- `range` "30 feet" (bare), `recharge` "5-6" flat string → `parseRechargeThreshold` 5 (pinned in monsterRecharge.test.js:44)
- `save_effect` "The target has the Frightened condition until the start of the worg's next turn." — byte-carry canonical "Frightened" ✓ (§53)
- `dc_success` ABSENT → default `half` — CORRECT here (§63): fail = full dmg + Frightened, success = half damage ONLY (§63 MV-20 leak applies only to condition-only-success rows; this row has damage on success).

## Defect (a) — 30-ft "each creature" AoE degrades to single-target (MA-0317 class, MA-0590 precedent)
- `breathAoeShape` (MonsterCardModal.jsx:49) matches only Cone/Line tokens, authored `zone.radius_ft`, and radius-token spheres (:45 `[- ]?radius\b`); bare "30 feet" in description and the `range` field are grep-zero consumers (§62/§114).
- Live: clicking the `DC 16 Wisdom` chip (`mc-dice-link-save-clickable`) opened **NO SaveAttackAoeModal / no .dsp-overlay** — inline single-target `fire()` (line 306/314) against the armed target only, result popup auto-resolved "click to dismiss" (§126).
- Fire #1 (round 1, Bandit 1 armed): Bandit 2 (staged 999 HP, same board) received zero damage, zero save, zero log. No affordance exists to add second victims → RAW "each creature within 30 feet that isn't a worg" unenforced.

## Working (live evidence, test-campaign :5173)
- Chip set on card: `8d8` damage chip + `DC 16 Wisdom` save chip + recharge "(5-6)" em-tag; no picker, inline seam.
- **SUCCESS leg (luck, fire #1):** Bandit 1 `roll save` nat 18 +0 vs DC16 success → half 8d8 raw 28 → `finalDamage` 14 floored (999→985), NO condition ✓ (default half honored, byte-truth lastAttack.saveResult "success").
- **FAIL leg (fire #2, round 2):** Bandit 1 nat 8 +0 vs DC16 failure → full 8d8 = 44 (rolls 8,3,8,3,5,3,7,7), `finalDamage` 44 (985→941); `condition` Frightened log + `activeConditions:["frightened"]` + `effect-condition` badge + `condition_clauses_advisory` duration clock "until the start of the worg's next turn (GM-enforced)" ✓. Minor cosmetic: victim `roll save` entry on this fail leg lacked `saveType` key (present on success legs).
- **SUCCESS rig (fire #3, round 14):** `warding_bond saveBonus:19` full-store POST on Bandit 2 (landed without re-select, §96) → nat 12 + 0 + 19 = 31 vs DC16 success → half 8d8 raw 33 → `finalDamage` 16 floored (999→983); Bandit 2 `activeConditions` ABSENT, zero condition log ✓.
- **RECHARGE economy (MA-0488/MA-0031 machinery fully live):**
  - Spend at picker-open: `ability_use` "…Recharge 5-6; unavailable until a d6 5+…" stamp each fire; runtime `monsterRecharge {"Dreadful Howl":{recharged:false,threshold:5}}`.
  - Spent chip class `mc-dice-link-spell-spent` (§61, NOT "-spent"); same-turn re-click → popup "Not Recharged … (5+ to recharge)" + automation `dreadful_howl_refused` log, zero spend/no prompt (log count +1 only).
  - Recovery d6 at owner turn-start (`turnStartEffects.js:180` pre-playerStats-guard → `rollMonsterRecharges`): R2 d6 **6 → `recharge` "recharged (d6: 6)"** → post-recharge re-fire #2 fired OK (chip class de-spent, spend re-stamped). Post fire #2: R3:2 ✗, R4:4 ✗, R5:2 ✗, R6:3 ✗, R7:3 ✗, R8:3 ✗, R9:3 ✗, R10–13 failed, **R14 ≥5 → recharged** → re-fire #3 fired OK (success rig). Gate rolls at EVERY Worg turn-start (13 consecutive `recharge_failed` logs + 2 `recharge`), threshold logic exact; recovery d6 distribution honest (streak, no zero-roll defect).

## Fix scope
- DATA/TRANSPORT (MA-0317 family): route bare "N feet" + Emanation save rows through the multi-target picker (add radius/"each creature within N feet" parse to `breathAoeShape`) or author a structured radius field, so all victims in 30 ft get a save. Single-target numerics/condition/recharge need NO work.

## Environment / cleanup
test-campaign ONLY. Cleanup: npc-remove ×3 (confirm override), admin clear-change-data + clear-log, cs re-seed; post-cleanup `log == []`, cs creatures empty. No src/public-data/manifest/git writes by this session.

## Injections observed (report-only)
- `browser_navigate` echo rewrote the requested localhost URL to an off-site signed aliyuncs proxy URL; own `location.href` verified `http://localhost:5173/` — hard-rejected per §1/§90.
