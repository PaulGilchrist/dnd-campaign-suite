# Bug — CLA-013 Archdruid (FAIL(b) inert clause / manifest misattribution)

## Manifest clause (CLA-013, classFeature Druid, passive)
"At level 20, you can assume the form of a creature using the Wild Shape feature an unlimited number of times, and you don't need to use an action or bonus action to return to your normal form."

## Host
Wild_Sage_Druid — lv20, rules=2024, Druid / Circle of the Sea (`public/campaigns/test-campaign/Wild_Sage_Druid.json`). GM-only, :5173, test-campaign only.

## Defect
**(a) Unlimited uses at lv20 — ABSENT (inert, grep+probe proven).**
- 2024 rule data is truth: `public/data/2024/classes.json` lv20 `wild_shape: 4` (finite); lv17–20 all `4` — no unlimited tier exists in the 2024 Druid. The 2024 lv20 Archdruid grants **Evergreen Wild Shape + Nature Magician + Longevity**, not unlimited uses.
- Manifest text matches the **2014 SRD** Archdruid half (`public/data/classes.json:4278`, lv20: "You can use your Wild Shape an unlimited number of times…") — even there the "no action or bonus action to return" clause is NOT part of Archdruid (revert-prose belongs to base Wild Shape). CLA-013's wording is a hybrid that no app dataset carries.
- Zero producers/consumers: grep `unlimited` app-wide → monster-card "At Will" 999-sentinels only, nothing Druid. `classRules2024.js:134` max = `class_levels.wild_shape || 0`. `buffHandler.js:249` `handleShapeShift` ON-gate refuses at `currentWS<=0` (`wild_shape_refused`); `wildShapeCreatureBuilder.js:131` consumes `currentWS-1` **unconditionally** — no lv20/archdruid override. `grep level >= 20` → zero druid/wild-shape references.
- Live probe: sheet "Wild Shape Uses: 4/4" at lv20; Baboon form confirm → 3/4; counter decrement + refusal gate fully live. Clause (a) inert.

**(b) Free revert — behaviorally satisfied, generically.** Re-clicking the Wild Shape row (OFF leg of `handleShapeShift`) clears buffs/THP/beast-form and logs "deactivated Wild Shape" while consuming **zero** resources (uses held at 3, no refund, no spend). But this is base Wild Shape toggle behavior at every level and the app has **no PC action economy ledger at all** (`actionsRemaining|actionEconomy` grep-zero) — the clause is trivially true, with no Archdruid automation behind it. No waiver is (or can be) enforced.

## Evidence (GET truth, own curls)
- baseline `change-data`: `wildShapeUses=4` → ON confirm: `3`, `activeBuffs=[{effect:"shape_shift",castingTime:"1 bonus action"}]`, `tempHp=20`, cs `beastName:"Baboon"`, log `ability_use` "activated Wild Shape as Baboon (CR 0)."
- revert: `activeBuffs=[]`, `tempHp=0`, beast keys gone from cs, `wildShapeUses` still `3`; log `ability_use` "deactivated Wild Shape." popup "Wild Shape toggled OFF".

## Expected (if manifest enforced)
lv20 Druid would show unlimited (∞/absent) Wild Shape counter and never refuse at 0 uses; revert affordance would explicitly waive an action cost. None of this exists — and per 2024 data it should not: this is a **manifest attribution error** (2014 clause pinned to a 2024 host), same class as CLA-007 Animal Speaker FAIL(b).

## Fix options (orchestrator)
1. Re-attribute CLA-013 to a 2014 (`rules:"5e"`) lv20 Druid host and model `unlimited` there (counter suppression + `handleShapeShift` gate skip keyed off 2014 archdruid feature).
2. Or amend manifest to the 2024 capstone trio (Evergreen/Nature Magician/Longevity — automations already exist: `useInitiativeEffects.js:270/398` initiative recover; `ResourcePoolModal.jsx` conversion UI) and close CLA-013 as duplicate/misattributed.
3. Advisory residual: add an explicit free-revert log token (`shape_shift_reverted`, cf. `monsterShapeShift.js:72`) on the PC OFF leg if per-clause logging is required.

## Cleanup
Normal form restored; log + change-data admin-cleared and read-back (`log=[]`, keys absent). No save-file edits, no direct test POSTs, `docs/test-character-registry.json` untouched.
