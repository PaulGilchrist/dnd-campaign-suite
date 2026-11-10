# Ram aura logs a false "Prone applied" when the target was ALREADY prone — the condition log fires outside the branch that actually writes

## Summary

`maybeApplyRamProne` in `src/hooks/combat/handlers/handlePlainDamage.js` correctly skips the `activeConditions` write when the target is already Prone (case-insensitive dedupe), but the `condition applied` log row and its `dispatchEvent` fire UNCONDITIONALLY. Result: repeat Power-of-the-Wilds (Ram) hits on an already-prone target log "Prone applied" for a condition that was never granted — a false game fact in the campaign log, and a duplicate SSE badge event.

## Steps to reproduce

1. Code-locked face (already pinned): `src/hooks/combat/handlers/handlePlainDamage.ramAttack.test.js:197` — `it.fails('does not log Prone applied when the target was already prone')`. Un-marking shows: with `prevConditions: ['Prone']`, `setRuntimeValue` is NOT called (correct) but `deps.logEntry` IS called with `{type:'condition', condition:'Prone', reason:'Power of the Wilds (Ram)'}` (wrong).
2. Live face (test-campaign): give a Barbarian the Ram option, knock a goblin Prone with a Ram hit (first press → one Prone row), then press Ram again on the SAME still-prone goblin — the log gains a second identical "Prone applied" row although the target was already down.

## Expected behavior

Zero `condition`/`Prone` log rows and zero badge dispatches when the write is skipped for an already-prone target — idempotent ram hits are silent about Prone (still logging the damage/attack itself). First-time application keeps its current row verbatim.

## Likely location

`applyRamProneCondition` / `maybeApplyRamProne` in `src/hooks/combat/handlers/handlePlainDamage.js` — `logEntry`/`dispatchEvent` placed after the write guard rather than inside the writing branches.

## Suggested fix

Move `logEntry` + `dispatchEvent` inside the branches that actually write (or gate on a `wroteProne` flag). Flip the `it.fails` to a passing `it`; keep the existing positive/negative gate matrix green. Check the 2024 sibling module for the same shape.

## Resolution

**FIXED 2026-11-10.**

What was actually wrong: in `applyRamProneCondition` (`src/hooks/combat/handlers/handlePlainDamage.js`) the `activeConditions` write was correctly dedupe-guarded (case-insensitive `prone` check, both player and NPC branches), but the `{type:'condition', action:'applied', condition:'Prone', reason:'Power of the Wilds (Ram)'}` `logEntry` call and the `combat-summary-updated` `dispatchEvent` sat AFTER both branches, firing unconditionally — so every repeat Ram hit on an already-prone target logged a false "Prone applied" game fact and re-dispatched a badge event, while the state write was (correctly) skipped.

2024 sibling check: none exists — `applyRamProneCondition` is the single implementation shared by both rulesets (damage handlers are not dual-implementation; grep of `applyRamProne`/`Power of the Wilds (Ram)`/`context.ramActive` consumers is single-file), and the `ramActive` producer is the single `scanBuffsForAdvantage` in `src/services/automation/contextBuilder-sync.js` (`buff.optionName === 'Ram'`). Nothing else to fix.

Files changed:
- `src/hooks/combat/handlers/handlePlainDamage.js` — `wroteProne` flag set only inside the two writing branches; `if (!wroteProne) return;` gates `logEntry` + `dispatchEvent`. First-time applications log byte-identical to before.
- `src/hooks/combat/handlers/handlePlainDamage.ramAttack.test.js` — `it.fails` FIXME flipped to a passing regression lock, widened to `it.each(['Prone','prone'])` (the lowercase-dedupe face must stay silent too) plus a new pin that zero `combat-summary-updated` events dispatch when the write is skipped.

Verification evidence:
- RED: un-marked test failed pre-fix (2/2 faces logged the false row: `logEntry` called with `{type:'condition', condition:'Prone', reason:'Power of the Wilds (Ram)'}` while `setRuntimeValue` was not called).
- GREEN unit: `npx vitest run handlePlainDamage.ramAttack.test.js` 13/13; whole `src/hooks/combat/handlers` folder 50 files / 450 tests passed; `npm run lint` zero warnings.
- LIVE RED (test-campaign, pre-fix face captured by temporarily reverting the guard against the Vite-served src): sheet lane — Barbarian `DraconicDragon` (registry fixture) with curl-stamped `activeBuffs [{effect:'power_of_wilds_option', optionName:'Ram'}]` (seeded BEFORE campaign-select so the client mirror carries it) attacking an EB-joined Goblin (cs `size:'Small'`) whose `Goblin` change-data bucket was pre-seeded `activeConditions:['Prone']`. Two landed Ram hits ⇒ `/api/campaigns/test-campaign/log` accrued TWO `condition/Prone applied (Power of the Wilds (Ram))` rows while the bucket stayed exactly `['Prone']` (write deduped, logs lied) — the false-fact accumulation reproduced live.
- LIVE GREEN (post-fix, after guard restore + reload): third Ram hit on the still-prone Goblin landed damage (`hp_change` row, HP 40→31) with the Prone-applied row count held at 2 (zero new false rows).
- Adjacent positive face: DELETE the Goblin bucket, reload, one Ram hit ⇒ exactly ONE fresh `Prone applied` row + `activeConditions:['Prone']` written + `Prone` badge rendered on the Initiative card.
- Exit ritual: browser closed; admin clears GET-verified `change-data {}` / `log []` single-pass; EB join row, DD/Goblin rig buckets all evicted; no map/disk-file edits (`git status --porcelain public/campaigns/` empty); dev pair (:80/:5173) killed by PID (ports verified free); only the two source files above differ from HEAD.
