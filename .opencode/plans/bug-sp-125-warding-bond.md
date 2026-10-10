# SP-125 Warding Bond — inert slot burn before no-target guard (E2E 2026-10-09)

Working: link lane verbatim — target buff {warding_bond, acBonus:1, saveBonus:1, resistance×12}, caster buff bondTarget:"AasimarTest", conc:null (2024 `concentration:false` correct), ability_use log, share flow target→caster wired `applyDamage.js:795 → wardingBondService.js:56-83` (+28 unit tests green), endWardingBond legs code-cited.

## Defect (fired live)
Casting with no target selected shows "No target selected" popup but **still burns lv2 spell slot** — 2 slots lost (3→1→0) before handler's no-target guard; spell never applied. Slot spend happens upstream of `wardingBondHandler` guard; same economy-defect family as CLA-364 first-use SP drain. Second issue: `metaCtx.wardingBondTargetName` never set in production (tests only) — no SecondaryTargetModal path outside combat.

## Fix target
Move slot consumption after target validation (cast pipeline), and wire non-combat secondary-target chooser.
