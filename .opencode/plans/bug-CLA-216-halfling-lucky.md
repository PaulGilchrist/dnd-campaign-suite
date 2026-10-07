# bug-CLA-216 — Halfling Lucky (2024 racial trait, race:Halfling)

## Canonical (app) — public/data/2024/races.json "Halfling" > traits > "Lucky"
> "When you roll a 1 on the d20 of a D20 Test, you can reroll the die, and you must use the new roll."
automation: `{ type: auto_reroll, target: d20, condition: roll_equals_1, effect: reroll, casting_time: passive }`

Manifest row wording is byte-identical to app canonical. (The 2014 attack-only reading does NOT apply here — 2024 PHB Lucky covers ALL D20 Tests.) Verdict adjudicated against app canonical.

## Verdict: PASS-subset
Core native-reroll mechanic is EXACT and LIVE on **ability checks, skill checks, and saving throws** (2 of the 3 D20-Test categories). Attack rolls are STRUCTURALLY INERT — an evidenced lane gap, not a wrong trigger.

## Evidenced PASS (live E2E, localhost, host=DivinationWizard swapped to Halfling)
Host on disk set to `race.Halfling` via Edit-wizard step-3 (2024 Halfling subtypes = [] → no subrace/lineage). Sheet header "Halfling, Wizard (illusionist), Level 20"; Lucky trait row renders verbatim.

Both-dice ledgers (all `ability_use`, abilityName "Lucky (Halfling)"):
- `DivinationWizard used Lucky (Halfling trait): rerolled natural 1 on Arcana skill → 20`
- `DivinationWizard used Lucky (Halfling trait): rerolled natural 1 on Intelligence check → 10`
- `DivinationWizard used Lucky (Halfling trait): rerolled natural 1 on Intelligence save → 19`

Roll entry (Arcana): `rolls:[1,7] total:20 isNatural1:false isNatural20:true` — nat-1 replaced by new roll (must-use).
Live popup (save): `d20 19 (Lucky reroll) +11` + banner `Lucky (Halfling): rerolled natural 1 → 19`. Dice span `X (Lucky reroll)` = DiceRollResult.jsx:121,1076.

Consumer chain proven live:
- checks → `CharAbilities.jsx:113` (autoRerollForChecks) → `d20RollComputation.js:214` reroll natural 1
- saves → `CharAbilities.jsx:165` + `handlePlayerSaveDamage.js:28-35` (Lucky flag never disabled by Fanatical Focus/Indomitable exhaustion gates)
- `useLoggedDiceRollAttack.js:68` logLuckyReroll writes both dice values.

Controls:
- **Non-holder** HexWarlock (Human) WIS save nat 1 → `rolls:[1,5] total:1, [1] total:8, isNatural1:true`, ZERO Lucky entries, nat 1 stands. ✓ gated correct.
- **Holder other-rolls** — ~55 DivinationWizard rolls: Lucky fires ONLY on the 3 nat-1s (unlimited/passive, unlimited per rules.json). ✓

Must-use: a d20 reroll of a nat 1 is always ≥ 1 (die floor), so a numerically-worse reroll is impossible; the new roll ALWAYS stands (effectiveD20Roll replaced, isNatural1 cleared). Must-use rule fully satisfied by construction + observed (1→20, 1→10, 1→19 all adopted).

## Evidenced GAP — attack rolls inert (PASS-subset reason)
`conditionEffectsInternal.js:338` — for `target:'d20'` racial auto_reroll, `autoRerollForAttack` is **intentionally NOT set** (comment: "attack context has no auto-reroll consumer — see bug-cla-216 notes"). `d20RollComputation.js:214` only rerolls when `context.autoReroll && autoRerollCondition==='roll_equals_1'`, and that flag is set for checks/saves but NOT attack rolls.

Live: DivinationWizard Unarmed Strike (Halfling) nat 1 vs EB Bandit 1 (AC 12) →
popup `d20 1 +5 (+5 to hit) CRITICAL MISS! ✗ MISS (6 vs AC 12)` (screenshot cla216-attack-nat1-no-lucky.png),
`lastAttack.d20:1 total:6 hit:false` STANDS, ZERO Lucky ability_use/log. Attack roll = a D20 Test per 2024 rules → should reroll; never offered/never rerolled.

**Fix locus:** arm `autoRerollForAttack` for `target:'d20'` racial reroll AND add an attack-context consumer in `resolveAttackRoll` (d20RollComputation.js:214) that fires the Lucky reroll on `effectiveD20Roll===1` at the attack seam (guarded to `roll_equals_1` so it does not collide with the manual Boon-of-Combat-Prowess / convert_miss_to_hit button on :458/:472).

## Cleanup / final config
- Host **DivinationWizard reverted to Human** via Edit-wizard (disk race.Halfling→Human; skills `[Arcana,History,Sleight of Hand]`, languages `[Common]` — unchanged). Registry race kept = **Human**.
- EB Bandit 1 removed (native confirm accepted).
- Admin cleared change-data (200) + log (200); post-clear log=0, change-data=empty.
- Dev server up (localhost:5173 → 200).
