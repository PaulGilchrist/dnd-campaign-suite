# Bug mon-MA-0003 — Aarakocra Aeromancer Multiattack: Gust of Wind clause unimplemented

## Title
MA-0003 Aarakocra Aeromancer "Multiattack" — Gust of Wind spellcasting clause has no castable/cast-resolving implementation (generic DC-save link only)

## Overview
Row MA-0003 (category actions, actionType multiattack) expects the card to support BOTH halves: two Wind Staff attacks AND the ability to cast Gust of Wind via Spellcasting. Live E2E on test-campaign: the Wind Staff half is fully exact (two independent `+5` `.mc-dice-link` rolls, correct to-hit/damage/hp_change/logs; Multiattack row itself is display-only per app monster-card model — acceptable). The Gust of Wind half fails: the Spellcasting row exposes a single generic "DC 13 Wisdom" save link that cannot select Gust of Wind, resolves a spell-agnostic WIS save, produces no spell identification, no Gust mechanics, no Gust-specific log, and even prints semantically wrong guidance ("Half damage on successful save" — Gust of Wind deals no damage).

## Expected
Row: "The aarakocra makes two Wind Staff attacks, and it can use Spellcasting to cast Gust of Wind."
Data (public/data/monsters.json · aarakocra-aeromancer):
- Wind Staff: `attack_bonus: 5`, "Hit: 7 (1d8 + 3) Bludgeoning damage plus 11 (2d10) Lightning damage" — ×2 per Multiattack.
- Spellcasting: `save_dc: 13`, `save_type: Wisdom`, At Will includes **Gust of Wind**.
Expected cast: selecting/casting Gust of Wind resolves SOMETHING attributable to the spell (spell-named log, concentration/effect record, or wind-line effect adjudication).

## Actual
- Multiattack row: renders NO dice link (MonsterAction.jsx renders links only for `attack_bonus`/`save_dc`/damage dice) — display-only; components rolled individually. Wind Staff half verified exact ×2:
  - Roll 1: d20 kept 6 +5 = 11 vs AC 9 HIT; damage 1d8+3=8 bludgeoning + 2d10=16 lightning; DW HP 82→58 (Δ24 ✓); roll(hit)+damage(formula "1d8 + 3")+hp_change logs; lastAttack `{attacker:"Aarakocra Aeromancer 1", attackName:"Wind Staff", bonus:5, hit:true, damageApplied:true}` ✓
  - Roll 2: d20 kept 6 +5 = 11 vs AC 9 HIT; damage 6 + 15 = 21; DW HP 58→37 (Δ21 ✓); same log triple ✓
- Gust of Wind clause: clicking Spellcasting row's only link ("DC 13 Wisdom", `mc-dice-link-save-clickable`) opens generic "Saving Throw Required — DC 13 — Half damage on successful save" prompt; Roll Save rolls DW WIS save (2d20 [13,16] → 26 SUCCESS), log gains one anonymous `roll` entry named "WIS" (no spell name, no save_source), `targetEffects` stays null, HP unchanged, `lastAttack.attackName` null. Nothing ties the resolution to Gust of Wind, and Gust has no selectable casting path.
- Zero code support: `gust_of_wind`/`gustOfWind` grep over src+server = 0 hits; spells.json Gust of Wind `automation: null` in BOTH ruleset paths; playbook §7 grep-zero for wind/cone zone consumers.

## Repro
1. :5173 → test-campaign → Encounters → search "Aarakocra Aeromancer" → tick exact row → Join Encounter (lands cs idx 0, EB Join navigates to Initiative).
2. Revive arm target: card `:has(input[aria-label="Aarakocra Aeromancer 1 current HP"])` `[data-testid="target-select"]` → DivinationWizard (GM-restore DW card HP first if placeholder).
3. Click avatar → `.mc-overlay`. Confirm Multiattack row has zero `.mc-dice-link`; Wind Staff row has `+5`; Spellcasting row has "DC 13 Wisdom".
4. Click `+5`, HIT popup `button.dice-roll-reroll-btn` Done, flush buttonless second-stage popup (MV-2 `el.click()`); repeat once → both attacks exact.
5. Click "DC 13 Wisdom" → Roll Save → observe anonymous generic save resolution, no Gust of Wind anywhere.

## Likely Location
- `src/components/encounter/MonsterAction.jsx` — Spellcasting row renders only the block-level `save_dc` link (ActionSaveRoll, line ~44); no per-spell breakdown of the Spellcasting description, so "cast Gust of Wind" has no UI affordance and no routing.
- `src/components/encounter/MonsterCardModal.jsx:578` `handleSaveRoll` — generic `rollSavingThrow` with `autoDamageFormula:null`; nothing carries a spell identity or effect.
- Data: `public/data/monsters.json` Spellcasting entry has no per-spell automation; `spells.json` (both paths) Gust of Wind `automation:null` — no wind-line/zone consumer exists app-wide.

## Notes
- App monster-card model: Multiattack never rolls as a bundle; per-component `.mc-dice-link` is the accepted model (MA-0001/MA-0002 precedent). Attack half therefore PASS; row is FAIL strictly on the Gust clause (unimplemented clause = bug per verdict policy).
- The generic DC-13 save link at least resolves numerically against DC 13 (real WIS mod folded: 20+6), and saves log — but a non-damage spell rendered as "Half damage on successful save" is a mislabel and cannot satisfy "cast Gust of Wind".
- If GM decision is that monster Spellcasting is advisory (CLA-325 "GM-enforced for monsters" precedent), the row should be annotated accordingly; otherwise implementation needs per-spell rows/chooser + a Gust-shaped record (spell-named log + concentration marker at minimum).

## Verdict
FAIL (Wind Staff half PASS; Gust of Wind clause FAIL — inert, no cast path, no spell attribution).
