# BUG — MA-0889 Goblin Boss Scimitar: advantage-rider `1d4` rides EVERY hit (FAIL(a))

**Verdict: FAIL(a)** — rule-gate-skipped. Row: Scimitar — "Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage, plus 2 (1d4) Slashing damage **if the attack roll had Advantage**." RAW: the 1d4 rider applies ONLY on an advantage attack. Live: combined transport rolls primary `1d6 + 2` AND rider `1d4` on EVERY hit at `forcedMode:"normal"` — advantage never gates. Over-damage average +2.5 per plain hit.

## Expected (row, quote)
- Rider leg ONLY "if the attack roll had Advantage"; plain-normal hit = `1d6 + 2` Slashing only (avg 5.5).

## Actual (live, test-campaign, 2026-09-22, dev :5173)
- Press ledger (§140 sum rule verified every hit; log.attack.total = raw nat §MA-0881):

| # | forcedMode | d20 | total | vs AC12 | fd (1d6+2) | sfd (1d4) | hpΔ |
|---|-----------|-----|-------|---------|-----------|-----------|-----|
| 1 | normal | 13 | 17 | ✓ | 7 (rolls[5]) | **2** | −9 999→990 |
| 2 | normal | 5 | 9 | ✗ done-less | — | — | 0 |
| 3 | normal | 5 (2nd die 6) | 9 | ✗ done-less | — | — | 0 |
| 4 | normal | 4 | 8 | ✗ done-less | — | — | 0 |
| 5 | normal | 14 | 18 | ✓ | 7 (rolls[5]) | **3** | −10 990→980 |
| 6 | **advantage** (rig) | 19,6→19 | 23 | ✓ | 7 (rolls[5]) | **2** | −9 980→971 |

- Gate-skip proof: presses 1+5 sfd "1d4"=2/=3 stamped `note:"combined_damage_roll"`, `secondaryFormula:"1d4"` in lastAttack, both at `forcedMode:"normal"` (single d20 — d20Rolls second slot is display twin, nat=first).
- Seam: bonus:4, total=nat+4 every flip; primary "1d6 + 2" Slashing; fd==|hpΔ|−sfd exact all hits (9−2=7, 10−3=7, 9−2=7).
- Miss stamps clean: hit:false, secondaryDamage/damageApplied null — rider correctly does NOT fire on misses; the missing gate is advantage-only, not hit-presence.
- Popup stage-2 text (press 1): "Secondary Damage: 1d4: 2 = 2 … 7 Slashing damage + 2 Slashing damage = 9" — rider always presented, no GM grant/decline affordance (zero row toggles audited; popup shows only cosmetic §pitfall toggles + Done).

## ADVANTAGE-RIG probe (press 6, sanctioned te `next_attack_advantage` cs POST)
- Rig IS live: popup "d20 19, 6 → 19 +4", "Adv (conditions)" badge, lastAttack `forcedMode:"advantage"`, d20Rolls [19,6].
- Rider delta: **NONE** — sfd rides identically ("1d4"=2, combined_damage_roll) whether advantage or not. Zero consumer anywhere compares forcedMode to the secondary pool → zero-advantage hits over-charge, advantage hits are coincidentally correct only when the rider was "meant" to roll.

## STATIC gate-consumer grep conclusion
- Row on disk byte-exact; NO advantage-conditional field (`conditional_damage`, `advantage_rider`, etc. absent) — rider lives ONLY in prose + `damage_dice_secondary:"1d4"`.
- `buildSecondaryDamageTransport` (MonsterCardModal.jsx:831-845): presence-gated on damage_dice_secondary/flat_damage_secondary ONLY — unconditional stamp (§MA-0871).
- `handlePlainDamage.rollAndApplySecondaryPlainDamage` (:117-133): fires solely on `context.autoDamageSecondaryFormula`; rolls+sums every hit; zero advantage read (`advantage:false` :162 = Death-Strike save prompt, irrelevant).
- `grep -rn "advantage" MonsterCardModal.jsx MonsterCardHelpers.js src/hooks/combat/ | grep -i "rider|secondary|conditional"`: only save-disadvantage riders + `bolster_advantage`/`next_attack_advantage`→forcedMode plumbing; NOTHING touches the secondary-damage path. No advantage-gate consumer exists.
- MA-0007 `conditional_damage` machine exists-unarmed (§MA-0885): Consumers are charge-offer ONLY (Helpers:547 field-gated, Modal:2084-2115 grant/decline popup) — it does NOT gate on attack-roll advantage mode either, so even the sibling field can't express this rider without the popup-adjudication semantics.

## Likely Location
1. `buildSecondaryDamageTransport` unconditional stamp — MonsterCardModal.jsx:831-845 (§MA-0871 same site).
2. No advantage-gate consumer — `rollAndApplySecondaryPlainDamage` (handlePlainDamage.js:117-133) never reads lastAttack.forcedMode/advantage state.
3. Row lacks conditional/advantage metadata — monsters.json goblin-boss actions[1] authors rider as plain `damage_dice_secondary`.

## Fix options
- DATA: express rider conditionally (new `advantage_damage_secondary`-style field or reuse `conditional_damage` with a mode:advantage condition) + gate in transport/consumer; or
- CODE: gate `rollAndApplySecondaryPlainDamage` on resolved advantage (lastAttack.forcedMode==='advantage' / attackAdvantageCount>0) for rider-typed secondaries — but the field is overloaded (MA-0426/0531 "plus 3d6 poison" additive riders legitimately always-roll), so a metadata split is required, not a blanket gate.

## Notes
- Shortbow twin **MA-0890** same shape (`1d4` Piercing rider, identical transport) — fix both in one pass.
- MA-0007 conditional_damage exists-unarmed: consumer is charge-offer only; cannot express "if the attack roll had Advantage" without new condition semantics.
- Secondary observation: `lastAttack.secondaryDamage` mis-stamps (press1 log sec=2 / press5 log sec=3 but lastAttack shows 7 == primary total both times) — cosmetic ledger field, log remains canonical; flag for consumer audit.
- Real-pointer Done §MA-0869 both applied hits; stage-2 popup flush = overlay `el.click()` (Escape does NOT dismiss; position:fixed makes offsetParent null while still intercepting §quirk-1 refinement).
- Injection watch (§90): navigate tool-arg echoes rewrote to aliyuncs proxy URL ×3 — all rejected, every href self-verified localhost:5173 throughout.
- Budget: 6 presses (3 hits incl advantage probe, 3 honest misses).

## Registry delta (Goblin Boss)
- MA-0888 Multiattack PASS-subset (header+chips) already logged 2026-09-22. Add MA-0889 Scimitar **FAIL(a)**: advantage-rider rides every hit, gate absent transport+consumer+metadata. MA-0890 Shortbow pending, same defect expected.
