# Bug CLA-244 — Overchannel: backlash dice count off-by-one at use #2+ (and popup note unscaled)

**Date:** 2026-10-07 | **Host:** DivinationWizard lv20 Evoker (re-pointed Diviner->EVOKER via wizard step-7, disk-verified, KEPT; Maze + Mass Suggestion granted spells retained)
**Campaign:** test-campaign (localhost:5173, Playwright MCP; runtime+log admin-cleared after run, GET-verified `{}` / `[]`)

## Canonical (public/data/2024/classes.json:13510-13516, Wizard majors Evoker features)
> "When you cast a Wizard spell with spell slot of levels 1-5 that deals damage, you can deal maximum damage with that spell on the turn you cast it. First time: no adverse effect. If used again before Long Rest, take **2d12 Necrotic damage per level of spell slot** immediately after casting. This damage ignores Resistance and Immunity. Each additional use increases Necrotic damage per spell level by 1d12."

Automation key: `"automation": { "type": "overchannel", "casting_time": "passive" }` (classes.json:13514). Runtime ledger key: `Overchannel_useCount`.

## Expected vs Actual
- Use #2, lv2 slot (Mind Spike): expected **2d12 x 2 = 4d12**. App computed and rolled **6d12**.
- App formula everywhere: `dicePerLevel = 2 + (useCount - 1)` → use #2 = 3/level, use #3 = 4/level — always +1d12/level above RAW (RAW: use #N (N>=2) = N d12/level, i.e. `dicePerLevel = useCount`).

## Live evidence (2026-10-07)
1. Cast #1 (useCount 0→1): popup checkbox "Overchannel (Maximize Damage)" + info "First use: no necrotic damage"; lv2 Mind Spike → log save-damage `formula:"3d8 [Overchannel Maximize]", rolls:[8,8,8], total:24, saveDc:19, target Thug 1, finalDamage 24` (Thug 32→8); caster HP unchanged (currentHitPoints 82); lv2 slot 3→2. PASS.
2. Cast #2 (useCount 1→2): popup warning VERBATIM `Warning: Using Overchannel this time (use #2) will deal 6d12 Necrotic damage to you (ignores resistance/immunity). First use deals no damage.` — 6d12 vs RAW 4d12. Cast resolved: target maximized 24 again (Thug 24→0), then log roll `rollType:"overchannel-damage", formula:"6d12", rolls:[7,4,10,12,10,12], total:55, damageType:"Necrotic", targetName:"DivinationWizard", note:"Overchannel self-damage (ignores resistance/immunity)"`; currentHitPoints 82→27 (82−55=27 exact, ignores IRV applied). Numeric FAIL on dice count; application mechanics PASS.
3. Long Rest: `Overchannel_useCount` 2→0, HP 82, lv2 3/3, popup reverts to "First use: no necrotic damage". PASS.
4. Controls: Invisibility popup (host, no damage) — no checkbox. HexWarlock (control PC) Hex lv1 popup shows damage (1d6) — no checkbox. PASS.

## Defect sites (identical off-by-one formula)
- `src/services/automation/handlers/class-wizard/overchannelHandler.js:52` — `const dicePerLevel = 2 + additionalUses;` (additionalUses = useCount−1) — drives UI warning.
- `src/hooks/combat/handlers/handleOverchannelSelfDamage.js:9` — `const dicePerLevel = 2 + (context.overchannelUseCount - 1);`
- `src/hooks/combat/useLoggedDiceRollEventHandlers.js:151` — same formula in `applyOverchannelSelfDamage`.
- `src/services/automation/handlers/class-wizard/overchannelHandler.js:12` — popup info `take ${nextUseCount * 2}d12` — third shape: ignores slot level entirely (says "4d12" for use #2 any slot).

Fix: `dicePerLevel = Math.max(2, useCount)` (use #2 = 2/level, +1 per further use); scale popup note by slot level; add regression test per lane (save modal, event save path, UI).

## Notes
- Empowered Evocation INT fold absent from maximized formula face ("3d8 [Overchannel Maximize]" without "+5") — separate feature scope, noted only.
- Previous run (2026-08-31, bug file since deleted) flagged same quirk "(use2=3/level, RAW says 2 - consistent across UI/steps)" — never filed; this run files it, plus AoE lane now FIXED (savePath threads overchannelActive; `savePath-aoe-overchannel.test.js` exists).
- Stale cs.currentHp=1 cosmetic on PC cards persists after LR; authoritative PC HP is `<Char>.currentHitPoints` (applyDamage.js:443-465).
