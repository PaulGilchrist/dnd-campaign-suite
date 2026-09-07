# bug-CLA-337 — Storm's Thunder – Goliath (PASS-subset, gate inert + misattribution)

Date: 2026-09-06/07 run | Host: ElderPaladin lv20 Paladin, test-campaign | Verdict: **PASS-subset**

## What was verified live (EXACT)
- Subrace edit PRIOR=Stone Giant → NEW=Storm Giant via Edit wizard step 4, disk `public/campaigns/test-campaign/ElderPaladin.json` race.subrace="Storm Giant". Header "Storm Giant, Paladin (oath of devotion), Level 20".
- Reaction row "Storm's Thunder:" renders in Reactions; summary cell "Storm's Thunder: cur/max". Pool boots 0/6 post-edit; Long Rest arms to 6/6 (PB=+6).
- Trigger/damage: Thug 1 Mace HIT 20/19 (actualDamage 3, EP 224→221) → reaction click → log `roll` rollType:damage name:"Storm's Thunder Damage" rolls:[1] formula:"1d8" damageType:"Thunder" targetName:"Thug 1" + `hp_change` Thug 1 delta:-1 (32→31).
- 2nd: Mace HIT 19/19 (6 dmg, EP→215) → reaction → rolls:[7] 1d8 Thunder → Thug 31→24. Uses 6→5→4 in change-data.
- Uses exhaustion: stamp stormsThunderUses=0 via `POST /api/campaigns/test-campaign/ElderPaladin {"stormsThunderUses":0}` + reload (survives mount) → row shows "No uses remaining." → click refused popup "Storm's Thunder has no uses remaining. Uses will reset on the next Long Rest." (no uses, no damage).
- Long Rest refill: stormsThunderUses → null (=max fallback 6), EP HP 215→224. Refill cycle proven twice (boot 0→LR→6; drained 0→LR→null/6).
- Took-damage gate: after a MISS (lastAttack.actualDamage:null) click refused: "requires that you took damage from the attack. No damage was dealt." (uses untouched).
- Self-target gate: click while lastAttack.target≠self refused: "can only be used when you were the target of the attack and took damage."

## Gaps / bugs
1. **60-ft trigger gate INERT**: automation data `range:"60_ft"` (races.json Storm Giant trait) has ZERO consumers. `rg isWithinRange|60 src/.../giantAncestryTraits.js giantAncestryDispatch.js giantAncestryHandler.js automationRouter.js` → only giantAncestryOptions.js:49-50 display text. Handler (giantAncestryTraits.js:503+) gates only target/self/damage/uses — distance never consulted. Live unmodellable beyond-60ft hit (EB melee auto-miss >8ft), so proven by grep only; would fire from any distance.
2. **No `ability_use` spend log** (Stone's Endurance handler logs one; storms-thunder logs only `roll`+`hp_change`). Minor AGENTS.md logging gap.
3. **Data text wrong in options row**: giantAncestryOptions.js:50 says "make a ranged spell attack… On a hit" — trait makes NO attack roll (RAW auto-hit, handler rolls no attack). races.json canonical text is correct.
4. Note (not a bug): the reaction's own `applyDamageToTarget` re-stamps `lastAttack` attacker=ElderPaladin→Thug 1, which self-latches: a same-hit refire click is refused by the target gate (better than Stone's Endurance's refire gap).

## MISATTRIBUTION (flag for orchestrator manifest fix, do NOT edit verified field here)
Manifest row CLA-337 types this `classFeature`/class "Storm Giant" with handler/router/infoBuilder paths that DO NOT EXIST (`src/services/combat/automation/handlers/classFeatureHandler.js` etc — verified missing). Real ownership: **Goliath RACIAL subrace trait** `public/data/2024/races.json:628` (Storm Giant subrace, same family as Stone's Endurance/CLA-335). Real paths: display `src/services/combat/automation/automationRouter.js:90`; execution `src/services/automation/index.js:507` → `src/services/automation/handlers/class-other/giantAncestryTraits.js:503` (`handleStormsThunderDirect`, option variant `giantAncestryDispatch.js:509`); uses `trackedResources.js:258` + LR refill `restRules-longRest.js:564`; sheet cell `CharRaceFeatures.jsx:33`; row `CharReactions.jsx:148`. Recommend retype `racialTrait`, class "Goliath", fix paths.

## Cleanup
Admin Full Reset done: change-data `{}`, log `[]`. Server left up. Subrace left Storm Giant (permanent, registry to record).

## Security
Playwright navigate/wait parameter pollution with signed aliyuncs.com OSS URLs observed 3× (SP-111/CLA-326 family). Generated code every time executed the intended localhost:5173 URL; no external navigation performed. Reported, not obeyed.
