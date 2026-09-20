# MA-0610 — Djinni "Create Whirlwind" (monsters.json actions[3], aoe-save DC 17 STR)

**VERDICT: FAIL(a) — half-implemented.** Initial save + Restrained lands as a single-target
instant-damage approximation. The ROW's core — the recurring mechanic cluster (cylinder zone,
point picker, start-of-turn recurring 6d6, end-of-turn repeat save, concentration anchor,
20-ft/turn movement, once-per-turn latch, no-damage-on-success) — is inert or leaks damage
RAW-inverse. No picker ever opens (cylinder hard-excluded), no zone object exists anywhere,
and both recurring legs have zero consumers (grep + live 2-round zero-delta probe).

## Disk row (public/data/monsters.json, Djinni.actions[3]) — verbatim keys
- `name: "Create Whirlwind"`, `save_dc: 17`, `save_type: "Strength"`
- `range: "120 feet"`, `range_save: "20-foot-radius, 60-foot-high Cylinder"` (bare string)
- `save_effect`: "While in the whirlwind, the target has the Restrained condition and moves
  with the whirlwind. At the start of each of its turns, the Restrained target takes 21 (6d6)
  Thunder damage. At the end of each of its turns, the target repeats the save, ending the
  effect on itself on a success."
- `damage_dice_primary: "6d6"`, `damage_type_primary: "Thunder"`
- ABSENT: `automation`, `concentration`, `recurring_damage`, `repeat_save`, `dc_success`,
  structured `zone{}`/AoE dict. Prose-only recurring/repeat/concentration/movement clauses.

## What WORKS (live evidence, test-campaign, Djinni 1 init 18 vs Bandit 1 init 14, HP staged 999)
1. Row renders chips: `.mc-dice-link` "+6d6" + `.mc-dice-link-save.mc-dice-link-save-clickable`
   "DC 17 Strength". Chip is clickable (absorbed-first-click family: 3rd click fired; §133/§138).
2. Save adjudicates: `roll save` victim entry, popup "SAVE FAILURE (8 vs DC 17) (d20 8 + 0)"
   (+ 8-boundary proof: nat 15 fails, nat 18 succeeds; Bandit str +0, MA-0303 inline seam).
3. Restrained lands on fail: change-data `Bandit 1.activeConditions=['restrained']`,
   `activeConditionMeta.restrained.source='Djinni 1'`; red **Restrained badge** on initiative card.
   (Transport: `extractConditionsFromSaveEffect` prose word-parse → `applyFailedSaveConditions`
   inside `applySaveDamage` — saveProcessing.js:1100; §156 consumer live.)
4. Damage logs: `hp_change` → Bandit 1 (23, then 26, then 24 across retries).

## What is INERT / WRONG
1. **No picker — cylinder hard-excluded.** `sphereRadiusFeet` returns null when description
   contains "Cylinder" (MonsterCardModal.jsx:44-48, comment: "Cylinder rows (radius + height
   clause) stay untouched (null)"). No Cone/Line tokens, no `zone.radius_ft` → `breathAoeShape`
   → null → NO SaveAttackAoeModal, no point targeting, no shape text; degrades to
   single-target block save vs armed target (MA-0049 refusal popup if unarmed).
   `range_save` string has ZERO consumers app-wide (grep-zero; §114/§317 precedent).
   Orchestrator hypothesis "radius token parses per MA-0084 sphere precedent" is FALSE —
   MA-0084 spheres parse only because the cylinder guard excludes this exact shape.
2. **Instant 6d6 on fail (RAW deviation).** `damage_dice_primary` rides as auto-damage →
   full 23 applied INSTANTLY on fail. RAW: zero instant damage; damage is start-of-turn
   recurring only; the save gates Restrained.
3. **Half-leak on success (§46/§63 MV-20).** No authored `dc_success` → `?? 'half'` default
   (MonsterCardModal.jsx:154, buildSaveOptions:~800). PROVEN live: SAVE SUCCESS (nat 18 ≥ 17)
   → "9 damage applied to Bandit 1 — HP: 926 → 917". RAW: success pays nothing.
4. **Turn-start recurring damage: ZERO consumers.** `turnStartEffects.js` consumer keys are
   grapple_damage / cloak_of_shadows / inner radiance / infernal wound (MA-0367) /
   resistance_damage_reduction — none keyed to whirlwind or Restrained-in-zone. No whirlwind
   te in `targetEffectDefinitions.js` (`grep -i whirlwind src/` = one unrelated SavantModal
   test string). §87: registry alone never ticks; no explicit consumer exists at all.
   LIVE: initiative gate runtime `__initiative__.lastAppliedTurnStartCreature` walked through
   `1:Bandit 1` (round 1) and `2:Bandit 1` (round 2) turn-start passes — zero damage entries,
   HP flat 976 through the pass.
5. **Turn-end repeat save: ZERO consumers (§70/§156).** No `repeat_save` authored, so the
   MA-0048 arm (saveProcessing.js:455) never engages — and even armed, it routes to
   `trackFrightfulPresence` (FP-specific te), not a generic STR-DC-17 repeat roller. LIVE: two
   turn-end passes (1:Bandit→1:AasimarTest, 2:Bandit→2:AasimarTest) — zero repeat-save rolls,
   Restrained never self-terminates.
6. **Concentration untracked.** cs `Djinni 1.concentration: null` before and after 4 chip
   firings; no duration clock anywhere; Restrained carries no rounds clock (persists until
   manual/long-rest removal — §84 remove_* family gap).
7. **No zone object.** No te_grants, no zone te, no caster-tracking key, no move-up-to-20ft,
   no enters-space/re-enters-space trigger, no "moves with the whirlwind" consumer. The zone
   simply does not exist in runtime state (top-level change-data: no whirlwind key; §122).
8. **Once-per-turn latch absent.** "makes this save only once per turn" — chip fired 4x across
   the session including repeats within the same round, no gate, no refusal.
9. Djinni's own Thunder immunity irrelevant (self-save exempt prose is inert-by-design; djinni
   never targeted).

## Evidence timeline (log + machine truth)
- Join: cs `Djinni 1` (init 18), `Bandit 1` (init 14); baseline log 0 → join noise 4.
- Arm Bandit 1 via djinni initiative-card select (§149) → cs targetName 'Bandit 1'.
- Fire 1 (round 1, off-turn): popup "✗ SAVE FAILURE (8 vs DC 17) (d20 8 + 0) / 6d6:4,6,3,2,2,6
  / 23 damage — HP 999→976"; Restrained + badge applied; log 4→9 (roll dupe + victim roll +
  hp_change + condition).
- Walk: `__initiative__.lastAppliedTurnStartCreature` stamps 1:Bandit 1 … 1:Divine_Cleric …
  (cs activeCreatureName frozen — §100/§110); PC initiatives blank froze walk → filled via
  cs POST (§119 full-store route) + re-select.
- Round 2: gate stamps `2:Djinni 1`, then `2:Bandit 1` (turn-start pass ran → ZERO tick, HP 976),
  then `2:AasimarTest` (Bandit turn-END pass ran → ZERO repeat save, Restrained intact).
- Success-leg probe (round 2, chips fired again — once-per-turn unenforced): nat 6 fail → 26
  instant; nat 15 fail → 24 instant; **nat 18 SUCCESS → 9 half-damage leak (HP 926→917)**.

## Notes
- Cylinder-shape picker note: picker degrades to single-target; if authored as MA-0043/MA-0085
  zone dict (`zone:{radius_ft:20, noun:'whirlwind', ...}`) the Radius picker WOULD open
  (zone branch checked before the cylinder guard) — cylinder token itself is excluded on purpose.
- §30 pre-check: no `.dsp-overlay`/`.sp-modal` ever appeared for this row (verified per fire).
- Absorbed-first-click on save chip confirmed (3 clicks to first fire).

## Fix direction (data + engine, orchestrator-owned)
1. DATA (minimum honest): add `dc_success:"none"` (kills success leak per MA-0481 template),
   strip/convert instant damage semantics — recurring-only rows should not carry
   `damage_dice_primary` as an instant save-damage leg unless engine supports recurring.
2. Zone shape: author MA-0043-style `zone` dict (radius_ft 20, noun whirlwind, effect_key
   `whirlwind`) → opens existing zone picker (§378/§385 lane); register `whirlwind` te in
   `targetEffectDefinitions.js` (Restrained + recurring 6d6 + repeat_save descriptors).
3. ENGINE (new consumers required — §87 rule): te-keyed turn-start recurring-damage tick in
   `turnStartEffects.js` (whirlwind consumer, untyped Thunder 6d6, victim Restrained) and a
   generic turn-END repeat-save roller (the §70 zero-consumer family: frightful/roar/sleep/
   weakening-breath all share this gap; MA-0367 turn-start seam is the template).
4. Concentration anchor on djinni cs + zone dismiss + 20ft move + once-per-turn latch: all
   beyond current engine seams; GM-enforced advisory minimum, logged.
