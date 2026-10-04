# BUG WM-001 — Cleave once-per-turn not enforced; offer re-fires on every hit; picker ignores 5-ft adjacency; modal un-dismissable

- **Automation:** WM-001 "Cleave" — weaponMastery (2024), manifest class Barbarian
- **Host:** DraconicDragon (Barbarian lv20, 2024, Path of the World Tree), Greataxe equipped (mastery tag `Cleave` from equipment.json row; kind chosen via Weapon Mastery chooser → runtime `_Weapon_Kind_Mastery_chosenWeapons=['Greataxe']`)
- **Campaign:** test-campaign, ver 2026-10-03, prod bundle (`assets/index-DS6gi1Ds.js`) served on :80
- **Verdict:** **FAIL** (canonical "once per turn" violated; repeats unlimited within one turn)

## Canonical text (public/data/2024/weapon-mastery.json, mastery "Cleave")
> "If you hit a creature with a melee attack roll using this weapon, you can make a melee attack roll with the weapon against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon's damage, but don't add your ability modifier to that damage unless that modifier is negative. You can make this extra attack only once per turn."

## Live evidence (round 1, DD's turn)
1. **Offer-on-hit works:** HIT (15 vs AC 12, then 20/27 vs AC 19) → modal `Cleave — Choose Second Target`, body: "On a hit, the second creature takes weapon damage (no ability modifier to damage unless negative). Once per turn."
2. **2nd-hit damage without modifier (exact):** primary log `formula: "1d12+7", modifier: 7` vs cleave log `name: "Greataxe (Cleave)", formula: "1d12", modifier: 0, total: 10` (and second cleave `total: 11`), + `ability_use` "DraconicDragon used Cleave on Greataxe against Bandit 1". STR +7 (Primal Champion) correctly omitted.
3. **ONCE-PER-TURN FAIL:** within the SAME DD turn, cleave resolved twice: `1d12 mod 0 total 10` **then** `1d12 mod 0 total 11`. Furthermore the modal **re-offered on every subsequent hit of the same turn** (2nd and 3rd hits both popped a fresh chooser). A miss (MISS 15 vs AC 19) correctly produced NO offer (hit-gate works; latch gate missing).
4. **Picker adjacency unmodeled (no-map fallback):** candidate list = "15 available" = ALL other combatants — allies, players, even the already-dead Bandit 1 (0% HP listed as target). No 5-ft / reach filtering anywhere without a map.
5. **Stuck modal UI bug:** after executing the extra attack, the cleave modal stays open (Attack clickable again → repeat damage). `Skip` after a repeat does nothing — pipeline lane `onSkip: () => {}` (attackRollPostDamage.js:484) and `handleCleaveTargetSelected` never clears `modalState.secondaryTargetModal`. Only reload clears it.
6. **Kind-gate prerequisite (not a fail, config):** first-ever Cleave hit produced NO offer because Barbarian `weapon_kind_mastery` gate (`collectWeaponMastery`, automationPassives.js:132) nulls base mastery until `_Weapon_Kind_Mastery_chosenWeapons` includes "Greataxe" (set via sheet Special Actions → Weapon Mastery chooser). Equipment-row mastery tag "Cleave" was already displayed in Actions table while automation silently refused — confusing UX.
7. **Minor:** cleave's own attack roll is never logged (internal `rollCleaveAttack` d20, no roll entry/popup; only damage + ability_use logged). Negative-modifier clause unverifiable live (host mod positive; regex `/\+\s*\d+/g` strip only removes "+N" terms).

## Code pointers
- `src/services/combat/steps/attackRollPostDamage.js:450` `buildCleaveMasteryStep` — no `_Cleave_UsedRound` check (checkOncePerTurn never called here); `collectCleaveSecondTargets` fallback = all creatures; `handleCleaveTargetSelected` doesn't mark once-per-turn nor close modal.
- `src/services/automation/handlers/combat/weaponMasteryHandler.js:183-214` — the `_Cleave_UsedRound` latch exists ONLY in `applyMasteryEffect` (modal mastery lane), which the sheet attack pipeline never invokes for Cleave.
- Latch clear per round: `src/components/initiative/Initiative.jsx:62`.

## Fix sketch
In `buildCleaveMasteryStep`: `checkOncePerTurn('Cleave','_Cleave_UsedRound', ...)` before offering; in `handleCleaveTargetSelected`: `markOncePerTurn(...)` + clear the secondary-target modal (set null) on Attack and on Skip.
