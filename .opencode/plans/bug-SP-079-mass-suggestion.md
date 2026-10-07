# bug-SP-079 Mass Suggestion — §CLA-208 pay-at-open slot leak (FAIL)

Date: 2026-10-07 · Campaign: test-campaign · Host: DivinationWizard lv20 Diviner (SAVE DC 19, INT 21)

## Verified OK legs
- Canon `public/data/2024/spells.json` mass-suggestion: lv6, 60 ft, WIS save dc_success:none, duration "24 hours", concentration:false, automation `{type:"mass_suggestion", saveType:"WIS", saveDc:"spell_save_dc", range:"60 feet", duration:"24 hours", maxTargets:12}`.
- Sheet row shows "6 | Action | 60 feet | WIS | 24 hours | V/M"; Cast lane → `MassSuggestionModal` (`.sp-modal`) chooser "Select creatures within range... WIS ... DC 19".
- Chooser cap enforced: 13 candidates (2× Bandit + 12 PCs minus caster), counter maxes at "Mass Suggestion (12)".
- Humanoid gate: NONE — chooser lists every combatSummary creature (code: `MassSuggestionModal.jsx` eligibleTargets = all cs creatures; no type filter). Not RAW-gated (2024 text relies on immune-creatures; acceptable-ish but no gate).
- Per-target saves both faces (honest rolls): Bandit 1 FAIL 17<19, Bandit 2 FAIL 15<19 (NPC auto-roll lane), War_Cleric FAIL 9+7=16<19 (interactive .sp-overlay prompt), Wild_Sage_Druid SAVE SUCCESS 13+9=22≥19.
- FAIL stamps: activeConditions ['charmed'] on Bandit 1/2 + War_Cleric; condition log entries "Charmed by Mass Suggestion ... ends if you or allies deal damage" (end-on-damage note ✓). SUCCESS unstamped (Wild_Sage_Druid no charmed entry) ✓.
- Caster `pendingExpirations`: {target:"Bandit 1/2", effects:[{type:"charmed"}], appliedRound:1} — CLA-053 wired pattern present.
- 24h duration: INFINITY gap §38 confirmed — `expiryRounds:null` on all charmed expirations (no round/time expiry producer). Evidenced, advisory.

## FAIL: slot ledger (chooser pay-at-open leak, §CLA-208 family)
- Baseline `spell_slots_level_6`: **2** (GET /api/campaigns/test-campaign/change-data).
- Chooser OPEN (pre-confirm): **1**.
- Skip/cancel chooser: stays **1** — slot spent with zero saves/stamps (log: first `spell` entry, no cast resolution).
- Re-open chooser (second `spell` log entry): **0**; confirm+complete cast: stays 0.
- Net: **one completed cast consumed 2× lv6 slots** (2→0) + 1 phantom `spell` log entry from the cancelled open.
- Root: modalSpells.js `handleMassSuggestion` returns automationPopup; slot spend occurs at row-click/open lane before target confirm, same §CLA-208 "cost pays at ROW CLICK (cancel still spends)" defect family.

## Not obtained (budget)
- Charm-break-on-damage live face: sheet attack lane rolled nat-20 crit vs Bandit 1 twice ("✓ HIT (28 vs AC 12)" popups) but NO hp_change/damage log entry applied (popup lane shows roll only — §SP-071 bypass family); GM inline HP write anchored wrong cards. Expiration cleanup on damage therefore not live-proven this session; CLA-190 hooks (handleCreatureHpChange/removeCombatConditionsOnDamage) cover the pattern by code inspection.
- Command/suggestion text: no 25-word input field exists in modal or handler; nothing records command text (feature gap vs expectation).

## Repro
EB join 2× Bandit → Init → DivinationWizard sheet → Mass Suggestion row → Cast Spell → observe `spell_slots_level_6` mid-chooser → Skip → still spent.
