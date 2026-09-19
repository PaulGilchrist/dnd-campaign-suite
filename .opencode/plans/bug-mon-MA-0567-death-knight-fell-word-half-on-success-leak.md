# MA-0567 Death Knight Fell Word — FAIL(a): half damage leaks on save success (dc_success missing)

Date: 2026-09-19 | Campaign: test-campaign (localhost:5173)

## Row
legendary_actions[1] Fell Word: save_dc 18, save_type Constitution, damage_dice_primary 5d6 Necrotic, range 120 feet, save_effect "The target's Hit Point maximum decreases by an amount equal to the damage taken." Disk has NO dc_success, NO uses, NO delegates_to.

## RAW expectation
CON DC18, one creature within 120 ft. FAIL: 5d6 necrotic + target hp max decreases by damage taken. SUCCESS: no damage, no reduction. Repeat gated until start of DK's next turn.

## Live findings (Bandit 1 AC/CON victim, staged 999 via /combatSummary full-store POST; DK currentHp 199)
1. HEADER-SWALLOW CONTRAST (resolves KEY question): rows[0] Dread Authority uses:1 swallowed as economy header ("Dread Authority (1 left)", zero chips, MA-0566 shape), BUT rows[1] Fell Word renders its OWN affordances inside the legendary section: dice chip "5d6" + clickable "DC 18 Constitution" chip (ActionSaveRoll via MonsterAction.jsx:196; MonsterCardBody.jsx:55 slices rows[1..] with legendaryGate wired). Click routed through expendLegendaryUse (shared swallowed-header counter max:1).
2. SAVE-SUCCESS HALF-LEAK — FAIL(a): nat d20 18 + 0 = 18 vs DC 18 (boundary-exact success) -> popup "✓ SAVE SUCCESS ... 7 damage applied" = floor(14/2); save-damage log total 7 rolls [6,4,1,2,1] saveSuccess:true, hp 999->992. RAW expects ZERO on success. Seam: MonsterCardModal.jsx:682 `dcSuccess: action?.save_dc != null ? (action?.dc_success ?? 'half') : null` — MV-20 default-half hardcode. FIX DATA: add `dc_success: "none"` to the row (MA-0481/MA-0560 twins).
3. SAVE-FAILURE LEG LIVE: nat 10 + 0 vs DC 18 ✗ FAILURE -> 29 (5d6: 6,6,5,6,6) Necrotic, |hp_change 992->963| = 29 exact, full-on-fail correct, ability_use spend logged "expends a legendary use for Fell Word after AasimarTest's turn".
4. HP-MAX-REDUCTION INERT (advisory-unbuilt precedent): post-fail cs maxHp stays 999 (not 970), Bandit change-data keys only pendingExpirations:[], targetEffects null — zero hp-max-reduction producers app-wide (§116/§69, MA-0483/MA-0559/MA-0560 ladder precedent; not a new defect class, honest advisory note).
5. REPEAT-GATE LIVE (all refusals zero-spend, log automation/legendary_use_refused):
   - exhausted: 2nd click same boundary -> "has no legendary uses left — regain at the start of Death Knight 1's turn. Nothing spent, no roll." (shared swallowed counter used:1 max:1).
   - own-turn: post-regain click during DK's own turn (la 2:Death Knight 1) -> RAW "after ANOTHER creature's turn, not its own" refusal = timing gate honored.
   - turn-start regain LIVE: log "regains all expended legendary action uses at the start of its turn — 1 available", counter used 1->0.
6. Save bonus seam: printed +0 (cs lacks saving_throws/ability_score_modifiers — getCreatureSaveModifier MonsterCardHelpers.js:455 returns 0; MA-0303 family). Boundary-safe: success needed nat>=18, achieved nat 18 exact.

## NEW pitfalls
- Nested change-data combatSummary.activeCreatureName FREEZES at the last full-store-writing creature while top-level activeCreatureName + lastAppliedTurnStartCreature advance; expendLegendaryUse gate (getCombatContext reads nested blob only, damageUtils.js:40) returns false 'own-turn' refusals forever after a monsters-first walk — unstuck via legit full-store POST /combatSummary {value:cs} with desired activeCreatureName.
- Same-turn refusals are chip-visible replay-prone: two identical refusal popups logged separate refusals — count refusals by log entries, not popups.

## Verdict
FAIL(a): half-on-success damage leak (DATA one-field fix dc_success:"none"). Failure-leg numerics, economy gate, refusals, regain all LIVE. hp-max-reduction clause advisory-unbuilt per §116 precedent (zero producers; separate engine ticket if ever built).
