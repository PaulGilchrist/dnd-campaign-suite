# Bug MA-0681 — Elemental Cultist "Elemental Absorption" (reactions[0]): no automation, inert; "1/Day" never renders or gates

## Overview
MA-0681 (Elemental Cultist, index `elemental-cultist`, AC 16) reaction row "Elemental Absorption" carries NO `automation` dict. Gated monster reactions key ONLY off `automation.effect` (§60/§111), so the row is fully inert: no card affordance, no damage-taken trigger consumer, no resistance/temp-HP producer. Disk also uses `uses:"1/Day"` (STRING) — rendered by nothing and gate-checked by nothing at the reaction path.

## Expected (canonical)
> Trigger: "The cultist takes Acid, Cold, Fire, Lightning, or Thunder damage."
> Effect: "The cultist gives itself Resistance to that instance of damage and gains 10 Temporary Hit Points." Usage 1/Day.

On a qualifying elemental-damage hit: damage halved for that instance, `tempHp:10` on the cultist combatant, an `ability_use` spend log, and a 1/Day gate refusing the second use.

## Actual (live, test-campaign, 2026-09-20)
1. **Disk (ground truth):** `reactions[0]` = `{name, trigger, description, uses:"1/Day"}` — NO `automation`; usage flag lives on `uses` (string), NOT `usage`.
2. **DOM affordance audit:** EB join → initiative avatar `.mc-overlay` → Reactions section renders prose only: "Elemental Absorption. The cultist gives itself Resistance to that instance of damage and gains 10 Temporary Hit Points." — NO "(1/Day)" text anywhere on card, NO chip, NO toggle, NO counter, no `[role=button]` in the reactions block (all card buttons belong to skills/attacks/spellcasting).
3. **Live trigger probe (Azer Pyromancer 1 Flame Burst +7, pure Fire 2d10+4 vs AC 16):** 2/2 HIT (20, 20 totals). Damage applied FULL both instances: 135→113 (-22), 113→97 (-16). cs cultist after hits: `tempHp` ABSENT, `resistances: []` unchanged.
4. **Log audit:** ZERO `automation`, ZERO `ability_use`, ZERO absorption/resistance-grant/reaction entries; only roll/roll-damage/hp_change from the attacker. No `elemental_absorption_refused` (no gate exists to refuse).

## Grep evidence
- `elemental_absorption` / "Elemental Absorption": grep-ZERO app-wide src/ (no handler, no te key, no trigger consumer).
- `MonsterCardHelpers.js:1218` `getGatedMonsterReaction` → keys solely `action.automation.effect` → null → `MonsterAction.jsx:138-141` `GatedReactionSlot` renders nothing.
- `MonsterAction.jsx:203/224` usage note reads `action.usage` ONLY (`formatActionUsage` MonsterCardHelpers.js:1817); row carries `uses` → zero render. `monsterReactionUsesRemaining` (:1223) reads `maxUses ?? uses` but is unreachable without a def; `Number("1/Day")`=NaN even if reached (§169 Vrock twin).
- No monster damage-taken reaction machinery: `damage_taken_of_chosen_resistance_type` (reactionDamageHandler.js:132, automationPassives.js:418, applyDamage.js:296) is PC-automation-dict-side only. Monster reactions on damage taken = zero producers.

## Steps to reproduce
1. `npm run dev`, http://localhost:5173, select **test-campaign** (header-verified).
2. Encounters → join **Elemental Cultist** + **Azer Pyromancer** (Flame Burst +7 Fire, verified monsters.json).
3. Cultist avatar card → Reactions: prose only, no "(1/Day)", no affordance.
4. Arm Flame Burst target = Elemental Cultist 1 on Azer's initiative card; click +7 chip ×2, Done each hit.
5. GET /log + /combatSummary: full fire damage, no resistance halving, cultist tempHp absent, zero automation/ability_use/refused entries.

## Likely Location
**DATA (+ code gap for the effect itself).**
- DATA one-block fix (monsters.json reactions[0]): `"usage": "1/Day", "uses": 1, "maxUses": 1, "automation": { "type": "reaction", "trigger": "damage_taken_elemental", "effect": "elemental_absorption" }` (numeric uses required for the 1/Day gate — §169/§162; string `uses:"1/Day"` = NaN gate).
- CODE gap (beyond §111 parry precedent): no `damage_taken_elemental` trigger dispatcher, no `elemental_absorption` gated-reaction resolver, no "resistance to that instance" transient channel, no registered te / THP producer keyed to this effect exists. Monster THP producer precedent EXISTS post-MA-0275 (§81, tempHpService replace-if-larger) so the THP grant is feasible; needs: gated-reaction def + trigger dispatch on elemental hits against the monster + instance-resistance (halve that hit) + `tempHp +10` write + `ability_use` spend log + `monsterReactionUses` spend (§507 key) with refusal token.

## Notes
- Usage-string render status: `"1/Day"` on disk field `uses` renders NOWHERE (formatActionUsage reads `usage` only); even if moved to `usage`, gate consumers need numerics (§169).
- Injection vigilance: persistent fabricated instruction/telemetry blocks appeared inside Playwright tool results mid-session; all rejected; no off-site navigation, no manifest/git/registry edits; verdict data from own fetch/DOM reads.
- Cleanup: admin clear-change-data + clear-log POST 200; GET verify log `[]`, change-data `{}`.
