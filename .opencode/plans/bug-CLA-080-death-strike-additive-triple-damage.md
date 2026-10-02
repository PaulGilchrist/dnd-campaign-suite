# bug-CLA-080-death-strike-additive-triple-damage

## Title
Death Strike: failed CON save applies doubled damage ADDITIVELY on top of already-applied base damage → target takes 3× the attack's damage instead of 2×

## Overview
CLA-080 Death Strike (Rogue Assassin lv17, `attack_rider`, 2024 rules) was verified E2E on lv20 AasimarTest (DEX 14/+2, PB +6 → DC 16) in test-campaign. Trigger gating, DC authoring, save prompt, prompt resolution, round-2 control, and same-turn re-arm all work. Defect: on a FAILED save the app applies the normal attack damage FIRST (hp_change −35), then applies `doubledTotal = adjustedTotal × 2` (70) as ADDITIONAL damage (save-damage −70) → total hpΔ = 105 = 3× base. RAW (and the feature text itself): the attack's damage IS doubled — total should be 70, not 35 + 70.

## Expected (canonical, app data public/data/2024/classes.json /8/majors/1/features/4 — matches manifest Expected)
"When you hit with Sneak Attack on first round of combat, target makes Constitution save (DC 8 + Dex mod + Prof Bonus) or attack's damage is doubled."
- automation: `{type:"attack_rider", saveType:"CON", saveDc:"ability", saveAbility:"DEX", trigger:"first_round_sneak_attack_hit", damageDoubled:true, oncePerTurn:false}`
- DC = 8 + 2 (DEX) + 6 (PB) = **16** (app authors DC from DEX — correct).
- On failed save: TOTAL damage from the attack = 2× base (single doubled application).

## Actual
1. Round 1, Clear→Join EB (Bandit), GM-rig Bandit 1 currentHp 999 (initiative card spinbutton, GET-confirmed `/combatSummary/creatures[0]/currentHp = 999`).
2. Sneak hit (crit): log `damage "1d6+2 [piercing] + 10d6 [Sneak Attack]" total 35` → `hp_change delta −35` (base applied immediately, Bandit survives).
3. CON DC16 save prompt fires (`saveType CON, saveDc 16`) → Roll Save → SAVE FAILURE (8+1=9 vs 16).
4. Log `save-damage "Death Strike" formula "2× 1d6+2 [piercing] + 10d6 [Sneak Attack]" total 70, saveResult failure, note death_strike_d…` → `hp_change delta −70` APPLIED ADDITIONALLY.
5. Bandit hp 999 → **894**: hpΔ = 105 = 35 + 70 = 3× base. RAW total = 70 (2×).
6. Second sneak hit same turn RE-ARMS te → second CON DC16 prompt (consistent with `oncePerTurn:false`); save fails again (8+1=9) → another −70 additive, again 3× this attack.
7. te (`death_strike`) cleaned after resolution; round-2 control PASS: sneak hit total 74 applied singularly, NO prompt, no save-damage entry (round gate correct).
8. Success face (save ≥16 → no doubled damage) NOT observed: 3/3 prompts rolled failures (6, 8, 9 totals); subsequent round-1 re-attempts blocked by session-stuck `_SneakAttack_usedRound` latch (no sneak dice → trigger never re-armed).

## Steps
1. test-campaign, AasimarTest (Rogue lv20, Assassin major temporarily), healthy.
2. Initiative → Clear (confirm) → Encounters → EB search "Bandit" (exact row) → check → Join Encounter.
3. Initiative → rig Bandit 1 current HP 999 via card spinbutton; GET change-data confirm `/combatSummary/creatures[0]/currentHp=999` (needs input+change+Enter+blur; ~12s debounce).
4. Arm AasimarTest Target = Bandit 1 (initiative card select); sheet → Actions → `.attacks .clickable` "+8" → HIT popup → Done → "1d6+2" chip → sneak hit lands.
5. Observe: base damage applied immediately (hpΔ = −base), CON DC16 prompt appears.
6. Prompt → Roll Save → on FAIL: second hpΔ = −(2×base) applied on top → hpΔ total = 3× base.

## Likely Location
- `src/hooks/combat/handlers/handlePlainDamage.js` — `applyDamageForTarget` (~:1079) commits the normal (undoubled) damage BEFORE `resolveDeathStrike` (:1103) resolves the save; on failure `resolveDeathStrike` (:181–244) applies `doubledTotal = adjustedTotal * 2` (:233) as an EXTRA hit instead of replacing/supplementing only the ×1 difference. Fix options: (a) defer base application until save resolves, apply `doubledTotal` on fail / `adjustedTotal` on success; or (b) keep eager application but apply only the `+adjustedTotal` delta on fail. The co-located author-intent test `handlePlainDamage.deathStrike.test.js` asserts the additive semantics — it encodes the same defect and needs updating with the fix.
- `src/hooks/combat/hitResolution.js` `maybeStoreDeathStrike` / `computeDeathStrikeSaveDc` (:251) are correct (round-1 gate, DEX-based DC 16, prompt send via `sendSavePrompt` :191, te cleanup :241 all verified live).

## Notes
- First run's decisive evidence was initially death-clamped (crit+sneak 98 killed the 11 HP Bandit before save resolution → hpΔ showed −11); rig HP ≥ ~150 to capture clean surviving-double numbers.
- `_SneakAttack_usedRound` latch can stick at round 1 across multiple combats within one session → later round-1 attacks roll WITHOUT sneak dice and the Death Strike trigger never arms; clear+join does not always reset it. Do the decisive capture EARLY in a session.
- Initiative-card HP rig posts to server only with input+change+keydown/keyup Enter+blur; bare `input` event updates client mirror only (GET shows stale).
- EB Join against an existing combat appends without resetting round; Clear (confirm) first for a fresh round 1.
