# MA-0927 — Grell · Paralyzing Tentacles (actions[2]) — FAIL(a)

## Verdict
**FAIL(a)** — attack half PASSES exact ("1d10 + 2" Piercing fd==|hpΔ|, HIT nat8+4=12 vs live AC12); save half WHOLLY INERT: zero save affordance on the row (static AND press-time), no adjudication, no consumer path for the authored save fields, no grapple/poisoned/paralyzed landing on the target. §MA-0860 twin framing + §MA-0909 grapple-family framing.

## Expected (from disk description, monsters.json grell actions[2], byte-quoted)
> "Melee Attack Roll: +4, reach 10 ft. Hit: 7 (1d10 + 2) Piercing damage. If the target is a Medium or smaller creature, it has the **Grappled** condition (escape DC 12) from two of ten tentacles. The target is also subjected to the following effect. **Constitution Saving Throw: DC 11.** Failure: The target has the **Poisoned** condition and repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically. While **Poisoned**, the target has the **Paralyzed** condition."

Disk keys CONFIRMED this session (dump): `attack_bonus: 4`, `damage_dice_primary: "1d10 + 2"`, `damage_type_primary: "Piercing"`, `reach: "10 ft."`, `save_type: "Constitution"`, `save_effect:` prose present — **`save_dc` ABSENT**, **`hit_conditions` ABSENT**, **`escape_dc` ABSENT**. Manifest `conditions:["grappled","paralyzed","poisoned"]` is annotation only — consumer never reads manifest/description.

DC NOTE (ticket vs disk): ticket header says "no save_dc authored — RAW DC 12"; disk description + RAW (CON 13 mod +1 + prof +2 + 8) = **Con save DC 11**. The 12 is the **escape** DC. Disk prose governs: fix uses save_dc:**11**, escape_dc:**12**.

## Actual (live, test-campaign, :5173 single tab, 2026-09-23, Bandit 1 AC12 HP 999 fresh EB join)
### Half A — attack: ✓ EXACT (budget 2/3, both sides observed)
| Press | d20+4 | vs | result | dice | type | fd | hpΔ | checks |
|---|---|---|---|---|---|---|---|---|
| 1 | 7+4=11 | AC12 live | ✗ MISS honest | — | — | 0 | 999 held | hit:false isAutoMiss:false isCrit:false; zero damage/hp_change legs post-press; effectiveAc:12 fresh |
| 2 | 8+4=12 | AC12 live | ✓ HIT §140-clean | "1d10 + 2" [2] mod2 | Piercing | 4 | 999→995 −4 | popup "✓ HIT (12 vs AC 12)"; damage rollType:damage formula "1d10 + 2" rolls[2] total:4 mod:2 finalDamage:4 note combined_damage_roll isCrit:false §188; hp_change −4 breakdown Piercing:4 fd==\|hpΔ\| §140; real-pointer Done button.dice-roll-reroll-btn §MA-0869; flush×2 §MA-0880; total=raw-nat+bonus §MA-0881 |

Crit §32-if-else VACUOUS (nats 7/8). Bonus total=raw §MA-0881; cs.lastAttack ABSENT — log-canonical §MA-0890.

### Half B — save half: ✗ WHOLLY INERT (chip-audit + grep)
- **Chip audit (card-static AND re-open press-time):** Tentacles row renders exactly ONE chip `span.mc-dice-link "+4"` role=button; `.mc-dice-link-save` count = **0**; spans matching `/^DC \d/` = **0**; total interactive elements in row = **1** (the +4 attack chip). Prose "escape DC 12", "Constitution Saving Throw: DC 11", "Poisoned", "Paralyzed", "Grappled" byte-renders as PLAIN TEXT only (§MA-0925 live twin re-confirmed). No prose chip exists to click → no spend, no "DC Unknown" popup, **silence**.
- **Post-hit adjudication probe (after the §140-clean HIT press):** Bandit 1 change-data store key **ABSENT entirely** (no `activeConditions`/`activeConditionMeta` surface); cs creature entry `conditions:null` `activeConditions:null` `targetEffects:null`; top-level `targetEffects` KEY-ABSENT; whole log 7 entries (encounter + initiative×2 + attack×2 + damage×1 + hp_change×1): **zero** `type:"condition"` entries, **zero** /grappl/i mentions, zero poisoned/paralyzed grants. No escape_dc:12 metadata, no grapple badge, no repeat-save clock, no Poisoned→Paralyzed chain. Rider structurally inert.
- **Post-Done popup flow:** HIT → Done → damage directly; NO save stage, no save prompt (modal save branch `MonsterCardModal.jsx:83 if (action.save_dc == null) return null;` same starvation family).

## Likely Location
- **DATA**: `public/data/monsters.json` grell actions[2] — **`save_dc` ABSENT** while `save_type`+`save_effect` ARE authored ⇒ save affordance gated off at `MonsterAction.jsx:91` (`ActionSaveRoll: if (action.save_dc == null) return null;`) and `MonsterCardModal.jsx:83` — exactly the §MA-0860 codification: DC-less rows spend use then "DC Unknown — no success or failure" (`DiceRollResult.jsx:377`) on paths that DO reach save processing; on this composite attack+save row the chip never renders, so the save never even reaches adjudication. Zero-chip rendering verified live §MA-0925 + this session.
- **DATA (grapple rider)**: `hit_conditions`/`escape_dc` ABSENT ⇒ `buildHitConditionClause` (`MonsterCardHelpers.js:598-605` — reads `hit_conditions`/`escape_dc` keys ONLY, NEVER description) returns null ⇒ `applyHitClauseConditions` (`handlePlainDamage.js:513`) never grants Grappled. §MA-0909 family exactly (zero grapple te in `targetEffectDefinitions.js`; grapple rides the hit_conditions→activeConditions route, consumer LIVE per authored precedents MA-0801 Bite escape_dc:15, MA-0812 Tentacles escape_dc:13, MA-0834 Gouge). Grep this session: no escape_dc/hit_conditions references outside consumer/tests; grell row keys lack both.

## Fix
Three-field DATA bundle on grell actions[2] after `damage_type_primary`/save fields (MA-0801/MA-0812 byte-shape + MA-0860/MA-0918 save-chip shape):
- `"save_dc": 11` — lights "DC 11 Constitution" save chip (one-field §MA-0860 fix; ticket's "RAW DC 12" is the escape DC mislabeled — disk prose DC 11 governs);
- `"escape_dc": 12` + `"hit_conditions": ["grappled"]` — arms §MA-0909 live hit-clause consumer for the two-of-ten-tentacles grapple (size token "Medium or Small" on Bandit cs passes `isLargeOrSmallerTarget`/size gate).
No code change. Manifest untouched (orchestrator-owned).

## Notes
- Poisoned→Paralyzed rider, repeat-save-end-of-turn clock, 1-minute auto-success: no live consumers even once save_dc lands (no concentration-like save-repeater machinery observed for monster riders); those legs remain description/GM-enforced — record as unexpressible axes at re-verify.
- Session ledger: header byte-match + reload-before-select §MA-0884; EB exact 'Grell' 1-row CR3 XP700 + Bandit CR0.125 anchor amid 4-row collision family §124 (bandit filter required REAL keystrokes — synthetic input events do not re-filter this build, NEW pitfall); native cb.click 2/2; Selected (2) pre-Join; join judged cs 16 creatures; Bandit 999 full-store cs POST GET-verified ac12 intact; Grell armed targetName='Bandit 1' GET-verified; admin-clear cd+log direct-fetch 200/200; quiet-recheck 15s cd `{}` log `[]`; single tab; dev :5173+:80 up; console 0 errors.
