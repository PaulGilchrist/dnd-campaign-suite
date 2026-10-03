# BUG FT-015 — Boon of Recovery (Last Stand): intercepted HP re-shaved by same-hit re-apply; no Long Rest recharge

**Verdict:** FAIL
**Date:** 2026-10-03 · Campaign: test-campaign · Host: Disciplined_Monk (lv20 2024 Monk, maxHP 143)
**Trigger:** `reduced_to_0_hp` · Model: AUTO interceptor (no popup offer)

## Canonical data (app, feats.json index `boon-of-recovery` — matches manifest exactly)

> **Last Stand.** When you would be reduced to 0 Hit Points, you can drop to 1 Hit Point instead and regain a number of Hit Points equal to half your Hit Point maximum. Once you use this benefit, you can't use it again until you finish a Long Rest.

Automation metadata (benefit "Last Stand", type `reaction`):
`{ type:"auto_effect", trigger:"reduced_to_0_hp", effect:"survive_and_heal", minHp:1, healExpression:"half_max_hp", recharge:"long_rest", casting_time:"1 action" }`

Note: manifest/app wording ("drop to 1 HP instead", casting_time "1 action") diverges slightly from 2024 RAW ("use a Bonus Action… regain HP"); adjudication here is against app DATA + manifest, which agree.

## Live consumer chain (real files — manifest names stale)

- Data: `public/data/2024/feats.json` → benefit "Last Stand"
- Feature mount: `src/services/rules/rules.js` `addFeatFeatures` → `allFeatures` name "Last Stand"
- Interceptor (live lane): `src/services/rules/combat/applyDamage.js:494` `ZERO_HP_INTERCEPTORS` pos 2 → `checkBoonOfRecoveryLastStand` in `src/services/rules/features/boonOfRecoveryService.js` — AUTO, sets `currentHitPoints = min(1+⌊maxHp/2⌋, maxHp)`, latch `boonOfRecoveryLastStandUsed=true`, logs `healing` "Boon Of Recovery - Last Stand", clears death saves/unconscious, mutates cs `creature.currentHp`
- InfoBuilder: `src/services/combat/automation/automationInfoBuilder/core-handlers.js` `survive_and_heal`
- Secondary reaction lane (registered, did not fire in tests): `src/services/automation/index.js:612` `survive_and_heal: handleBoonOfRecovery` → `handlers/reactions/boonOfRecoveryHandler.js` (computes `max(1, heal)` = 71, differs from service's 1+heal = 72 — latent math split if that lane ever routes)

## DEFECT 1 (blocking) — post-intercept damage re-apply shaves intercepted HP

EB-joined Fire Giant 1 · Flame Sword compound row (primary `4d6+7` + `secondary_damage 3d6`). Each stage-1 HIT-popup Done applies primary TWICE within the same click cycle:

- Run 1: HP 5 → 4d6+7=26 → intercept heals to **72** (`healing +72` log, latch True) → same-cycle `combined_damage_roll` re-applies 26 → `hp_change -26 cur 46`. **Final runtime HP 46, expected 72.**
- Run 2 (clean, after admin clear, single Done, fresh attack roll logged once): HP 5 → intercept to **72** → re-apply `-27 cur 45`. **Final 45, expected 72.** Popup text literally prints "HP: 72 → 45".
- Run 3 (post-LR, latch used): "HP: 21 → 0" then "33 applied HP: 33 → 0" — same double lane, masked by zero-clamp.

Log ordering (run 2, same ms): `healing +72 cur 72` → `roll damage fd 27 (combined_damage_roll)` → `hp_change -27 cur 46…45`. The second `applyDamageToTarget` call in the Done lane reads intercepted HP 72 as `oldHp` and subtracts finalDamage again. `interceptZeroHitPoints` returning `finalDamage:0` (applyDamage.js:500-509 `damageDealt: finalDamage` overwrite is suspicious) does not stop the compound-row re-apply.

Expected per wording math: drop to 1 + regain ⌊143/2⌋=71 → **72 HP**, stable. Observed: 45/46.

## DEFECT 2 (blocking) — Long Rest does not recharge Last Stand

`grep boonOfRecoveryLastStandUsed` → consumers only in boonOfRecoveryService.js / boonOfRecoveryHandler.js. `restRules-longRest.js` resets `undyingSentinelUsed` / `relentlessEnduranceUsed` / `boonOfFateUsed` (:691-693) but NOT `boonOfRecoveryLastStandUsed` (latch-family gap).

Live proof: Long Rest completed (HP 0→143, `long_rest` log, death saves cleared) → latch stayed `True` → third lethal post-LR went straight to 0 + death-save prompt (zero healing logs).

## Legs results

- **A (lethal, holder):** intercept fires AUTO (no affordance popup offer — AUTO model), latch+healing log+death-save clear all correct, cs currentHp momentarily 72 — **final HP WRONG 45/46 ≠ 72 → FAIL**
- **B (second lethal, same combat):** refused honestly (no second intercept), straight to 0, "Death Saving Throw" `.dsp-overlay` prompt ✓
- **C (Long Rest → third lethal):** recharge BROKEN → FAIL (defect 2)
- **D (control EvasiveFighter, non-holder):** lethal straight to 0 + death-save prompt, zero heal ✓

## Suggested fix targets

1. Compound attack+secondary re-apply lane (DiceRollResult Done / combined_damage_roll caller): must consume the interception result (or clamp to 0 post-intercept) so intercepted HP is not re-damaged. Check `applyDamage.js:500` `damageDealt: finalDamage` verbatim overwrite alongside `result.finalDamage=0`.
2. `restRules-longRest.js` LR reset list: add `['boonOfRecoveryLastStandUsed', false]` beside :691-693.
3. Latent: reconcile boonOfRecoveryHandler.js `max(1, heal)` vs service `min(1+heal, max)` if reaction lane ever routes.

## Repro recipe

1. Grant "Boon Of Recovery" via Edit wizard step-8 `.list-item-checkbox-trigger` tick + `.sidebar-save` (>10s disk verify feats[7]).
2. EB-join Fire Giant (Encounters search exact → checkbox → Join). Reload, re-select, Initiative.
3. Trusted fill `input[aria-label="Disciplined_Monk current HP"]`=5+Enter.
4. Arm `selectOption` Disciplined_Monk on giant's initiative card, open card avatar, Flame Sword chip (fresh rect mouse.click), stage-1 HIT popup Done once.
5. Observe `healing +72` then `hp_change −(same damage)` — final ≠ 72.

## Cleanup state

Admin cleared change-data ({}) + log ([]) native confirms; Fire Giant removed; host feats permanent (8 feats disk-verified); test-campaign re-selected, host ready.
