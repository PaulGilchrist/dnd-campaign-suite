# Bug CLA-033 — Beguiling Magic: granted condition never expires (no 1-minute clock); gated Charm Person lane bypasses the rider

## Title
CLA-033 Beguiling Magic (College of Glamour lv3, 2024 Bard) — trigger/save/choice/uses/LR chain LIVE and exact, but (a) the granted Charmed/Frightened is stamped with unbounded expiry (`expiryRounds:null`, no `expireOnCreatureName`) so the canonical "for 1 minute" is prose-only, and (b) the gated Charm Person confirm lane never fires the post-cast rider at all.

## Overview
Live E2E (test-campaign, Playwright only, localhost:5173) on HeroesFeastBard lv20 College of Glamour 2024 (CHA 20/+5, PB+6, DC 19):

**Working axes (verified live):**
- Feature row renders in Special Actions; tracked resource "Beguiling Magic: 1/1 (cur/max)".
- Always-prepared: Charm Person + Mirror Image derived into the spell list (disk `spells[]` carries neither; spellCalc2024.js:292 major-name gate passes).
- Cast Mirror Image (Illusion lv2, slot 3→2): rider fires immediately — `ability_use` log "Beguiling Magic triggered — target Bandit 1 must make WIS save (DC 19)", sp-modal "Saving Throw Required / Bandit 1 must make a WIS saving throw. DC 19".
- Save normal mode exact: sp-modal single die "d20 (3) + 0", "d20 (18) + 0" vs DC 19; save_result log with DC 19.
- Fail → cc-overlay "Choose Condition … Charmed / Frightened / Skip" — choice honored (Frightened picked twice → `Bandit N.activeConditions` gains `frightened`; Charm Person's own `charmed` coexists).
- Uses latch: `postCastRider_Beguiling_Magic` 1→0 on resolve; recast Mirror Image (slot 2→1) with uses=0 → zero rider footprint (no prompt, no ability_use, no new expiration).
- Long Rest reset: key → `null` (restRules-longRest.js:71), next Mirror Image slot-cast re-armms the rider (prompt + cc + ability_use), uses →0 again.
- Cantrip control: Vicious Mockery (Enchantment lv0) cast → no rider, slots untouched (`usesSpellSlot` gate postCastRiderService.js:65).
- School control: Spirit Guardians (Conjuration lv3, zero-target confirm, slot 3→2, concentration written) → no rider (`isEnchantmentOrIllusion` gate postCastRiderService.js:61).

**Defect (a) — duration 1 minute unenforced:**
`postCastRiderHandler.js:117` calls `addExpiration({ attackerName, targetName, effects:[{type:'condition',condition}] })` WITHOUT `rounds`. `expirationQueue.js:19` stores `expiryRounds: rounds ?? Infinity` and `expireOnCreatureName: null` — observed live in change-data:
`{"target":"Bandit 1","effects":[{"type":"condition","condition":"frightened"}],"appliedRound":1,"expiryRounds":null,"expireOnCreatureName":null}` (same for Bandit 2).
`processExpirationList` (`currentRound >= appliedRound + Infinity`) never expires it; `turnEndConditionRemoval.js` is feature-gated self-restoration only — no consumer clears it. The transport already carries `duration:'1_minute'` (postCastRiderService.js:90 `riderConfig.duration`) but the handler ignores it. The app HAS the codified 1-minute model — `parseDurationRounds` (durationParser.js) → `rounds:10`, used by saveAttackHandler.js:155-157 and the MA-0102 Weakening Breath clock (clearExpirationEffects.js:411-425 "1 minute (10 rounds)") — and a turn-stamp alternative (`expireOnCreatureName`) as accepted in CLA-236. Here NEITHER is stamped → canonical duration exists only in the log prose "…Frightened for 1 minute."

**Defect (b) — gated Charm Person lane bypasses the trigger:**
The only trigger call-site for `triggerPostCastRiderSaves` is `spellCastService/execution/index.js:479` (`runPostCastTriggers`, inside `executeSpellCast`). Charm Person's humanoid picker confirm routes through `spellGates.js:144 gateCharmPerson` → `useComplexSpellHandlers.js:162 / useSimpleSpellHandlers.js:324 triggerCharmPerson` → `charmPersonService.js` — a parallel lane that never calls `runPostCastTriggers`/`triggerPostCastRiderSaves`. Proven live: with `postCastRider_Beguiling_Magic` reset to `null` (uses-default 1) after Long Rest, a Charm Person lv1 slot-cast (own WIS DC 19 prompt resolved, slot spent) produced ZERO rider affordance — no Beguiling ability_use, no cc-overlay, no rider expiration entry; the immediately following ungated Mirror Image DID fire. Same family as SP-005/SP-085 confirm-path bypasses. RAW: "immediately after you cast an Enchantment … spell using a spell slot" — Charm Person is the feature's flagship trigger.

## Expected (canonical)
"You always have the Charm Person and Mirror Image spells prepared. In addition, immediately after you cast an Enchantment or Illusion spell using a spell slot, you can cause a creature you can see within 60 feet of yourself to make a Wisdom saving throw against your spell save DC. On a failed save, the target has the Charmed or Frightened condition (your choice) for 1 minute. Once you use this benefit, you can't use it again until you finish a Long Rest."

## Actual
- Trigger + DC + save mode + condition choice + once-per-LR latch + LR reset: exact.
- Duration: condition persists indefinitely (unbounded expiration, no turn-count/until-turn-start-of key at all — NOT a documented representation variant).
- Coverage: any spell whose cast routes through a custom gate (Charm Person proven) never arms the rider even with uses available.
- Cosmetic: rider save_result roller row logs `characterName:"Unknown"`; 60 ft range unchecked gridless (accepted model, CLA-223/260 precedent).

## Steps (repro)
1. test-campaign, HeroesFeastBard lv20 2024 Bard, College of Glamour (Edit wizard step-7 combobox → Glamour → ✓ Save; disk `class.subclass.name`).
2. EB Join Encounter: Bandit (→ Bandit 1). Arm Bandit 1 on bard initiative-card target-select (native setter + change).
3. Cast Mirror Image lv2 (Confirm) → sp-modal WIS DC 19 → Roll Save (fail vs +0) → Done → cc-overlay → pick Frightened → change-data: `postCastRider_Beguiling_Magic:0`, Bandit `activeConditions:['frightened']`, expiration entry `expiryRounds:null` (bug a).
4. Recast Mirror Image → refusal silent, uses stays 0 (latch works).
5. Long Rest → key `null`, slots refill → cast Charm Person lv1 (picker → cast → spell prompt resolves) → ZERO rider affordance (bug b); uses stays `null`.
6. Cast Mirror Image again → rider fires again (LR reset works) → cc → Frightened → uses 0 again.
7. Control casts: Vicious Mockery (cantrip) / Spirit Guardians (Conjuration) → no rider ever.

## Likely Location
- `src/services/automation/handlers/combat/postCastRiderHandler.js:117` — pass `rounds: parseDurationRounds(auto.duration)` (import from `src/services/rules/effects/durationParser.js`; '1_minute'→10) or an `expireOnCreatureName` turn anchor; the duration string already reaches the handler via `action.automation.duration`.
- `src/services/rules/features/charmPersonService.js` (and sibling gated spell services) — no `triggerPostCastRiderSaves` call; fix centrally (gate confirm adapters) or at the service level. Compare SP-085/SP-005 bypass family.
- Registration/trigger plumbing otherwise healthy: `automationInfoBuilder/conditional.js` passives carry `riderSave`; router `automation/index.js:360`; collector OK.

## Notes
- Host left at College of Glamour lv20 (PERMANENT subclass edit Valor→Glamour, this ticket's requirement). No spells added/removed. Rider expiration entries + conditions on Bandit 1/2 remain in change-data — cleared by admin cleanup at session end.
- The once-per-LR refusal is silent-by-design (`postCastRiderService.js:80` `continue` before handler) — matches canonical "can't use it again".
- 2024 casting_time 'Action' casing irrelevant here (rider does not gate casting_time).
