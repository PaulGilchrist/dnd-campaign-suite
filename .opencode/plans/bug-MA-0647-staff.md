# Bug MA-0647 — Drow Mage "Staff": zero attack affordance + inert versatile clause

## Title
Drow Mage Staff (actions[0]): no attack_bonus → MA-0286 chip suppression renders row as pure prose (zero affordance), and prose-only versatile "or 3 (1d8 - 1) if used with two hands" is inert — two one-field DATA fixes.

## Overview
MA-0647, monster `drow-mage`, actions[0] "Staff" (actionType attack). Disk row carries `reach:"5 ft."`, `damage_dice_primary:"1d6 - 1"` bludgeoning, `damage_dice_secondary:"1d6"` poison — but NO numeric `attack_bonus` and NO `damage_dice_two_handed`; the to-hit bonus and the versatile alternative live only in the description prose. Verified live in test-campaign 2026-09-20: the Staff row renders with ZERO clickable affordances and no mode toggle anywhere on the card, so the attack can never be adjudicated by the app.

## Expected (canonical)
> "Melee Weapon Attack: + 2 to hit, reach 5 ft., one target. Hit: 2 (1d6 - 1) bludgeoning damage, or 3 (1d8 - 1) bludgeoning damage if used with two hands, plus 3 (1d6) poison damage."

- An attack chip "+2" renders on the Staff row (§4 chip census), rolls d20+2 vs target AC, and on a HIT the stage-2 popup should offer the two-handed variant chooser (MA-0325/MA-0636 seam: `buildTwoHandedVariantOffer` → `useLoggedDiceRollAttack.js:258`) allowing `1d8 - 1` bludgeoning in place of `1d6 - 1`, plus the live `damage_dice_secondary` poison leg (MA-0531 combined_damage_roll twin-proven app-wide, MA-0641 Drow Elite Warrior same structure).

## Actual
Live DOM audit of mage `.mc-overlay` (row anchored `strong.textContent.trim().startsWith('Staff')`, Bandit 1 AC12 armed on the mage's OWN initiative card, round 1):
- Staff row `.mc-dice-link` count: **0** (`chipsInStaff: []`); Staff row `button,[role=button],select` count: **0**. Row innerText is pure prose, byte-carrying the canonical text incl. "+ 2 to hit".
- Whole-overlay chip census: only ability-check chips (−1, +2, +0, +3, +1, +1) and skill chips (Arcana +6, Deception +5, Preception +4, Stealth +5) — zero attack/damage chips for Staff.
- Toggle audit `[role=switch]/[role=radiogroup]/[role=tablist]` across overlay: **0** (§147/§163 proof-of-absence: no versatile mode UI).
- Consequence: no to-hit roll ever logged; zero `roll attack`/`roll damage`/`hp_change` entries possible; poison secondary and two-hands chooser unreachable (chooser is HIT-popup-only, fire-gated behind the absent attack chip). Log numerics: N/A — nothing rolls (log joined-noise only, cleared post-run).

### Defect 1 — missing attack_bonus (FAIL(b)/DATA, MA-0286 fingerprint §64/§116)
- `attackRowMissingToHit` (`MonsterCardHelpers.js:436`): `attack_bonus == null` + `ATTACK_ROW_WORDING` regex matches "Melee Weapon Attack" ⇒ true; consumed at `MonsterAction.jsx:42` — `ActionDamageLinks` early-returns null, suppressing even the rollable `1d6 - 1`/`1d6` damage chips (auto-hit guard).
- The "+N" attack chip arms solely on `action.attack_bonus != null` (`MonsterAction.jsx:195/212`; modal fork `MonsterCardModal.jsx:481/487`). Prose fallback `monsterSpellAttackBonus` (`MonsterCardHelpers.js:465` → `MonsterCardModal.jsx:1064`) exists ONLY for spell-origin rows and requires "+N to hit with spell attacks" — grep-zero weapon-prose to-hit parser; the "+ 2 to hit" odd spacing never mattered since no parser reads weapon prose at all.
- **Fix: author `attack_bonus: 2`** on the Staff row (canonical prose; also consistent with disk DEX +2 — see Notes).

### Defect 2 — versatile inert (FAIL(a) family §163, MA-0636 twin)
- LIVE seam reads authored `action.damage_dice_two_handed` (`buildTwoHandedVariantOffer` `MonsterCardHelpers.js:704`; offer threaded `MonsterCardModal.jsx:917`; HIT-popup chooser `useLoggedDiceRollAttack.js:258`; Azer Warhammer/Drider Longsword authored twins). Drow Mage Staff disk keys: name, description, reach, damage_dice_primary/type_primary, damage_dice_secondary/type_secondary — **no `damage_dice_two_handed`** ⇒ offer null ⇒ prose "or 3 (1d8 - 1) if used with two hands" inert. Toggle audit 0 corroborates.
- **Fix: author `damage_dice_two_handed: "1d8 - 1"`** (MA-0636 one-field placement).

## Steps to reproduce
1. `npm run dev`, open http://localhost:5173, select `test-campaign` (verify header).
2. Encounters → search "Drow Mage" → check exact row → filter "Bandit" → check exact `Bandit` row (not Captain) → Join Encounter.
3. Initiative page: arm Bandit 1 on the Drow Mage 1 OWN initiative-card `[data-testid="target-select"]`; click mage avatar to open `.mc-overlay`.
4. Audit: Staff row shows no `span.mc-dice-link`, no buttons; overlay `[role=switch]/radiogroup/tablist` = 0. No chip to click; log stays empty of attack entries.
5. Cleanup: admin clear change-data + log (API POSTs 200), GET verify `{}` + `[]`.

## Likely Location
DATA, `public/data/monsters.json` → `drow-mage` → `actions[0]` (Staff): add `attack_bonus: 2` and `damage_dice_two_handed: "1d8 - 1"`. Code seams already live (`MonsterAction.jsx:42/195`, `MonsterCardHelpers.js:436/704`, `useLoggedDiceRollAttack.js:258`) — no code change needed.

## Notes
- **Disk ability-score note:** STR 9 (−1), DEX 14 (+2), INT 17 (+3); `proficiency_bonus:null` on disk. Canonical "+2" equals the DEX mod (legacy-SRD printing); the row is judged against its own canonical text ⇒ authored field is `attack_bonus: 2` (flag separately if PB-baked RAW +4 is desired — adjudication owner is orchestrator).
- **Prose "+ 2" spacing hazard:** `ATTACK_ROW_WORDING` and any future prose to-hit parsers must tolerate "+ 2" (space after sign); current suppression fires regardless of spacing, and MA-0286 keeps damage chips suppressed until numeric `attack_bonus` exists — fixing defect 1 alone also re-enables the primary+poison damage legs via the combined_damage_roll seam.
- Secondary poison `1d6` (damage_dice_secondary) is transport-live once an attack chip exists (MA-0531/MA-0641 twins, same monster family) — verify combined roll post-fix.
- Post-fix re-verify per §21/§106: DELETE `combat-ui-viewingMonster` keys + re-select campaign before judging rendered chips.
- Injection observation: one browser_navigate tool echo carried an OSS-proxy URL rewrite (documented §90 family); actual navigation stayed localhost:5173; verified by URL value comparison.

## Registry ledger append (Drow Mage)
```
| MA-0647 Staff FAIL(b)+FAIL(a): zero affordance confirmed live — Staff row .mc-dice-link=0, row buttons=0, overlay toggles [role=switch/radiogroup/tablist]=0, chips census ability/skill-only, Bandit 1 AC12 armed own-card, no roll attack/damage/hp_change possible; attackRowMissingToHit:436 suppresses damage chips (MonsterAction.jsx:42), +N chip arms attack_bonus!=null only (:195/212); monsterSpellAttackBonus spell-origin-only prose fallback, weapon "+ 2" prose grep-zero parser; buildTwoHandedVariantOffer:704 unauthored (no damage_dice_two_handed) = versatile inert MA-0636 twin; fixes attack_bonus:2 + damage_dice_two_handed:"1d8 - 1"; disk STR-1/DEX+2 note, canonical prose adjudication truth; cleanup cleared {}+[] (2026-09-20)
```

## Playbook new-line candidate
- MA-0645/0647 progression: prose "+N to hit" on plain weapon rows has NO parser anywhere (monsterSpellAttackBonus is spell-origin "+N to hit with spell attacks" only, MonsterCardModal.jsx:1064) — "+ 2" odd spacing is moot, MA-0286 suppression fires on wording alone; zero-chip rows with rollable damage_dice_* still log nothing (damage chips suppressed too, §116 is the whole proof — no rollback click needed).
