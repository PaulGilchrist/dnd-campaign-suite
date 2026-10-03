# FT-012 — Boon Of Fortitude: VERIFIED FAIL

Date: 2026-10-03 · Campaign: test-campaign · Host: Disciplined_Monk (lv20 2024, CON 14/+2, base max 143)
Caster: Wild_Sage_Druid (lv20 2024, WIS 15/+3, Cure Wounds lv1 = 2d8+MOD, 4 slots pre-run)

## Canonical wording (public/data/2024/feats.json · "Fortified Health" benefit)
"Your Hit Point maximum increases by 40. In addition, whenever you regain Hit Points, you can regain additional Hit Points equal to your Constitution modifier. Once you've regained these additional Hit Points, you can't do so again until the start of your next turn."

Automation metadata: `{ type:'passive_buff', effect:'fortified_health', amount:40, alsoSelfHealing:{ extraHealingExpression:'CON modifier', oncePerTurn:true } }`

## Real chain (manifest stale — featHandler/featRouter/featInfoBuilder do not exist)
- InfoBuilder: src/services/combat/automation/automationInfoBuilder/passive.js:38-45 — fortified_health → `{ type:'passive_rule', effect:'fortified_health', amount:40, alsoSelfHealing }` (comment: "keeps its distinct effect name for special routing").
- Max HP seam: src/services/rules/core/carryingCapacity.js:11-25 `applyMaxHpPassives` (called by abilityCalc2024.js:88 / abilityCalc.js:53) matches ONLY `passive.effect === 'max_hp_increase'`.
- Heal-bonus seam: src/services/combat/automation/automationPassives.js:141-154 `healingPassiveContribution` matches fortified_health + alsoSelfHealing; latch read = `getRuntimeValue(stats.name,'_fortifiedHealth_usedRound')` (line 148, truthiness check).
- Mark seam: `markFortifiedHealthUsed` (automationPassives.js:188 → oncePerTurn.js markOncePerTurn) called ONLY from healingHandler.js:61/156/447/490, massHealUtils.js:171, massHealHandler.js:170 — NOT from the spell-cast lane.
- Spell-cast heal lane: src/services/rules/spells/spellCastService/execution/index.js:424-438 `resolveGenericHeal` resolves bonuses from caster + targetStats but NEVER calls markFortifiedHealthUsed.
- Latch re-arm: Initiative.jsx:94 + navigationHandlers.js:65 clear '_fortifiedHealth_usedRound' at turn-start/round-wrap (correct, but moot — never set in this lane).

## Defect 1 (FAIL-a): max HP +40 never folds
- Pre-grant sheet baseline: Hit Points 143/143 (CON 14/+2; 143 = 8 + 5×19 + 2×20).
- Grant verified on disk: feats[] = [...,'Boon Of Fortitude']; featAbilityChoices 'Boon Of Fortitude-4' auto-assigned Strength (FT-001 orphan pattern; CON unchanged so CON-mod math unaffected).
- Post-grant reload (SSE + fresh page load): sheet STILL "Hit Points: 143/143". Initiative card max 143. hp_change log entries carry maxHp:143.
- Expected 143+40 = 183 → got 143. Root cause: applyMaxHpPassives matches only 'max_hp_increase'; no consumer anywhere handles `effect==='fortified_health' && amount` (grep: fortified_health appears ONLY in automationPassives.js + passive.js infoBuilder; zero hits in any HP calc).
- "Fortified Health" feature row renders in Special Actions (display-only) — classic display-only CLA-336 family.

## Defect 2 (FAIL-b): once-per-turn latch never latches (Cure Wounds cast lane)
Same combat, round 1 (combatSummary.round stayed 1 throughout):
1. Setup: GM HP inputs (trusted fill) → Monk 143→100, EvasiveFighter 50/94 (change-data confirmed currentHitPoints).
2. Cast #1 Cure Wounds → Disciplined_Monk: log `delta:10, formula:"2d8 + 3 + (2 Fortified Health)", bonusDetails:[{Fortified Health:2}]`, HP 100→110. Popup: "10 healing applied … Bonus: +2 (2 Fortified Health)". ✅ +CON fold correct (+2).
3. Cast #2 SAME ROUND → Disciplined_Monk: log `delta:11, formula:"2d8 + 3 + (2 Fortified Health)"`, HP 110→121. ❌ Bonus granted AGAIN — RAW requires refusal ("can't do so again until the start of your next turn"). Runtime latch `_fortifiedHealth_usedRound` = null after both heals (never marked; spellCastService never invokes markFortifiedHealthUsed).
4. Control Cast #3 → EvasiveFighter (non-holder): log `delta:12, formula:"2d8 + 3"` — no Fortified entry. ✅ differential proves the +2 is holder-scoped when it fires.

## Fix pointers
- Fold amount: carryingCapacity.js applyMaxHpPassives — accept `['max_hp_increase','fortified_health']` (or normalize in passive.js infoBuilder).
- Latch: spellCastService execution/index.js resolveGenericHeal — when bonusDetails contains Fortified Health and actualHeal>0, await markFortifiedHealthUsed(targetStats, campaignName) (holder store, NOT caster — healingHandler lanes 439/479 also mark caster's store while bonus resolved from caster; holder-vs-caster store split must stay symmetric with automationPassives.js:148 read which uses passive-owner stats.name).
- Note automationPassives.js:149 truthiness check ignores stored {round} — any future mark() would latch permanently outside Initiative turn-start clears; prefer checkOncePerTurn round-scoped semantics.

## Lane recipes
- Grant: Edit wizard → step-8 Feats → click boon row `.list-item-header .list-item-checkbox-trigger` (row-click alone may miss; checkbox click works) → "✓ Save" → >10s → disk feats[] verify. featFinder.js:4 debug console.error noise expected (found = no NOT FOUND line).
- Wound drop: initiative player-card `input[aria-label="<Name> current HP"]` — trusted fill+commit required (native evaluate setter did NOT persist).
- Heal lane: Druid sheet spell row → detail popup (heal-row radios "Level N Xd8 + MOD slots") → "Cast Spell" → target picker radio → "Cast Cure Wounds" → result popup "Bonus: +N (Fortified Health)" → Done (popup-overlay blocks next row click).
- Ground truth: `/api/campaigns/test-campaign/change-data` + public/campaigns/test-campaign/data/campaign-log.json hp_change.formula/bonusDetails.

## Verdict
FAIL — max HP +40 inert (sheet 143 ≠ 183) AND once-per-turn heal latch never engages on the Cure Wounds lane (double +2 same round). Healing +CON fold itself and non-holder differential are LIVE and exact.
