# bug-mon-MA-0465 — Celestial Spirit (Avenger) Radiant Bow: "+spell level" damage token never folded → hit deals zero damage

**Row:** MA-0465 · Celestial Spirit (Avenger) (`celestial-spirit-avenger`), action 0 "Radiant Bow"
**Verdict:** FAIL (damage leg inert on a confirmed HIT)
**Date:** 2026-09-18 · campaign: test-campaign · dev server :5173

## Data (monsters.json, ground-truthed)
```json
{"name":"Radiant Bow","attack_bonus":null,"damage_dice_primary":"2d6+2+spell level",
 "damage_type_primary":"radiant","range":"600 ft.",
 "description":"Ranged Spell Attack: +spell attack modifier, range 600 ft. Hit: 2d6+2+spell level Radiant damage."}
```
Caster-fold row (playbook §86 family). Summon spell: `Summon Celestial` — 2024 spells.json only (`public/data/2024/spells.json:12749`), level 5, `automation.type:"summon_spirit"`, variant `celestial-spirit-avenger`. grep-zero in 5e spells.json.

## Cast-path rig (reused harmless partial state, verified live)
- Caster: **Divine_Cleric** lv17, rules 2024, Life Domain. WIS 15+1=16 → **+3**, PB **+6** → spell attack **+9**, save DC 8+3+6=**17**.
- Change-data evidence of prior legit cast: log `summons` entry "Divine_Cleric casts Summon Celestial (slot level 5), summoning Celestial Spirit (Avenger) (40/40 HP)"; `spell_slots_level_5: 0` (spent); concentration stamp `{spell:"Summon Celestial", dc:17}`.
- Folded cs combatant: `attack_bonus: 9` ✓ (WIS+3 + PB+6 arithmetic verified), description folded to "+9 … 2d6+2+5 Radiant" ✓, but `damage_dice_primary` remained raw `"2d6+2+spell level"` ✗.

## Live adjudication (fresh page load + campaign re-select, current Vite code)
- Card `.mc-overlay`: Radiant Bow row chip `span.mc-dice-link` = "+9" (numeric folded chip PRESENT — attack affordance OK; no damage chip rendered, `canRollExpression` gate MonsterCardModal.jsx:394/651).
- Target armed via spirit's own initiative-card `[data-testid="target-select"]` → Bandit 1 (AC12, resistances[]).
- Chip fired: popup "Radiant Bow — d20 14 +9 (+9 to hit) ✓ HIT (23 vs AC 12)". Done clicked.
- Log machine truth: `roll attack` nat 14, bonus 9, total 23, effectiveAc 12, **hit:true, isCrit:false**; `lastAttack` mirrors identically.
- **ZERO `hp_change`** — Bandit 1 remained 11/11. Damage refused:
  `automation blocked — "damage formula \"2d6+2+spell level\" could not be rolled — GM adjudicate manually."`

## Root cause (disk, current code)
`src/services/automation/handlers/spells/summonSpiritHandler.js` `resolveMonsterActions`:
- Lines 70–77 fold `damage_dice_primary`/`secondary` for tokens **only** `WIS modifier` and `spellcasting modifier`.
- Line 81 folds `spell level` **only in `description`** — never into `damage_dice_primary`.
- No other producer app-wide folds "+spell level" in damage dice (grep-zero, non-test src).
- Downstream `MonsterCardModal.extractDamageDiceFromDescription` (:477) returns existing raw dice → `autoDamageFormula:"2d6+2+spell level"` → `canRollExpression` false → `resolveAutoDamageResult` null → `logBlockedDamageRoll` (:1408/:804).

## Fix suggestion
Extend the damage-dice fold in `resolveMonsterActions` to cover `/spell level/gi → String(slotLevel)` (same token already folded in desc), keeping `normalizeSigns` afterward. Add regression test alongside `summonSpiritHandler.test.js` asserting `damage_dice_primary:"2d6+2+spell level"` → `"2d6+2+5"` at slot 5 and chip rolls radiant.

## Registry notes (for re-use)
- Divine_Cleric lv17 2024: Summon Celestial in spellbook already; lv5 slot SPENT by this summon; lv6–9 slots open (lv6 recast = 2d6+2+6, HP 50).
- No spellbook/slot changes were made this run (reuse only). Bandit 1 AC12 clean victim intact at 11/11 pre-cleanup.

## NEW pitfall
§86 caster-fold fix covers `WIS modifier`/`spellcasting modifier` damage tokens; the **"+spell level" token is folded in description only** — any summon row with `damage_dice_primary` containing `spell level` (Celestial Spirit Avenger/Defender family) hits with ZERO damage: chip shows "+N", attack adjudicates, damage logs `automation blocked`. Do not trust the folded description as proof the damage formula was folded.
