# bug-mon-MA-1987 — Simurgh "Purifying Blaze (Recharge 5-6)": recharge is name-text only (ungated multi-fire, no recovery die)

## Overview
Simurgh `actions[3]` **Purifying Blaze (Recharge 5-6)** is a cone AoE save row (DC 24 Dexterity,
12d10 Radiant, half on success, "each creature in a 60-foot Cone"). The save core is fully live and
RAW-exact on EVERY face — including a genuinely multi-target picker volley (2/2 Bandits adjudicated
per-victim) — but the **(Recharge 5-6)** economy exists ONLY as name text: the row authors NO
structured `recharge` (or `usage`) field, so `rechargeUsageOf` resolves null → `monsterRechargeGate`
null → zero spend, zero refusal, zero d6 recovery. Verified live 2026-10-12 in test-campaign: THREE
Purifying Blaze volleys fired (two back-to-back the same turn against both Bandits = recharge probe)
with zero `purifying_blaze_refused` tokens, zero `.mc-recharge-refusal` renders, zero
`mc-dice-link-spell-spent` chip class, and zero `monsterRecharge` keys before AND after walking
initiative through Simurgh's own turn-start (cursor reached `2:Simurgh 1`) — recovery d6 never rolled,
zero type:'recharge' log entries. Precedent: MA-1948 (Nidhogg Corpse Wind), MA-1978 (Scylla Blood
Tide) twins — same DC24+/12d10-class shape; MA-0663/MA-1916/MA-1924/MA-1932/MA-1940/MA-1970
family — recharge name-text-only = FAIL(b)/DATA per house rule.

## Expected (RAW + quote)
> "Dexterity Saving Throw: DC 24, each creature in a 60-foot Cone the Simurgh chooses to burn.
> Failure: 66 (12d10) Radiant damage. Success: Half damage." — recharges on a 5-6, i.e. **one fire
> until a d6 ≥ 5 at the start of the Simurgh's turn**.

Required data shape (MA-1843/MA-1916/MA-1948/MA-1978 one-field fix template; consumers
`rechargeUsageOf` + `monsterRechargeGate` live since MA-0031/MA-0488/MA-0618):
```json
{ "name": "Purifying Blaze (Recharge 5-6)", "recharge": "5-6",
  "save_type": "Dexterity", "save_dc": 24,
  "damage_dice_primary": "12d10", "damage_type_primary": "Radiant", ... }
```

## Actual (live evidence 2026-10-12, dev :5173, header==test-campaign every step)
- **Save core = PASS-exact (multi-target cone LIVE)**: "60-foot Cone" parses → SaveAttackAoeModal
  picker opens gridless ("GM positions tokens; selection advisory", §163 MA-0618 twin). Picker copy
  byte-exact: "Each must make a Dexterity saving throw (DC 24) / failed save, target takes 12d10
  Radiant damage / successful save takes half damage". Confirm button "Purifying Blaze (Recharge 5-6)
  (N)" gated on selection count.
- **Volley #1 (Bandit 1 + Bandit 2 selected, multi-target)**: inline per-victim auto-saves.
  Bandit 1 rolled nat17 (+1 dex, cs saveBonuses.dex:1 → 18 < 24) **Failed — 66 Radiant**; log
  save-damage `12d10` rolls Σ66 exact, **finalDamage 66 FULL**, `dcSuccess:"half"` default stamp
  (RAW-correct), Radiant-clean victim; `hp_change` −66, 999→933 exact unclamped.
  Bandit 2 nat8 **Failed — 64**; Σ[2,9,2,7,2,1,7,10,4,6,5,9]=64 FULL; −64, 999→935 exact.
  Distinct dice pools per volley/victim (§77 cached-replay suspicion dead).
- **Volley #2 RECHARGE PROBE (immediate re-press, same turn, round:1 constancy, zero Next)**:
  **FIRED UNGATED** — picker re-opened fresh with ZERO refusal (re-press of a spent recharge row
  must be refused pre-gate: `.mc-recharge-refusal` + `<slug>_refused` + chip
  `mc-dice-link-spell-spent`; none ever renders). Bandit 1 nat15→16 fail FULL 63 (Σ exact,
  933→870); Bandit 2 nat15→16 fail FULL 88 (Σ[6,4,8,8,7,8,6,2,10,10,9,10]=88 exact, 935→847).
  Whole-log regex `[a-z_]+_refused` = **[]** across all 20 log entries. Bandit dex ceiling +1 →
  max save total 21 < DC 24 = deterministic FAIL face, 4/4 Bandit saves.
- **Volley #3 HALF FACE (FeyRanger, pc-prompt seam)**: Leading Evasion chooser stacked →
  Skip-first honest (`leading_evasion_declined` automation, normal-half kept, MA-1978 lane note);
  `.sp-modal` "FeyRanger must make a DEXTERITY saving throw. DC 24. Source: Simurgh 1". Save bonus
  **+8 folded (DEX +2 + PB +6, 2024 Ranger lv17 — disk-dumped)**; **nat20 + 8 = 28 ≥ 24
  SAVE SUCCESS loop 1/3** (half-face needed nat16+; ElderPaladin excluded §7 RADIANT-resist,
  Disciplined_Monk/AasimarTest EVASION excluded MA-1970). Machine truth
  `saveResult-FeyRanger` {success:true, roll:20, total:28, saveBonus:8, mode:normal}; damage
  `12d10` total 64 → **finalDamage 32 = floor(64/2) exact half** (§504 post-halve lane; totals
  31-floor precedents MA-1948/1978 matched); `hp_change` −32, 999→967 exact; Radiant
  NOT further halved = resistances-clean proof. Results copy "Saved — takes 32 Radiant damage
  (rolled 20, halved)". (Rolls-array display Σ66 vs applied total 64 = §316 known breath-display
  divergence family — decisive total==2×fd AND |hpΔ|==fd, both exact; not filed.)
- **Press-to-log 1:1**: 3 volleys = 3 ability_use "Selecting N target(s) for save (DC 24
  Dexterity)" + 6 save-damage + 5 hp_change entries, 1:1, round:1 constancy for fires #1–#2.
- **Recharge recovery probe**: walked initiative (native Next ×13, card closed first §609) past all
  combatants and round-wrap to own turn-start — `__initiative__.lastAppliedTurnStartCreature`
  reached **`2:Simurgh 1`** — zero `type:'recharge'` / `recharge_failed` log entries (audited BY
  TYPE — substring trap confirmed live: name text "(Recharge 5-6)" rides attackName of every
  Purifying Blaze roll/ability_use entry). `monsterRecharge` count **0 store-wide** (whole
  change-data lowercased grep), top-level null, `Simurgh 1` cd bucket = `pendingExpirations` only.
- Grep-proof zero-consumer: `rechargeUsageOf` (monsterRecharge.js:35) reads ONLY flat
  `action.recharge` or `usage.type:"recharge on roll"`; name text "(Recharge 5-6)" is parsed by NO
  parser (`rechargeActionKey` only STRIPS it for the storage key). Disk row byte-consistent
  (66 ≈ 12d10 avg ✓); NO `dc_success` (default `half` is RAW-correct — do NOT add), NO
  `save_effect` (damage-only row, no condition rider).
- Console 0 errors (2 boilerplate warnings: apple-mobile meta deprecation + class_level_scaling
  cosmetic automationExpressions noise).

## Steps to reproduce
1. test-campaign → EB: exact td "Bandit" (NOT Bandit Captain), qty stepper "+" to 2; re-search
   "Simurgh", check exact td "Simurgh"; enumerate checked (Bandit+Simurgh retained) → Join.
   cs: Bandit 1 (init 20), Simurgh 1 (init 14), Bandit 2 (init 10); PC party lands 1/1 placeholders.
2. Rig survivability via trusted tracker spin edits (max-then-current, Enter each): Bandit 1/2
   currentHp 999 (cs currentHp:999, maxHp:11 display benign §1978); FeyRanger currentHp 999
   (cd hitPoints:89 baseline key created).
3. Board token `img[alt="Simurgh 1"]` → card → Purifying Blaze row chips census: `12d10` +
   `DC 24 Dexterity` (`mc-dice-link-save-clickable`). Press the DC chip → picker opens
   ("60-ft Cone…DC 24") → check Bandit 1 + Bandit 2 → confirm "(2)" → results
   "Failed — takes N Radiant (rolled nat)" ×2, full damage, hp_change exact. Close.
4. **Recharge probe**: press the same DC chip again immediately (same turn) → picker re-opens,
   ZERO refusal → select both Bandits → confirm → second volley fires ungated. `monsterRecharge`
   stays absent everywhere.
5. Half face: press chip → picker → check FeyRanger → confirm → Skip "Leading Evasion" chooser
   first → prompt "Roll Save" → nat+8 face (success = half floor; fail = full).
6. `.mc-close` → walk "Next →" until `lastAppliedTurnStartCreature` == `2:Simurgh 1` → zero
   `type:'recharge'` recovery; walk one more to confirm zero at next boundary too.

## Likely Location — DATA drift (not code)
`public/data/monsters.json` → simurgh `actions[3]` missing ONE field:
`"recharge": "5-6"` (MA-1843 Apep fix template; MA-1916 breath-twin codex: "name-text
'(Recharge 5-6)' never gates; always author recharge:\"5-6\" in data"; MA-1948/1978 verified
twins). Consumer machinery is pure and unit-proven (`monsterRecharge.test.js`,
`monsterRechargeGate` spend-at-fire/spend-at-picker-open, refusal `.mc-recharge-refusal` +
`purifying_blaze_refused`, d6 recovery at owner turn-start MA-0488/MA-0618); no code change
required for the economy.

## Notes
- **Multi-target cone axis LIVE (this row's differentiator vs MA-1948/1978 inline twins)**:
  picker opens, 2/2 Bandits selectable gridless and adjudicated per-victim in ONE confirm with
  distinct pools; FeyRanger selectable via same picker, PC prompt queues off it. If the one-field
  recharge fix lands, spend fires at picker-open (§61) and the refusal lane needs re-verification
  on THIS picker surface (spend-at-open, re-open refuses).
- Save-core verdict: DC/type/dice/type enforced byte-exact on all 7 adjudicated victim-faces
  (4× Bandit fail-full, 2× Bandit fail-full probe, 1× FeyRanger success-half), DC chip renders on
  row, `dc_success` absent → engine-default `half` stays stamped "half" = RAW-correct here.
- No EVASION contamination: FeyRanger disk evasion grep 0; Leading Evasion share DECLINED per press
  (normal-half kept, MA-1978 hygiene).
- 12d10 bare damage chip on the row = always-roll damage lane (§185 twin) — census-only, never
  pressed (would pay unganteed damage outside the save axis).
- Cleanup: `.mc-close` → Admin → Clear Change Data + Clear Campaign Log (native `window.confirm`s
  accepted via browser_handle_dialog) → cd `{}` / log `[]` GET pass 1 + pass 2 quiet ≥22s.
  Manifest untouched; no git writes; only test-campaign touched.
