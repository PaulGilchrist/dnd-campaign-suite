# bug-mon-MA-0466 — Celestial Spirit (Defender) Radiant Mace: "+spell level" damage token never folded → hit deals zero damage (MA-0465 twin, re-ground-truthed)

**Row:** MA-0466 · Celestial Spirit (Defender) (`celestial-spirit-defender`), action 0 "Radiant Mace"
**Verdict:** FAIL (b) — damage leg inert on a live-confirmed HIT
**Date:** 2026-09-18 · campaign: test-campaign · dev :5173 (reused, HTTP 200)

## Data (monsters.json, ground-truthed THIS row)
```json
{"name":"Radiant Mace","attack_bonus":null,"damage_dice_primary":"1d10+3+spell level",
 "damage_type_primary":"radiant","reach":"5 ft.",
 "description":"Melee Spell Attack: +spell attack modifier, reach 5 ft. Hit: 1d10+3+spell level Radiant damage, and the spirit can choose itself or another creature it can see within 10 ft. of the target. The chosen creature gains 1d10 Temporary Hit Points."}
```
Action dict carries ONLY these 6 keys — **no structured `thp`/grant field**; THP clause is prose-only.
Spell: `Summon Celestial` 2024 spells.json lv5 `automation.type:"summon_spirit"`, variants include `celestial-spirit-defender` ✓ (confirmed via disk dump).

## Live adjudication (fresh cast, current code)
- Rig: Divine_Cleric lv17 2024, spellAtk **+9**, DC 17 (panel-verified). Change-data Admin-cleared beforehand.
- **Rig blocker found:** post-clear `Divine_Cleric.activeConditions` key absent → first cast hard-throws `activeConditions must be an array for caster` (`spellCastService/execution/index.js:116-119`, check runs unconditionally pre-resolution; burned 1 lv5 slot, zero summon — slot-leak family §84). Hydrated via sanctioned full-store POST `{value:{...existing, activeConditions:[]}}`.
- 2nd cast: variant chooser fired ("Choose the form… Avenger/Defender") → Defender → Summon. `summons` log: "Divine_Cleric casts Summon Celestial (slot level 5), summoning Celestial Spirit (Defender) (40/40 HP)."
- cs combatant: Bandit 1 AC12 joined idx0; Defender 40/40.
- Card `.mc-action` Radiant Mace: chip `span.mc-dice-link` = "+9" (attack fold ✓); desc folded "+9 … 1d10+3+5 Radiant" — **desc fold is NOT damage fold** (§97 pitfall confirmed THIS row).
- Target armed via spirit's own initiative-card select (self-excludes Defender) → Bandit 1. Chip fired: popup "d20 17 +9 ✓ HIT (26 vs AC 12)". Done clicked.
- Log machine truth: `roll attack` d20Rolls[17,11] bonus 9 total 26 effectiveAc 12 **hit:true**; `lastAttack` mirrors identically.
- **ZERO `hp_change`.** Damage refused:
  `automation blocked — Celestial Spirit (Defender) Radiant Mace: damage formula "1d10+3+spell level" could not be rolled — GM adjudicate manually.`

## Root cause (disk, current code — identical seam as MA-0465)
`src/services/automation/handlers/spells/summonSpiritHandler.js`:
- :70–73 `resolveMonsterActions` folds `damage_dice_primary`/`secondary` for tokens **only** `WIS modifier` / `spellcasting modifier`.
- :81 folds `spell level` **only in `description`** — never into `damage_dice_primary`.
- Downstream: `autoDamageFormula:"1d10+3+spell level"` → `canRollExpression` false (`MonsterCardModal.jsx:394/410`) → blocked-log.
- grep: no consumer keyed on "Radiant Mace" app-wide (zero); no `action.thp`-style attack-hit THP producer (temp_hp consumers are PC maneuvers/passives/thrall only; `attackRollPostDamage.js:220` merely absorbs).

## Step D — THP clause verdict: ADVISORY-UNBUILT (latent gap, not second FAIL class)
No structured `thp` field authored on the row → no chooser ever offered (live: hit popup was HIT+Done only; no MA-0275-family chooser; `parseAnimalSpiritVariants` is the save-row template and does not arm here). Per verdict policy: zero affordance + prose-only + no structured field = document latent gap. Any fix must author structured THP grant + chooser + `tempHp` producer (MA-0275 Fortify precedent, monster tempHp producer exists via `setTempHpOnKey` summonSpiritHandler:222).

## Fix suggestion
Extend `resolveMonsterActions` damage fold: `.replace(/\+?\s*spell level/gi, String(slotLevel))` on damage dice before/with `normalizeSigns` (fixes MA-0465 + MA-0466 + entire Celestial Spirit family in one seam). Regression test: slot 5 → `"1d10+3+5"` / `"2d6+2+5"` rollable radiant. Separate ticket: structured THP grant + chooser for Defender hit clause.

## Cleanup
Admin clear change-data + log POSTed; API verified: change-data keys `[]`, log total 0.

## Registry info
- Divine_Cleric lv17 2024: lv5 slots were 2 post-admin-clear; 1 burned by activeConditions-crash leak, 1 by legit Defender summon; both restored via admin clear anyway.
- Bandit 1 AC12 resistances[] clean victim pattern re-confirmed; EB keyboard-search "Bandit" → exact-row checkbox → Join lands idx0.

## NEW pitfalls
1. **Admin-clear hard-blocks ALL spell casts** until caster `activeConditions` key re-hydrated: `execution/index.js:116-119` throws unconditionally when runtime `activeConditions` is null/absent (even without magical_ambush passive), burning the spell slot with zero summon/log — after every admin-clear, seed `activeConditions:[]` (merged full-store POST) BEFORE casting.
2. Spell-row cell click on the summary sheet opens inline detail panel with **Cast Spell** button; variant chooser ("Summon"/Cancel) appears post-cast for summon_spirit variants — the whole cast is drivable from the sheet without a dedicated spells page.
3. EB filter + checkbox flow: after typing filter, Join button ref materializes late (`Join Encounter` grep-zero pre-check) — re-find post-checkbox.
