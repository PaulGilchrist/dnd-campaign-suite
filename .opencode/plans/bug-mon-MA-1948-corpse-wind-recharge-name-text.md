# bug-mon-MA-1948 — Nidhogg "Corpse Wind (Recharge 5-6)": recharge is name-text only (ungated multi-fire, no recovery die)

## Overview
Nidhogg `actions[3]` **Corpse Wind (Recharge 5-6)** is a save row (DC 24 Constitution, 12d10
Necrotic, half on success, "each creature within 60 ft"). The save core is fully live and RAW-exact,
but the **(Recharge 5-6)** economy exists ONLY as name text: the row authors NO structured
`recharge` (or `usage`) field, so `rechargeUsageOf` resolves null → `monsterRechargeGate` null →
zero spend, zero refusal, zero d6 recovery. Verified live 2026-10-11 in test-campaign: three Corpse
Wind fires in one session (two against Bandit 1 on the same turn, one against ElderPaladin) with
zero `corpse_wind_refused` tokens, zero popup refusals, and zero `monsterRecharge` keys after
walking initiative past Nidhogg's own turn-start. Precedent: MA-0663 (dust mephit), MA-1916
(Godzilla), MA-1924/MA-1932/MA-1940 family — recharge name-text-only = FAIL per house rule.

## Expected (RAW + quote)
> "Constitution Saving Throw: DC 24, each creature within 60 ft. Failure: 66 (12d10) Necrotic
> damage. Success: Half damage." — recharges on a 5-6, i.e. **one fire until a d6 ≥ 5 at the top
> of Nidhogg's turn**.

Required data shape (MA-1843/MA-1916 one-field fix template, consumers `rechargeUsageOf` +
`monsterRechargeGate` live since MA-0031/MA-0488/MA-0618):
```json
{ "name": "Corpse Wind (Recharge 5-6)", "recharge": "5-6",
  "save_type": "Constitution", "save_dc": 24,
  "damage_dice_primary": "12d10", "damage_type_primary": "Necrotic", ... }
```

## Actual (live evidence 2026-10-11)
- **Fire #1** (target Bandit 1, cs-stamped 999/999): inline single-target save (picker never
  opened — see Notes). Popup "✗ SAVE FAILURE (4 vs DC 24) (d20 4 + 0)". Log: `roll` formula
  `12d10` rolls [9,10,10,4,5,7,5,4,10,2,2,3] total 71, Necrotic, **finalDamage 71 = FULL on
  fail**, necrotic-clean (resistances []); `hp_change` −71, 999→928 exact unclamped.
- **Fire #2 RECHARGE PROBE** (immediate re-press, same turn, same target): **FIRED UNGATED** —
  fresh 12d10 [3,9,2,3,8,3,2,9,4,4,2,3]=52, nat 1 fail, finalDamage 52 full, hp 928→876.
  NO `.mc-recharge-refusal`, NO `<slug>_refused` token anywhere in the log, ZERO spend state.
- **Fire #3** (target ElderPaladin via PC prompt): DC 24 CON, "Half damage on successful save"
  copy (default half — RAW-CORRECT this row). `saveResult-ElderPaladin` machine truth
  `{success:true, roll:17, total:27, saveBonus:10 (+5 aura)}`. Raw Σrolls 62 → log `total`/
  `finalDamage` **31 = floor(62/2) exact half** (§504 post-halve-total lane); `hp_change`
  −31, 224→193 exact.
- **Recharge state census**: `monsterRecharge` ABSENT top-level and nested
  (`Nidhogg 1.monsterRecharge` null) before AND after walking initiative through Nidhogg's own
  turn-start (round wrap, cursor reached `Nidhogg 1`) — recovery d6 NEVER rolled, zero
  `recharge`/`recharge_failed` log entries (only name-text echoes of "(Recharge 5-6)").
- Grep-proof zero-consumer: `rechargeUsageOf` (monsterRecharge.js:35-47) reads ONLY flat
  `action.recharge` or `usage.type:/recharge on roll/i`; all gate call-sites
  (MonsterCardModal.jsx:264/465, MonsterCardHelpers.js:3307/3365/3462, MonsterAction.jsx:304/418,
  monsterGrantReaction/monsterSummon/monsterUtilitySpellCast) route through it. Name text "(Recharge
  5-6)" is parsed by NO parser (`rechargeActionKey` only STRIPS it for the storage key).
- Disk row (public/data/monsters.json nidhogg actions[3]): `save_dc:24`, `save_type:"Constitution"`,
  `damage_dice_primary:"12d10"`, `damage_type_primary:"Necrotic"`, description verbatim —
  **no `recharge`, no `usage`, no `dc_success`, no `range`**. Numeric/DC/text byte-consistent
  (66 ≈ 12d10 avg ✓).

## Steps to reproduce
1. test-campaign → EB: check **Bandit** (exact td text, NOT Bandit Captain) + **Nidhogg** → Join
   (full PC party auto-joins; cs: Bandit 1 idx0, Nidhogg 1 idx1 — anchor by name).
2. Full-store POST `/api/campaigns/test-campaign/combatSummary` {value:fullCs} stamp Bandit 1
   currentHp/maxHp 999/999 (only route for NPC cs; unclamped ledger).
3. Nidhogg card → arm own-card `[data-testid="target-select"]` = Bandit 1 → press
   `.mc-dice-link-save-clickable` "DC 24 Constitution" → inline fail, full 12d10. Flush Done.
4. **Press the same DC chip again immediately** → fires again ungated (no refusal popup/log token).
5. Re-arm target ElderPaladin → press chip → .sp-modal "Roll Save" → SAVE SUCCESS → half
   floor(N/2) applied; `saveResult-ElderPaladin` carries machine truth.
6. Walk initiative "Next →" past Nidhogg 1 own turn-start → no `recharge` recovery log,
   `monsterRecharge` key never appears in change-data.

## Likely Location — DATA drift (not code)
`public/data/monsters.json` → nidhogg `actions[3]` missing ONE field:
`"recharge": "5-6"` (MA-1843 Apep fix template; MA-1916 breath-twin template: "name-text
'(Recharge 5-6)' never gates; always author recharge:\"5-6\" in data"). Consumer machinery is pure
and unit-proven (monsterRecharge.test.js, monsterRecharge.ma1916-godzilla-atomic-breath.test.js);
no code change required for the economy.

## Notes
- **Save core status = PASS-exact**: DC 24 CON enforced on every face (popup + `lastAttack`
  {saveDc:24, saveType:"Constitution"}), full-on-fail unclamped twice (71, 52), exact floor-half
  on success (62→31), necrotic-clean victims, DC chip renders on the save row, zero console
  errors. Only the recharge economy is dead → overall FAIL per house rule (MA-1924/1932/1940
  precedent shape).
- **AoE secondary axis (documented, same-row)**: "each creature within 60 ft" prose does NOT open
  the SaveAttackAoeModal picker — `breathAoeShape` (MonsterCardModal.jsx:139-183) harvests only
  Cone/Line tokens, sphere/"N-foot-radius" tokens, zone dicts, emanation RANGE field, Cube — never
  bare "within 60 ft"; no `range` authored → MA-0317-family §211 inline single-target degradation
  (MA-1843 §461 re-confirmed). Multi-target RAW volley is unmodeled; if fixed in the same pass,
  the honest data shape is `range:"60 ft"` + radius token or prose "60-foot Radius" so the picker
  arms — adjudicate separately; NOT part of this ticket's one-field fix.
- Half-on-success default (`dc_success` absent → engine `?? 'half'`, MV-20) is RAW-CORRECT here —
  do NOT add `dc_success:"none"`.
- Cleanup: all overlays closed → Admin clear change-data + log → cd `{}` / log `[]` quiet.
