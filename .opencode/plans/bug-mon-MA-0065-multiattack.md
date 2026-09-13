# Bug mon-MA-0065 — Adult Brass Dragon · Multiattack · Scorching Ray spell clause inert

## Verdict: FAIL (named spell cast with zero cast path — MV-8/MA-0003/MA-0033 precedent)

## Row
"makes three Rend attacks; can replace one with (A) Sleep Breath or (B) Spellcasting to cast Scorching Ray." (multiattack)

## Live halves (PASS components)
- Multiattack row itself: display-only, no affordance (accepted GM model, MV-3/MV-28 — row references live components).
- Rend: `.mc-dice-link` "+11" LIVE+EXACT — d20[8]+11=19 vs AC19 HIT; 2d10+6=[10,8]+6=24 Slashing + 1d8[5]=5 Fire = 29 total; server hp_change −29 (ElderPaladin 220→191); lastAttack {Rend, hit, +11}; log roll attack + roll damage named Rend.
- Sleep Breath: numeric-authored save row clickable per MV-23 — "DC 18 Constitution" save link → live prompt (targetName ElderPaladin, CON, DC 18); resolved named log roll "Sleep Breath" d20[13]+10=23 vs DC 18 → SUCCESS (zero-effect RAW correct; te null, conds []). Save-math single-target degrade per MV-21 (no cone picker).

## FAIL — Scorching Ray clause inert
- Spellcasting row collapses to ONE generic block save link "DC 16 Charisma" (MV-3/MV-5 fingerprint); spell names (Scorching Ray et al.) render as inert `<em>` text with zero clickable children (live DOM audit: only interactive child = block link).
- No spell chooser, no Scorching Ray entry anywhere in the flow: block prompt boilerplate "Half damage on successful save", damageFormula null, autoDamageFormula null; log has named "Spellcasting" block save rolls only — grep "scorching" across full campaign log = 0.
- Change-data: `scorching` hits = 4, ALL inside `combat-ui-viewingMonster` description-text echo (viewing cache); zero runtime consumer state; targetEffects null; spell slots untouched; HP zero-delta.
- Code grep: non-test `scorching` consumers in src/ + server/ = ZERO (4 test files only). No monster cast path for scorching-ray.
- Cosmetic/wiring notes: block-save quick-roll misapplies modifier ("d20 14 + 16 (+5 aura)" — +16 impossible for CHA save); save-fail condition path (Incapacitated staging) unexercisable at +10/+16 bloated modifiers; lastAttack.weaponType "ranged" for melee Rend; secondary damage die "1d8" omits authored +0 vs text "4 (1d8)" (MA-0033 same cosmetic).

## Cleanup
- Admin clear-change-data + clear-log POSTs (Host: localhost) executed. Browser closed. No manifest/playbook edits.
