# bug-mon-MA-1978 — Scylla "Blood Tide (Recharge 5-6)": recharge is name-text only (ungated multi-fire, no recovery die)

## Overview
Scylla `actions[2]` **Blood Tide (Recharge 5-6)** is a save row (DC 25 Dexterity, 10d10 Piercing,
half on success, "each creature within 30 ft. of her lair mouth"). The save core is fully live and
RAW-exact on every face, but the **(Recharge 5-6)** economy exists ONLY as name text: the row authors
NO structured `recharge` (or `usage`) field, so `rechargeUsageOf` resolves null → `monsterRechargeGate`
null → zero spend, zero refusal, zero d6 recovery. Verified live 2026-10-12 in test-campaign: FIVE
Blood Tide fires in one session (two against Bandit 1 on the same turn, three against ElderPaladin)
with zero `blood_tide_refused` tokens, zero `.mc-recharge-refusal` renders, zero `monsterRecharge`
keys before AND after walking initiative through Scylla's own turn-start (cursor reached `Scylla 1`,
round 2) — recovery d6 never rolled, zero type:'recharge' log entries. Precedent: MA-1948 twin
(Nidhogg Corpse Wind), MA-0663/MA-1916/MA-1924/MA-1932/MA-1940/MA-1970 family — recharge
name-text-only = FAIL(b)/DATA per house rule.

## Expected (RAW + quote)
> "Dexterity Saving Throw: DC 25, each creature within 30 ft. of her lair mouth. Failure: 55 (10d10)
> Piercing damage. Success: Half damage. A creature reduced to 0 Hit Points by this tide is dragged
> into the depths and consumed." — recharges on a 5-6, i.e. **one fire until a d6 ≥ 5 at the top of
> Scylla's turn**.

Required data shape (MA-1843/MA-1916/MA-1948 one-field fix template; consumers `rechargeUsageOf` +
`monsterRechargeGate` live since MA-0031/MA-0488/MA-0618):
```json
{ "name": "Blood Tide (Recharge 5-6)", "recharge": "5-6",
  "save_type": "Dexterity", "save_dc": 25,
  "damage_dice_primary": "10d10", "damage_type_primary": "Piercing", ... }
```

## Actual (live evidence 2026-10-12, dev :5173, header==test-campaign every step)
- **Fire #1** (Bandit 1 cs-stamped 999 via trusted spin fill+Enter, cd-verified): inline single-target
  save, picker NEVER opened ("within 30 ft. of her lair mouth" is NOT a parseable shape token —
  `breathAoeShape` harvests radius/cone/line/zone tokens only, MA-1948 §211 inline degradation
  re-confirmed). Popup "✗ SAVE FAILURE (1 vs DC 25) (d20 1 + 0)". Log: `roll`/save-damage formula
  `10d10` rolls [3,5,6,9,4,8,10,1,2,5] total 53, Piercing, **finalDamage 53 = FULL on fail**,
  `dcSuccess:"half"` default stamp (RAW-correct, do NOT add dc_success); `hp_change` −53,
  999→946 exact unclamped.
- **Fire #2 RECHARGE PROBE** (immediate re-press, same turn, same target): **FIRED UNGATED** —
  fresh 10d10 [1,6,7,2,5,6,4,6,2,8]=47, nat9 fail, finalDamage 47 full, hp 946→899. NO
  `.mc-recharge-refusal`, NO `blood_tide_refused`/`_refused` token anywhere in log, zero spend state.
- **Fires #3–#5** (ElderPaladin, Leading-Evasion share declined via Skip ×3 = RAW-correct normal-half
  handling kept): machine truth `saveResult-ElderPaladin` final {success:true, roll:18, total:26,
  saveBonus:8 (+5 aura), mode:normal}. Honest loops: nat10+8=18 FAIL full 59 (224→165); nat3+8=11
  FAIL full 63 (165→102); **nat18+8=26 SUCCESS loop 3/3 → raw Σ63 → log `total`/`finalDamage`
  31 = floor(63/2) exact half** (§504 post-halve-total lane; MA-1948 floor(62/2)=31 precedent
  matched); `hp_change` −31, 102→71 exact.
- **Recharge state census**: press-to-log 1:1 across ALL 5 fires (5 save-damage entries, 1:1
  hp_change). `monsterRecharge` ABSENT top-level and nested (Scylla 1 cd bucket keys =
  `_lastRollContext`/`lastSaveRoll`/`pendingExpirations` only); whole-cd lowercase substring count
  `monsterrecharge` = 0. Walked initiative "Next →" through round-wrap to cursor `Scylla 1` round 2
  (own turn-start) → zero type:'recharge', zero recharge_failed, zero recovery log. type:'recharge'
  audit-by-type confirmed zero.
- Grep-proof zero-consumer: `rechargeUsageOf` (monsterRecharge.js:35-47) reads ONLY flat
  `action.recharge` or `usage.type:/recharge on roll/i`; all gate call-sites route through it. Name
  text "(Recharge 5-6)" is parsed by NO parser (`rechargeActionKey` only STRIPS it for the storage
  key). Disk row byte-consistent (55 ≈ 10d10 avg ✓); lastAttack stamped
  {attackName:"Blood Tide (Recharge 5-6)", saveDc:25, saveType:"Dexterity"}.
- 0-HP consumed clause: **advisory-only** (§70) — zero_hp_clause consumer exists solely via the
  eyeRay picker lane (saveProcessing.js:1710 reads `context?.eyeRay?.zero_hp_clause`; MA-0374
  family); Blood Tide authors no eyeRays/eyeRay field → parseEyeRays null → clause routes nothing.
  Live proof: whole-log counts consumed:0 dragged:0 depths:0 zero_hp:0 eye_ray:0.
- Console: 0 errors.

## Steps to reproduce
1. test-campaign → EB: exact-filter "Scylla" cb + Bandit cb (exact row, NOT Bandit Captain) → Join
   (PCs auto-join; anchor by name — Scylla 1 init14 this join).
2. Rig Bandit 1 currentHp 999 via trusted fill+Enter on `input[aria-label="Bandit 1 current HP"]`
   (cd.combatSummary GET-verified; max stays 11 DOM-only — benign over-max).
3. Scylla card (`img[alt="Scylla 1"]`) → arm her tracker combobox
   `.creature-card:has(img[alt="Scylla 1"]) [data-testid="target-select"]` = Bandit 1 → press
   row-scoped chip `.mc-overlay .mc-action:has(strong:text-matches("^Blood Tide"))
   .mc-dice-link-save-clickable` → inline fail, full 10d10. Done-per-popup TEXT (`.popup-close-btn`).
4. **Press the same chip again immediately** → fires again ungated (no refusal popup/log token).
5. Re-arm ElderPaladin → press → sp-overlay "Saving Throw Required DC 25 DEX" with
   **Leading Evasion chooser stacked on top** (`sp-overlay--evasion`) → el.click Skip ("leading_evasion_declined"
   logged, normal half kept) → el.click Roll Save (absorbs-first: re-click) → success leg pays exact
   floor(N/2).
6. `.mc-close` → walk initiative "Next →" to `Scylla 1` (round 2, own turn-start) → no `recharge`
   recovery log, `monsterRecharge` never appears in change-data.

## Likely Location — DATA drift (not code)
`public/data/monsters.json` → scylla `actions[2]` missing ONE field: `"recharge": "5-6"`
(MA-1843 fix template; MA-1948 twin verdict: name-text '(Recharge 5-6)' never gates; always author
recharge:"5-6" in data). Consumer machinery is pure and unit-proven (monsterRecharge.test.js,
ma1916/ma1890/ma1898 gate tests); no code change required for the economy.

## Notes
- **Save core status = PASS-exact**: DC 25 DEX enforced on all five faces (popup + save entries
  saveDc:25/saveType:"Dexterity" + lastAttack), full-on-fail unclamped ×4 (53/47/59/63), exact
  floor-half live on success (63→31), Piercing-clean victims, DC chip renders on the row,
  5-fires-same-session ungated proves economy dead, 0 console errors. Recharge economy dead →
  overall **FAIL(b)/DATA** per house rule (MA-1948 precedent shape).
- **AoE secondary axis (documented, same-row, MA-1948 §211 twin)**: "each creature within 30 ft. of
  her lair mouth" prose does NOT open the SaveAttackAoeModal picker ("N-foot-radius" parses;
  "within N ft. of X" prose does not) — inline/single-target degradation is HONEST and NOT part of
  this ticket's one-field fix.
- Half-on-success default (`dc_success` absent → engine `?? 'half'`, MV-20) is RAW-CORRECT here —
  do NOT add `dc_success:"none"`. `dcSuccess:"half"` stamped on every live save entry.
- Consumed-clause advisory-only; inline-degradation honest.
- Cleanup: `.mc-close` → Admin Clear Change Data + Clear Campaign Log (native confirms accepted) →
  cd `{}` / log `[]` pass 1 + two-pass quiet ≥15s GET-verified (log count 0).
