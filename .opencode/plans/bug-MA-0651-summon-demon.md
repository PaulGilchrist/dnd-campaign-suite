# Bug MA-0651 — Drow Priestess of Lolth "Summon Demon" (actions[2]) — inert monster-side summon + OCR-typo self-damage

## Verdict
VERIFIED: FAIL — class (b): honest-inert row, no affordance, zero consumer (MA-0648 twin) PLUS data-hygiene defect: OCR typo "1dlO" in self-damage clause. DATA fix ticket.

## Automation under test
- ID: MA-0651, Monster: Drow Priestess of Lolth (`drow-priestess-of-lolth`, CR 12)
- Row: actions[2] "Summon Demon", actionType other
- Canonical (disk, verbatim incl. typo): "The drow attempts to magically summon a yochlol with a 30 percent chance of success. If the attempt fails, the drow takes 5 (1dlO) psychic damage. Otherwise, the summoned demon appears in an unoccupied space within 60 feet of its summoner, acts as an ally of its summoner, and can't summon other demons. It remains for 10 minutes, until it or its summoner dies, or until its summoner dismisses it as an action."
- Manifest: verified "not verified", stableKey `drow-priestess-of-lolth|actions|2`.

## Disk state (public/data/monsters.json, drow-priestess-of-lolth.actions[2])
- `name` + `description` + `usage:{type:"per day",times:3}` ONLY (disk says times:3 — cosmetic either way, §162).
- NO `automation` dict, NO numeric `uses`/`maxUses`, NO spell linkage. "Summon Demon" grep-zero in 5e + 2024 spells.json (MA-0648 evidence).
- OCR typo: "5 (1dlO) psychic damage" — canonical PHB = 1d10 psychic; `canRollExpression("1dlO")=false` (§23 known family: Silver, Ancient Bronze, yochlol, lizardfolk; parser at `src/services/dice/diceRoller.js:68`).

## Live evidence (test-campaign, :5173, 2026-09-20)
- Campaign header verified `test-campaign` immediately after select. Baseline log=0, cs=14 PCs.
- EB-joined `Drow Priestess of Lolth 1` (cs idx 0, hp 71) + `Bandit 1` (AC12, resistances [], hp 11) — cs names verified. Log baseline for probe = 4 join-noise entries.
- Summon Demon row DOM audit (`.mc-overlay` scoped, strong.startsWith anchor): `.mc-dice-link`=0, `button`=0, `[role=button]`=0, `a`=0. Renders `<strong>Summon Demon.</strong>` + prose + cosmetic "(3/Day)" label only. Row innerText carries "1dlO" verbatim.
- Whole-overlay chip census: 14 `.mc-dice-link` = ability-save (+0/+2/+1/+1/+3/+4, CON +4, WIS +6, CHA +7) + skill (+6/+6/+4/+5) chips + ONE "+5" Scourge attack chip (MA-0650 live twin). No lair/legendary chips, `[role=switch]/radiogroup/tablist`=0, no "Expend" text, NO Special-Actions grid (§41 absent). No fake emphasis chips on this row (§158 — row is plain prose, no decoy <strong>/<em> mid-prose).
- Center-row click probe (fresh boundingClientRect, scrollIntoView, mouse.click at center): zero visible popup overlays (`.popup-overlay/.sp-overlay/.sp-modal/.dsp-overlay/.ea-overlay` visible-count=0), zero log delta (log held exactly 4 join-noise entries, timestamps pre-date click), zero `ability_use`, zero refusal token. combatSummary unchanged — no Yochlol creature spawned.
- Cleanup: admin POST clear-change-data + clear-log (200, no dialog per §121); quiet re-GET after 14s: change-data keys=[], log=0. Clean.

## Grep evidence — monster-side summon machinery grep-zero (MA-0648 twin re-confirmed)
- `yochlol` — grep-zero across `src/` and `server/` (non-test). No yochlol producer, no consumer, no spawn table entry.
- `monster_summon` / `monsterSummon` — grep-zero app-wide.
- `30 percent` / chance-30 — grep-zero consumers (hits are unrelated grid/SVG constants + MA-0030 comment ids only). No coin-flip adjudicator exists.
- Summon seam unchanged: `summon_spirit` automation.type dispatched at `src/services/automation/index.js:610` → `handleSummonSpirit`/`handleSummonSpiritConfirm`; authored ONLY in `public/data/2024/spells.json` (PC-cast path, `SummonSpiritModal` in `src/components/char-sheet/CharActionModals.SecondaryModals.jsx`).
- Row renderer `src/components/encounter/MonsterAction.jsx`: "other"-type rows arm affordances ONLY via attack_bonus (:211), damage dice (:42), save_dc (:89), Spellcasting markup (:217), automation.effect gated reaction, legendaryGate (:162), self-zone aura dict (:180). Summon Demon matches none → zero clickable element — byte-identical fingerprint to MA-0648 (Drow Mage actions[1]).
- `formatActionUsage` (MonsterCardHelpers.js:1817-1823): `usage:{type:"per day",times:N}` → cosmetic "(N/Day)" text only; NO gate consumer of usage.times (§162, extended to non-save rows by MA-0648).

## Likely Location
- Renderer (root): `src/components/encounter/MonsterAction.jsx` — no branch arms a summon affordance for automation-less other-type rows.
- Click routing: `src/components/encounter/MonsterCardModal.jsx` — no summon route in action click handlers.
- Summon machinery to reuse: `src/services/automation/handlers/spells/summonSpiritHandler.js` (spawn + `resolveMonsterActions` fold) + `automation/index.js:610` dispatch table.
- DATA: `public/data/monsters.json` drow-priestess-of-lolth.actions[2] — missing automation + typo'd damage constant.

## Design option
- Preferred: NEW monster-side `automation:{type:"monster_summon", options:[{monster:"yochlol", chance:0.3}], self_damage_formula:"1d10", self_damage_type:"psychic", range_ft:60, duration_minutes:10}` row — chip on the Summon Demon row; coin-flip adjudication logged (yochlol appears vs self-damage 1d10 psychic on fail); spawn into combatSummary via summonSpiritHandler spawn/fold mechanics; ally tagging; gate via authored numerics `uses:3`+`maxUses:3` (disk usage.times:3 today is cosmetic only, §162).
- Alternative: spell-linkage (author "Summon Demon" spell entry + Spellcasting-style markup) — heavier, fake spell origin, muddies PC spell data (same adjudication as MA-0648).
- Self-damage clause MUST become a structured field (or clean "1d10" prose feeding an existing constant/dice extractor) — "1dlO" is unparsable by rollExpression even if summon ever becomes routable (§23).

## Notes
- 30 percent here vs Drow Mage twin's 50 percent (MA-0648) — coin-flip odds differ per monster; automation options must carry per-row chance, not a shared constant.
- Typo "1dlO"→"1d10" is a §23 OCR-family data fix independent of the summon routing fix.
- Disk usage is `times:3` (manifest-header claim of times:1 is wrong vs disk; cosmetic either way, no gate numeric exists).
- Duration (10 min) / dismissal-as-action / "can't summon other demons" = §70 advisory residuals, acceptable ONLY if summon itself fires (it does not).
- §86 precedent: EB-direct join of summoned-only creatures (yochlol itself) stays honestly inert — distinct question; this row is a regular joinable monster's own action judged on its affordance: none.
- Injection note: session carried off-site URL echoes in navigate/tool args (aliyuncs proxy) — rejected; `location.href` self-verified localhost:5173 throughout (§90).
