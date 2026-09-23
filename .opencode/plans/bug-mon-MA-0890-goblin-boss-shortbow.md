# BUG — MA-0890 Goblin Boss Shortbow: advantage-rider `1d4` rides EVERY hit (FAIL(a))

**Verdict: FAIL(a)** — twin of MA-0889 (Scimitar, FAIL(a) same-day, same chip transport). Row: Shortbow — "Ranged Attack Roll: +4, range 80/320 ft. Hit: 5 (1d6 + 2) Piercing damage, plus 2 (1d4) Piercing damage **if the attack roll had Advantage**." RAW: rider only on advantage attacks. Live: `forcedMode:"normal"` single-d20 hit rolls rider unconditionally. Over-damage avg +2.5 per plain hit.

## Press ledger (test-campaign, 2026-09-22, dev :5173, Bandit 1 AC12 armed via cs.targetName)
| # | forcedMode | d20 | total | vs AC12 | fd (1d6+2) | sfd (1d4) | hpΔ |
|---|-----------|-----|-------|---------|-----------|-----------|-----|
| 1 | normal | 11 | 15 (log raw 11 + bonus 4) | ✓ | 6 (rolls[4]) | **4** | −10 999→989 |

- §140 seam: fd==|hpΔ|−sfd exact (10−4=6); log damage breakdown Piercing 6 + Piercing 4; hp_change −10.
- Rider stamp: `note:"combined_damage_roll"`, `secondaryFormula:"1d4"`, `secondaryDamageType:"Piercing"` at `mode:"normal"` — advantage never consulted (log.attack single d20, no Adv badge; popup "d20 11 +4", Advantage/Disadvantage present as cosmetic affordances only).
- Type from damage entry = Piercing (weaponType cosmetic §MA-0888). One hit, 1 press (≤4 budget).
- Range band "80/320 ft." rendered inert (§MA-0867) — separate note, not this bug.
- Judged from log sec, NOT lastAttack (§MA-0889): cs.lastAttack came back **null** here anyway.

## Gate-absence (same grep as MA-0889, cited)
- Brief path `src/services/rules/combat/handlePlainDamage.js` does not exist; real path `src/hooks/combat/handlers/handlePlainDamage.js`. `grep -c forcedMode` → **0** ✓ (expect 0).
- :118 gate = `context.autoDamageSecondaryFormula` presence ONLY (MA-0889 static: `buildSecondaryDamageTransport` MonsterCardModal.jsx:831-845 presence-gated, unconditional stamp). :162 `advantage:false` = Death-Strike save prompt, irrelevant.
- Disk row byte-exact; NO `conditional_damage`/`advantage_rider` metadata — rider only in prose + `damage_dice_secondary:"1d4"`.

## Fix = same metadata-split as MA-0889
One pass: split rider-type secondaries (advantage-gated) from additive always-roll secondaries (`advantage_damage_secondary`-style field or `conditional_damage` + mode:advantage condition) and gate `rollAndApplySecondaryPlainDamage`/`buildSecondaryDamageTransport` on resolved attack mode. Blanket gate invalid — MA-0426/0531 additive riders legitimately always roll.

## New pitfalls (vs MA-0889)
1. Reload re-join lands on compact Initiative tracker cards — NO action rows; the §116 `:has(> strong:text-is("Shortbow."))` ONE-"+4"-chip anchor renders ONLY in the EB "View details" MonsterCardModal. Select target via own-card select there.
2. `cs.lastAttack` = null post-attack this run (MA-0889 saw it stamped) — log-only judging re-justified (§MA-0889).
3. Persistent aliyuncs-proxy tampered goto echoes in click/navigate tool echoes ×many this session — all rejected; `location.href` DOM self-verified localhost:5173 at every step.

## Clean
admin-clear cd+log 200/200; quiet-recheck 14s: cd0 log0 cs:null lastAttack:null targetEffects:null; single tab; dev 200.

## Registry delta (Goblin Boss)
- MA-0888 Multiattack PASS-subset; MA-0889 Scimitar FAIL(a); **MA-0890 Shortbow FAIL(a)** — twin defect confirmed live; single fix pass covers both.
