# Lion aura (Power of the Wilds) penalizes the bearer's ALLIES — no enemy gate on the attacker axis

## Summary
The Lion stance from Power of the Wilds (Path of the Wild Heart lv14, 2024) gives Disadvantage to **every** creature within 5 ft of the bearer except the bearer itself and the attack's own target — including the bearer's party allies. RAW (and the app's own modal copy) restrict the aura to "**your enemies**". The sibling Wolf aura got a target-side hostility gate in the 2026-11-03 prose-axis rewrite (`targetIsEnemyOfBearer`, legacy party-by-type split); Lion's attacker axis never got the symmetric gate. Practical blast radius: any lv14 Wild Heart barbarian raging in melee gives their own flank-mates disadvantage on every attack made next to them.

## Steps to reproduce
1. In `test-campaign`, open the Maps view and activate "Battle Arena". Open it and place character tokens close together via the Items panel → CHARACTERS drag-drop: `DraconicDragon` at (2,8), `EvasiveFighter` at (1,8) (1 cell = 5 ft apart), `FeyRanger` at (9,8) (already placed).
2. In `DraconicDragon`'s sheet (lv20 Barbarian), temporarily set subclass to Path of the Wild Heart via Edit wizard → step "6 Subclass / Major" → select → Save (restore to Berserker afterwards).
3. On the sheet's Special Actions, click **Rage** (stamp `{name:'Rage', effect:'stance'}` appears in change-data `DraconicDragon.activeBuffs`), then click the **Power of the Wilds:** row → chooser modal → select **Lion** → "Activate Power of the Wilds". Buff stamped: `{name:'Power of the Wilds', effect:'power_of_wilds_option', optionName:'Lion', range:'5 ft', duration:'while_raging'}`.
4. Arm EvasiveFighter → FeyRanger: POST `/api/campaigns/test-campaign/combatSummary` `{value: …creatures[?name==='EvasiveFighter'].targetName='FeyRanger'…}` (both are type `player` party members; ElderPaladin also standing adjacent to FeyRanger at (8,8) so the save-prompt lane is not involved; targetEffects change-data key absent = zero te contamination).
5. On EvasiveFighter's sheet, roll the **Shortbow +7** weapon cell.
6. Check the campaign log tail.

## Expected behavior
RAW 2024 Power of the Wilds – Lion: "**any of your enemies** within 5 feet of you have Disadvantage on attack rolls against targets other than you…". EvasiveFighter is a party ally of the bearer (type `player`, no explicit ally list on the bearer) → the attack should log `mode:"normal"`.

## Actual behavior
The attack logs `mode:"disadvantage"` and the roll popup shows "d20 11, 19 → 11" (lower of two) + a "Disadv (conditions)" chip. Machine truth: log entry `{type:'roll', characterName:'EvasiveFighter', targetName:'FeyRanger', mode:'disadvantage'}`. Control face in the same session (same buff, same positions, only the target axis changed): re-arm target = the **bearer** DraconicDragon → roll logs `mode` normal ("d20 12 +7", single die, no Disadv chip) — so the lane is live and conditional, it simply never consults attacker hostility.

## Likely location
`src/services/combat/auras/lionAuraUtils.js` — confident. `bearerSupports()` (line 9-11) returns TRUE for every attacker when the bearer has no EDITED ally list, and no hostile-by-type split exists anywhere in the file (full file read, 56 lines). Call sites `src/services/automation/contextBuilder-map.js:186-192` and `contextBuilder-sync.js:392` feed the rolling attacker directly with no pre-filter. Contrast the twin `src/services/combat/auras/wolfAuraUtils.js:24-27` which implements exactly the missing doctrine (`targetIsEnemyOfBearer`: unedited → `!partyNames.has(name)`; edited → off-list). Also visible to users: the CombatStanceModal copy itself says "Enemies within 5 ft…" while the engine applies it to allies too — app self-contradiction.

## Suggested fix
Mirror the wolf split on the ATTACKER axis in `lionAuraUtils.js`: add `attackerIsEnemyOfBearer(bearerName, attackerName, partyNames)` → `hasExplicitAllyList(bearer) ? !getAllyList(bearer).includes(attacker) : !partyNames.has(attackerName)`, and gate the loop with it. `partyNames` source per lane: map lane = names in `mapData.players[]` (monster/NPC tokens live in `placedItems[]`, so a monster attacker is off the party set and still gets the Disadvantage — same doctrine wolf's comment block documents); gridless lane = the already-computed party set from combat-summary `type === 'player'` entries. Note the existing bearers' edited-list semantics must keep working (an EDITED bearer currently supports listed attackers only — the wolf's split inverts that list for hostility; verify the owner's betrayal ruling direction for Lion before flipping `bearerSupports`, the wolf rewrite is the precedent). Secondary RAW axis (already flagged in the code comment, lionAuraUtils.js:35-37): the "…or another Barbarian who has this option active" target exemption remains unbuilt — fix in the same pass if cheap. Add unit faces to `lionAuraUtils.test.js` (ally attacker unedited bearer → false; monster attacker → true; edited bearer w/ attacker on list → per ruling) and update `contextBuilder-sync.wolf-aura.test.js`-style integration.

## Severity
Broken feature — a live rules engine applies the wrong advantage mode on every attack made adjacent to a raging lv14 Wild Heart barbarian by their own allies; wrong dice directly corrupt combat outcomes. Reachable in ordinary play (melee party clustering is the default formation).
