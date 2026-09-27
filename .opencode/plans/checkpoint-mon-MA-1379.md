# MA-1379 Rakshasa Baleful Command — checkpoint

## Row (disk verbatim, public/data/monsters.json actions[2], name "Baleful Command")
- save_dc:18, save_type:"Wisdom", attack_bonus:0 (junk "+0" chip §490), recharge:"5-6"
- damage_dice_primary:"8d6", damage_type_primary:"Psychic"
- range:"" reach:"" — Emanation ONLY in description ⇒ breathAoeShape reads RANGE field only (§181) ⇒ NO picker ⇒ INLINE single-target save degradation (§62/§211/§466)
- save_effect: "The target takes 28 (8d6) Psychic damage and has the Frightened and Incapacitated conditions until the start of the rakshasa's next turn."
- dc_success: ABSENT ⇒ app default 'half' (MonsterCardModal.jsx:1011 `action?.dc_success ?? 'half'`; :1996 same)

## Step-1 static results
- Multi-condition extraction: extractConditionsFromSaveEffect (MonsterCardHelpers.js:341) word-scans whole save_effect against CONDITIONS(:52 incl frightened+incapacitated) ⇒ ['frightened','incapacitated'] BOTH extracted.
- saveProcessing.applyFailedSaveConditions (:1043-1062) loops `for (const cond of saveConditions)` ⇒ BOTH granted, fail-only (`saveSuccess` early-return). No band/margin clause here ⇒ §MA-1351 over-grant axis N/A (both conditions ARE RAW fail-only together).
- RAW adjudication (success leg): 2024 MM printed Baleful Command: failed = 28(8d6)+Frightened+Incapacitated; **success = half damage, no conditions**. Row prose omits the Success clause (data truncation), but engine default-half matches actual RAW ⇒ half-on-success is RAW-correct per §423/§523/§456 ("half-on-silence is app convention; correct when RAW says Success: Half"). Contrast MA-1353/MA-0781: those rows' RAW success = ZERO ⇒ half-leak FAIL(a). Here: PASS for half payment; note truncated prose.
- No 2024 twin file (public/data/2024/monsters.json absent).
- Chips expected (§409/§705 triple-chip): junk "+0" + bare "8d6" auto-damage trap + real "DC 18 Wisdom" — press DC chip ONLY.
- Recharge: flat recharge:"5-6" enforced (§MA-1348/§408); inline empty-range rows still spend recharge at fire (Modal:411-434, §466).

## Scenario plan
- Playwright localhost:5173, test-campaign header verified; EB join Rakshasa + victims Bandit + Bandit Captain (§1339 clobber-watch: verify cs names/AC/HP + monsterIndex after each join).
- Victims HP999 (currentHp, all keys, full cs-store POST; §491 re-arm targetName in same body).
- Inline NPC auto-save reads nested saving_throws abbrev (§211/§212): force-fail Bandit {wis:{modifier:-19}}; success leg flip +19 (dc_success stays half → half damage expected).
- Arm Rakshasa own-card target-select BEFORE chip press (§28/§647 selectOption).
- Press "DC 18 Wisdom" chip. FAIL leg: full 8d6 Psychic + frightened+incapacitated both w/ source meta + duration note.
- SUCCESS leg: zero conditions expected, half damage paid (RAW-correct ruling above).
- Recharge: same-round refire refused (.mc-recharge-refusal + baleful_command_refused), walk to Rakshasa turn-start → d6 recovery → respend (§MA-1348 pattern).
- Admin-clear log+change-data after; registry update verifiedRow3.

## Status — VERIFIED: PASS-subset (2026-09-26)
- [x] step 1 static
- [x] step 2 scenario (Rakshasa 1 idx0 + Bandit 1 + Bandit Captain 1, HP999, wis ∓19 nested stamps, armed)
- [x] step 3 FAIL full 31 / SUCCESS half 13=floor(26/2) zero-cond / refuse×2 + recovery d6:5 + respend
- [x] step 4 clause ledger exact; admin-cleared log:[] cd:{}; registry verifiedRow3 appended (parsed ok)

RAW-success adjudication: half-on-success is RAW-correct (2024 MM success=half+no conds) per §423/§523 — NOT MA-1353 class.
PASS-subset gaps (advisory): emanation never parses/only single-target armed (§62/§181), duration GM-enforced no clock (§866), prose omits Success clause (cosmetic truncation).
