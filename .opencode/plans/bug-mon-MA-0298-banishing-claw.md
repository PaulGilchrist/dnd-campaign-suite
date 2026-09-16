# MA-0298 — Arcanaloth "Banishing Claw (Requires Soul Tome)": half-damage leak halves unconditional hit damage on successful CHA save; crit damage dice not doubled; failed-save demiplane-trap clause (incl. Incapacitated) fully inert

## Overview
Live EB probe (test-campaign, 2026-09-16, Arcanaloth 1 cs idx8 init11): attack leg (+9), DC17 CHA save timing (hit-only, miss-gated clean) and full-damage-on-fail math are exact — but three cores are broken:
1. **MV-20 half-damage leak (same fingerprint as MA-0218):** row authors no `dc_success`, code defaults `dcSuccess:'half'` (MonsterCardModal.js:134/:526/:1136) and halves the claw's UNCONDITIONAL hit slashing damage whenever the follow-up trap save succeeds. RAW the save only gates the demiplane trap — hit damage (2d4+5 Sl + 3d12 Psi) is paid on the attack roll regardless.
2. **Crit damage dice not doubled:** nat20 crit flagged "Critical Hit! — damage dice doubled" in popup, yet damage rolled base 2d4+5 and 3d12 (3 dice).
3. **Failed-save trap clause byte-inert:** save FAILURE leaves zero state — no `banished_demiplane` te, no Incapacitated condition, no `condition`/te-granted log. Repeat-save/bound-at-3 impossible (no fail state to repeat against).

## Expected (monsters.json arcanaloth actions[2] / manifest MA-0298)
- Attack +9 vs AC; Hit → 2d4+5 Slashing + 3d12 Psychic, unconditional, dice doubled on crit.
- Post-hit CHA save DC 17 (hit-only): fail → trapped in demiplane, Incapacitated, repeat save end of each turn, 3 fails → bound. Success → nothing further (damage stays full).

## Actual (leg-by-leg, 3 full rolls + 1 miss)
Roll 1 (crit, save SUCCESS) — Druid 143 topped:
- attack log nat20 ([20,6] normal echo) +9 = 29 vs AC9, isCrit:true.
- save-prompt `2d4 + 5` rolls [2,3] total 15 dcSuccess:"half"; save "succeeded CHA (DC 17, rolled 19 + -1 = 18)"; saveResult-Wild_Sage_Druid success:true.
- hp_change delta **-25** breakdown Slashing **7** (=floor(15/2), halved on save success) + Psychic 18 → server 143→**118**. RAW expected -33. HALF-DAMAGE LEAK CONFIRMED LIVE.
- Crit: slashing popup/log "2d4: 2,3", psychic "3d12: 10,1,7" — no doubling. CORRUPT ON CRIT.
- Popup echo bug: "7 damage applied — HP 143→136", "25 damage applied — HP 161→136"; server truth 118 (currentHp echoes +20/+18 phantom).

Roll 2 (hit, save FAILURE) — Druid re-topped 143:
- attack nat19 +9 = 28 vs AC9 hit.
- damage full: 2d4+5 [3,2]+5=10 + 3d12 [6,9,5]=20; hp_change delta **-30** breakdown Slashing 10 + Psychic 20; server 143→113. popup==log==Δ exact (no halving on fail ✓; psychic logged in breakdown — MA-0296 "silent psychic" now resolved: it lands AND logs).
- save failure: nat10 + -1 = 9 < 17; saveResult success:false.
- **Trap inert:** after failed save change-data targetEffects null, activeConditions null; no `banished_demiplane_granted`, no `condition applied` log. Repeat-save seam / bound-at-3: absent (nothing to stage). MA-0104 consumer `banished_demiplane` did NOT fire here — `parseBanishTransportClause` (MonsterCardHelpers.js:163) matches only "transported to a harmless demiplane"; "trapped in a demiplane inside the Soul Tome" never matches (comment self-documents byte-inert). `extractConditionsFromSaveEffect` DOES find 'incapacitated' in this save_effect yet nothing consumes it at this attack+save fail seam.

Roll 3 (MISS, gate probe) — armed ElderPaladin AC19:
- nat4 +9 = 13 vs AC19 MISS; log attack-only, lastAttack hit:false; ZERO save-prompt/save/save-damage/hp_change; EP te null, conds [], saveResult stale (untouched promptId). CRITICAL MISS-GATE PASSES.

## Verdict inputs
- FAIL triggers met: half-damage leak corrupts hit damage (roll 1, -25 vs -33) + crit numbers wrong + secondary core (save-fail effect) produces zero state.
- Clean legs (documented, reusable after fix): attack math/bonus/AC, miss→zero-everything gate, hit-only DC17 save prompt, full-damage-on-fail + breakdown logs, saveResult capture, ungated Soul-Tome name-only gate (known MA-0296).

## Likely Location
- `src/components/encounter/MonsterCardModal.js` — buildSaveOptions/attack-context default `dc_success ?? 'half'` (:134/:526/:1136); needs row/data `dc_success:"none"` (same fix as MA-0218 suggestion) OR attack-damage leg decoupled from save-dcSuccess when the save carries no damage of its own (`save_effect` has no damage clause).
- `public/data/monsters.json` arcanaloth actions[2] — add `dc_success:"none"` (save gates trap only, not damage).
- Crit doubling: save-attack chip path rolls damage via save-damage pipeline which ignores `isCrit` (save-damage formula stays base) — forward crit die-doubling or roll attack auto-damage separately.
- Trap clause: `MonsterCardHelpers.js parseBanishTransportClause` regex won't match; needs a `soul_tome_imprisonment`-style parse + te producer + repeat-save/bound staging (saveProcessing.js:586 grantDemiplaneTransport is MA-0104-wording-only, rounds:2 clock wrong semantics for indefinite-tome trap).

## Steps to Reproduce
1. test-campaign, initiative live; EB exact "Arcanaloth" → Join (idx8). Open card, target-select Wild_Sage_Druid (top HP first, sanctioned).
2. Banishing Claw row "+9" chip → HIT popup Done → damage popup + stacked "Saving Throw Required DC 17 (Half damage on successful save)" → Roll Save.
3. Success → slashing halved in hp_change breakdown. Fail → full damage, zero te/condition.
4. Re-arm ElderPaladin (AC19) → chip → MISS → no save prompt, no damage.

## Notes
- Cosmetic: d20 phantom echo `rolls:[20,6]`/`[4,19]` mode:normal; popup currentHp phantom baselines; stale pending CON DC20 prompt (ElderPaladin, pre-existing, untouched).
- No mutating POSTs; no manifest/playbook/registry edits. Overlays flushed; rename input never Enter'd.
