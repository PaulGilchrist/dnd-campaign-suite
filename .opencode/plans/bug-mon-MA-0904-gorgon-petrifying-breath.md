# BUG MA-0904 — Gorgon Petrifying Breath: first-fail OVER-GRANTS Petrified; two-stage ladder wholly inert

**Verdict: FAIL** (first-fail condition outcome RAW-wrong + second-failure ladder never adjudicates; core DC/cone/recharge themselves LIVE).

## Row (public/data/monsters.json gorgon actions[1], disk-verified 2026-09-23)
`Petrifying Breath` — save_dc:15, save_type:"Constitution", range:"30-foot Cone", recharge:"5-6", NO damage authored ✓.
save_effect: "First Failure: … Restrained … repeats the save at the end of its next turn if it is still Restrained, ending the effect on itself on a success. Second Failure: … Petrified … instead of the Restrained condition."

## Defect A (primary) — first-fail over-grants Petrified
`extractConditionsFromSaveEffect` (src/components/encounter/MonsterCardHelpers.js:316) word-scans ALL canonical conditions in prose. This ladder row carries BOTH "Restrained" AND "Petrified" → picker grants BOTH on the FIRST failed save.
Live proof (test-campaign, 2 fires, both fails):
- Log: `condition applied — "Petrified, Restrained" … Petrified, Restrained 1 minute` (×2)
- change-data `Bandit 1`: `activeConditions:["petrified","restrained"]`, meta both `{dc:15, ability:"con", source:"Gorgon 1"}`
- Picker copy itself prints the fingerprint: "On a failed save, target is Petrified, Restrained."
- Duration "1 minute" is fabricated — RAW Petrified is until dispelled (cockatrice twin authors petrified_hours×600 round clock, MA-0501).
§120 documented this extractor fingerprint as inline-seam-theoretical; this proves it FUNCTIONAL on the cone-picker route.

## Defect B — second-failure ladder wholly inert on this row (machine exists-unarmed)
Staged petrify machine LIVE (MA-0501 `cockatricePetrifyService.js`, te `petrifying_bite_staged` defs:438) arms ONLY on structured `action.staged_petrify` (parseStagedPetrifyClause, MonsterCardModal.jsx:923 — structured-only per §67). Gorgon row has no key → never armed:
- Zero turn-END repeat-save entries across TWO full turn-passes of Bandit 1 (walk r1→r2 twice).
- `targetEffects` top-level: null — no te, no ladder clock, no pendingExpirations.
- `repeatSave: action?.repeat_save || null` (buildSaveOptions:941) — no structured key, no prose parser for gorgon wording.
- NEW TRANSPORT GAP: `resolveSaveFailGrant` (SaveAttackAoeModal.jsx:619) carries NO stagedPetrify param — even an authored `staged_petrify` would NOT ladder through the cone picker; MA-0501 rides inline handleNpcSaveDamage:247 + prompt saveProcessing:397 seams only.

## LIVE-OK axes (not defects)
- CORE: DC 15 Constitution stamped (chip "DC 15 Constitution" mc-dice-link-save-clickable; zero damage chips = honest). Fails adjudicated honestly with rig stamps: fire1 nat19+(-19)=0 ✗, fire2 nat11+(-19)=-8 ✗ (Bandit disk con +1; deterministic fail via full-word saveBonuses.constitution:-19 + nested saving_throws.con:{modifier:-19} §163/§212). saveResult-<T> absent = picker-seam fingerprint §196; results modal + condition-applied DC15 are machine truth.
- RECHARGE 5-6 FULL CYCLE: spend at picker-open (`ability_use … Recharge 5-6; unavailable until a d6 5+`) + chip `mc-dice-link-spell-spent`; repress → `.mc-recharge-refusal` "Not Recharged … No save rolled, nothing spent" + `petrifying_breath_refused` zero-spend; recovery d6 at owner turn-start (`recharge_failed d6: 1` r1, `recharged d6: 6` r2, `Gorgon 1.monsterRecharge{recharged:false→true,threshold:5}`); refire after recovery opened picker + save again.
- Cone: picker "30-ft Cone (GM positions tokens; selection advisory)" ✓.

## Fix shape (MA-0501 template extension; code+data)
1. DATA: `staged_petrify:{petrified_hours:24}` + structured `repeat_save:true` on gorgon actions[1].
2. CODE: picker transport — thread stagedPetrify into resolveSaveFailGrant + SUPPRESS saveConditions auto-grant when ladder armed (§108 hit_choice suppression precedent) so fail#1 = Restrained only; add turn-END repeater consumer (applyPetrifyingBreathTurnEnd beside applyWeakeningBreathTurnEnd navigationHandlers.js:128): still-Restrained victim repeats CON save at end of next turn; success strips Restrained; second fail → swap te/conditions Restrained→Petrified with rounds:14400 clock (petrified_until_dispelled clock caveat — §70 "remove_*" residual).
3. Register gorgon te or reuse `petrifying_bite_staged` (per-source DC ok) + discriminator for cone vs bite label.

## Playbook pitfalls (new, this session)
- Ladder-word save_effect on PICKER route produces REAL double-grant (not just copy): condition word extraction order puts Petrified first — log/activeConditions both wrong-stage.
- `recharge_failed`/`recharge` automation logs stamp the d6 value; refusal popup chrome = `.popup-overlay`+`.mc-recharge-refusal` text pair.
- Initiative walk poll at 900ms can miss the Gorgon click when Gorgon sits early in creatures-array; poll `monsterRecharge.recharged` as the reliable recovery marker instead of lastAppliedTurnStartCreature.
- EB auto-navigate after first Join destroys search input (§126 re-confirmed); encounters-nav re-acquire before second join.
