# BUG — MA-0897 Goblin Warrior Scimitar: advantage-rider `1d4` rides EVERY hit (FAIL(a))

**Verdict: FAIL(a)** — exact twin of MA-0889 (Goblin Boss Scimitar, FAIL(a), same defect family), re-confirmed live 2026-09-23. Row: Scimitar — "Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage, plus 2 (1d4) Slashing damage **if the attack roll had Advantage**." RAW: rider ONLY on advantage attacks. Live: combined transport rolls rider on every normal-mode hit; advantage never gates. Over-damage avg +2.5 per plain hit.

## Expected (row, quote)
- Rider leg ONLY "if the attack roll had Advantage"; plain-normal hit = `1d6 + 2` Slashing only (avg 5.5).

## Actual (live, test-campaign, dev :5173, vs Bandit 1 AC12 four-key HP 999)
Press ledger (§140 sum verified; log.attack.total = raw nat §MA-0881):

| # | mode | d20 | total | vs AC12 | fd (1d6 + 2) | sfd (1d4) | hpΔ |
|---|------|-----|-------|---------|--------------|-----------|-----|
| 1 | normal | 3 | 7 | ✗ done-less | — | — | 0 |
| 2 | normal | 9 | 13 | ✓ real-pointer Done | 7 (rolls[5]) | **2** | −9 999→990 |

- Gate-skip proof (one-hit twin evidence suffices): press 2 at `mode:"normal"` (single d20; second slot display-twin §92) carries damage entry `formula:"1d6 + 2" fd:7` + `secondaryFinalDamage:2` `secondaryFormula:"1d4"` `secondaryDamageType:"Slashing"` `note:"combined_damage_roll"`. Advantage was NEVER granted — rider rides anyway.
- fd+sfd = 7+2 = 9 == |hp_change| exact §140; stage-2 popup "Secondary Damage: 1d4: 2 = 2 … 7 + 2 = 9"; zero grant/decline affordance (whole-card role=switch/radiogroup/tablist/checkbox audit = 0).
- Miss stamps clean (press 1): hit:false, no damage entry, rider absent — missing gate is advantage-only, not hit-presence (§MA-0889 identical). No AC-rig needed (natural miss obtained press 1).
- `cs.lastAttack` = null post-attack — §MA-0890 pitfall re-confirmed; log canonical.
- Disk byte-exact vs manifest row + monsters.json goblin-warrior actions[0]: attack_bonus 4, damage_dice_primary "1d6 + 2" Slashing, damage_dice_secondary "1d4" Slashing, reach "5 ft."; NO advantage/conditional field — rider lives only in prose + `damage_dice_secondary` (same authoring shape as goblin-boss actions[1]).

## Root cause (cited twin MA-0889 / §MA-0871, re-verified byte-current today)
- `buildSecondaryDamageTransport` (MonsterCardModal.jsx:831-845): presence-gated on damage_dice_secondary/flat_damage_secondary ONLY — unconditional autoDamageSecondaryFormula stamp.
- `rollAndApplySecondaryPlainDamage` (src/hooks/combat/handlers/handlePlainDamage.js:117-133): fires solely on `context.autoDamageSecondaryFormula` presence; rolls+sums every hit; zero `forcedMode`/advantage read (`advantage:false` :162 = Death-Strike save prompt, irrelevant).
- Zero advantage-gate consumer app-wide (§MA-0889 grep ledger); MA-0007 conditional_damage consumer is charge-offer only, cannot express "if the attack roll had Advantage" (§MA-0889). Zero-delta advantage-direction proof: MA-0889 te `next_attack_advantage` rig — rider rides identically at forcedMode advantage and normal.

## Fix = same metadata-split as MA-0889 (single pass covers goblin-boss + goblin-warrior)
- DATA: express rider conditionally (`advantage_damage_secondary`-style field or `conditional_damage` with mode:advantage semantics) + gate transport/consumer; blanket gate NOT allowed — field is overloaded with legitimately always-roll additive riders (MA-0426/0531 family).

## Notes
- Twin pending row: MA-0898 Goblin Warrior Shortbow (`1d4` Piercing rider, identical shape) — same defect expected, same fix pass.
- EB pitfall: filter "Goblin Warrior" yields collision row "Hobgoblin Warrior" (and registry carries sibling key "Gnoll Warrior") — exact td-text anchoring mandatory (§124/§167 re-confirmed).
- Cleanup: admin-clear cd+log 200/200 direct-fetch no-dialog (§255), quiet-recheck 15s cd0 log0 cs:null; single tab; dev :5173 up 200.
- Injection watch §90: navigate tool-arg echoes self-verified localhost:5173 throughout; no off-site lands.
