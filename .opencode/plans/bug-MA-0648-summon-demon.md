# Bug MA-0648 — Drow Mage "Summon Demon" (actions[1]) — inert monster-side summon

## Verdict
VERIFIED: FAIL — class (b): honest-inert row, no affordance, zero consumer. DATA fix ticket.

## Automation under test
- ID: MA-0648, Monster: Drow Mage (`drow-mage`, CR 5, innate DC 12 CHA)
- Row: actions[1] "Summon Demon", actionType other
- Canonical: summons a quasit, or attempts a shadow demon (50% success); appears unoccupied within 60 ft, acts as ally, can't summon other demons; remains 10 min / until death / dismissible as action.

## Disk state (public/data/monsters.json, drow-mage.actions[1])
- `name` + `description` + `usage:{type:"per day",times:1}` ONLY.
- NO `automation` dict, NO numeric `uses`/`maxUses`, NO spell linkage, NOT a spell in 5e or 2024 spells.json ("Summon Demon" grep-zero in both).

## Live evidence (test-campaign, :5173, 2026-09-20)
- EB-joined `Drow Mage 1` + `Bandit 1` (cs names verified). Opened mage `.mc-overlay` via avatar.
- Summon Demon row DOM audit: `.mc-dice-link`=0, `button`=0, `[role=button]`=0, `a`/link-span=0. Renders `<strong>Summon Demon.</strong>` + prose + cosmetic italic "(1/Day)" label only.
- Whole-overlay chip census: ability-save + skill chips only (-1/+2/+0/+3/+1/+1, Arcana/Deception/Preception/Stealth). No lair/legendary/action chips, `[role=switch]/radiogroup/tablist`=0, no "Expend" affordance, no Special-Actions grid.
- Click-anywhere-in-row probe (fresh rect, center click): zero popup overlays, zero log delta. Log held exactly 3 join-noise entries (encounter + 2 initiative rolls), timestamps ~50s before click; zero `ability_use`, zero summon spawn, zero refusal token. combatSummary unchanged (no quasit/shadow demon creature).
- Cleanup: admin cleared change-data + log; GET verified creatures=0, log=0 after quiet reload.

## Grep evidence — summon machinery is PC-cast-only
- `quasit`, `shadow.?demon`, `Summon Demon`, `monsterSummon` — grep-zero across `src/` and `server/`. No monster-side summon producer exists app-wide.
- Summon seam: `summon_spirit` automation.type dispatched at `src/services/automation/index.js:610` → `handleSummonSpirit` / `handleSummonSpiritConfirm`; type authored ONLY in `public/data/2024/spells.json` (PC spell casts). UI: `SummonSpiritModal` + `confirmSummonSpirit` wired in `src/components/char-sheet/CharActionModals.SecondaryModals.jsx` (character-sheet cast path, not monster card).
- Row renderer `src/components/encounter/MonsterAction.jsx`: "other"-type row arms affordances ONLY via attack_bonus (:211), damage dice (:42), save_dc (:89), Spellcasting-row markup (:217), automation.effect gated reaction (`getGatedMonsterReaction` MonsterCardHelpers.js:1218), legendaryGate (:162, legendary rows only), self-zone aura dict (:180). Summon Demon matches none → zero clickable element.
- `formatActionUsage` (MonsterCardHelpers.js:1817-1823): `usage:{type:"per day",times:1}` → cosmetic "(1/Day)" text; NO gate consumer of usage.times anywhere (monsterRecharge.js:38 matches recharge-on-roll type only). §162 re-confirmed + extended to other-type rows.

## Likely Location
- Renderer (root): `src/components/encounter/MonsterAction.jsx` — no branch arms a summon affordance for automation-less other-type rows.
- Click routing: `src/components/encounter/MonsterCardModal.jsx` — action click handlers (attack/save/spell/aura/reaction) have no summon route.
- Summon machinery to reuse: `src/services/automation/handlers/spells/summonSpiritHandler.js` (spawn + `resolveMonsterActions` fold) + `automation/index.js:610` dispatch table.
- DATA: `public/data/monsters.json` drow-mage.actions[1].

## Design option
- Preferred: NEW monster-side `automation:{type:"monster_summon", options:[{monster:"quasit"},{monster:"shadow_demon", chance:0.5}], range_ft:60, duration_minutes:10}` row — chip on the Summon Demon row, coin-flip adjudication logged (quasit vs shadow demon outcome), spawn into combatSummary via the summonSpiritHandler spawn/fold mechanics, ally tagging, 1/Day gate via authored numerics `uses:1`+`maxUses:1`.
- Alternative: reuse the `summon_spirit` seam by authoring a "Summon Demon" spell entry + Spellcasting-style markup — heavier, fake spell origin, muddies PC spell data; new type cleaner.
- 1/Day stays cosmetic until `uses`/`maxUses` authored (§162).

## Notes
- §86 precedent: EB-direct join of SUMMONED-only creatures (quasit itself) stays honestly inert — distinct question; here the row under test is a regular joinable monster's own action, judged on its affordance: none.
- Duration (10 min) / dismissal-as-action / "can't summon other demons" = §70 advisory residuals, acceptable ONLY if summon itself fires (it does not).
- Screenshot: ma-0648-drow-mage-card.png (viewport, card open, Summon Demon row text-only).
