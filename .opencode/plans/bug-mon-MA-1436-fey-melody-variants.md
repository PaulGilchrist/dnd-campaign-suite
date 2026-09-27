# BUG MA-1436 — Satyr Revelmaster · Fey Melody (FAIL(a)/DATA, choose-one variant structurally unmodeled)

**Verdict: FAIL(a)/DATA.** No variant chooser exists for Fey Melody; the app silently collapses GM-choice into one forced resolution: unconditional 2d6+3 Psychic on every fail, half-damage leak on every success (MV-20 default), and a 3-condition spray on every fail (MA-1387 fingerprint). Recharge 4-6 economy is the ONE axis fully live (recorded honestly). PASS is impossible: the chooser never appears live.

## Row (disk truth, public/data/monsters.json satyr-revelmaster actions[2])
`attack_bonus:0` `save_dc:14` `save_type:"Wisdom"` `recharge:"4-6"` (AUTHORED) `damage_dice_primary:"2d6 + 3"` Psychic `range:""` (emanation PROSE-ONLY) **no `dc_success`** → `action.dc_success ?? 'half'` (MonsterCardModal.jsx:255/:1032). Choose-one clause "Charming." vs "Frightening." lives only in save_effect/description prose.

## Live evidence — 8 save faces, test-campaign (2026-09-27), Bandit 1 + Knight 1 (both WIS +0)

| # | ts(ms) | victim | nat | DC14 result | app paid | conds granted | RAW Charming expect | RAW Frightening expect | defect |
|---|--------|--------|-----|-------------|----------|---------------|--------------------|----------------------|--------|
| 1 | …120030 | Knight 1 | 5 | FAIL | 11 Psychic | Charmed+Frightened+Incapacitated | 0 dmg, Charmed(+Incap) | 11 dmg, Frightened only | forced dmg + spray |
| 2 | …120031 | Bandit 1 | 18 | SAVE | **4 (half)** | none | **0 dmg** | half, none | half-leak |
| 3 | …264760 | Bandit 1 | 18 | SAVE | **6 (half)** | none | **0** | half | half-leak |
| 4 | …264760 | Knight 1 | 16 | SAVE | **4 (half)** | none | **0** | half | half-leak |
| 5 | …389712 | Bandit 1 | 14 | SAVE | **5 (half)** | none | **0** | half | half-leak |
| 6 | …389712 | Knight 1 | 9 | FAIL | 15 Psychic | Charmed+Frightened+Incapacitated | 0, Charmed(+Incap) | 15, Frightened | forced dmg + spray |
| 7 | …466311 | Bandit 1 | 12 | FAIL | 11 Psychic | Charmed+Frightened+Incapacitated | 0, Charmed(+Incap) | 11, Frightened | forced dmg + spray |
| 8 | …466312 | Knight 1 | 15 | SAVE | **5 (half)** | none | **0** | half | half-leak |

- **DC enforcement: clean** 8/8 (nat 5/9/12 fail <14; nat 14/15/16/18 save; `saveBonus:0` matches cs wis:0). Every entry stamps `dcSuccess:"half"` — the unauthored default.
- **Spray fingerprint CONFIRMED live ×3:** `condition applied "Charmed, Frightened, Incapacitated"` on every fail (log sourceAbility:Fey Melody) — `extractConditionsFromSaveEffect` (MonsterCardHelpers.js:342) whole-string `\bword\b` scan; all three canonical in CONDITIONS (:52). Charming-branch and Frightening-branch conditions granted simultaneously regardless of intended variant (§MA-1387 lineage).
- **Half-leak CONFIRMED ×5:** MA-1433/§914 twin — every success pays floor(half(2d6+3)).
- **Compounding absurdity:** app pays damage on fails, then engine house-rule (applyDamage took-damage-clears, §181/§108) strips Charmed+Frightened same-pass → even the Charming read lands ZERO lasting condition; only the off-variant **Incapacitated persists** (change-data `Knight 1.activeConditions:["incapacitated","frightened"]` end-of-session). Meta = `{dc:14, ability:"wis", source}` — **no rounds clock**; "1 minute" GM-enforced advisory only (§70 residual; no rounds:10 mapping).

## Variant chooser: ZERO (grep + live)
- `grep -ri "fey.?melody" src/ server/` = **0 hits** (only monsters.json). No consumer, no parser, no te.
- Choose-one machinery exists solely byte-anchored to Animal Spirit: `parseAnimalSpiritVariants` (MonsterCardHelpers.js:263) → `AnimalSpiritVariantModal.jsx` (MA-0275 §80 template). Nothing generic; nothing keyed to "Charming/Frightening".
- Live flow (recorded exactly): chip press → **picker opens directly, NO chooser stage** → `.sp-modal` header: *"60-ft Line (GM positions tokens; selection advisory) … On a failed save, target takes 2d6 + 3 Psychic damage. On a successful save, target takes half damage."* — damage-only single resolution visible in chrome; confirm = inline auto-roll per NPC (§30/§159), results modal.

## Emanation → fabricated "60-ft Line" picker (orchestrator correction)
- Orchestrator §MA-0317 prediction "single-target degradation" **did NOT occur**: picker opened. Cause: `breathAoeShape` (MonsterCardModal.jsx:134) tests description prose `/\bline\b/i` → matched the Frightening-clause "out of **line** of sight" → shape 'Line'; feet = max prose token = 60 (from "60-foot Emanation"). range:"" so `emanationRadiusFeet` (:63, range-field-only per MA-0590) never fires.
- Net: RAW emanation (attacker-origin, omnidirectional) adjudicated through an **oriented 60-ft Line** picker; gridless lenient (§42) so selection advisory — shape lie does not change target math here but confirms prose-scrape hybrid fabrication (§199 family) + MA-0590 emanation seam inert for this row (range field empty).

## Recharge 4-6: FULLY LIVE (honest record — the working axis)
- Spend at fire: `ability_use` "uses Fey Melody — Recharge 4-6; unavailable until a d6 4+…" ×3 casts.
- Immediate second press → popup "Not Recharged … No save rolled, nothing spent" + `automationType:"fey_melody_refused"` + chip class `mc-dice-link-spell-spent` (§124 class).
- Recovery d6 at owner turn-start (`__initiative__.lastAppliedTurnStartCreature` walk truth): r1 **3✗**, r2 **6✓**→refire, r3 **3✗**, r4 **1✗**, r5 **5✓**→refire, r6 **2✗**, r7 **5✓** (unused). Refire only after 4+, gate holds on 1/2/3 — economy honest (§61/MA-0488 template).

## Design notes (fix)
1. **Variant clause needs the MA-0275 chooser template**: parser keyed to the byte-shape "song's effect:<br><strong>Charming.</strong>…<br><strong>Frightening.</strong>" (or authored structured `variants:{options:[{name,damage?,conditions}]}`) → chooser modal → variant-threaded save context → per-variant grant in saveProcessing (Charming: condition-only, `dc_success:"none"`; Frightening: 2d6+3 halved-on-save + frightened only). Unpicked-Done = advisory, never both (§108 rule).
2. **DATA one-field stopgap for the half-leak**: `dc_success:"none"` still WRONG here (Frightening legitimately halves) — only honest without chooser is full rework; do not blind-patch MV-20-style (MA-0298 discriminator precedent).
3. **Condition spray**: truncate `save_effect` to variant-neutral or route via chooser; word-scan over a both-variants block always over-grants (§875).
4. **Emanation**: author `range:"60-foot Emanation"` so the MA-0590 radius fallback (attacker-origin gate) routes honestly instead of the "line of sight" prose scrape opening a fake Line picker; and/or exclude "line of sight" from the shape regex (word-context guard).
5. "Dance in place", "ends if takes damage" (already house-ruled), LOS-end condition = §70 zero-consumer advisories.

## Session integrity
test-campaign only (header verified post-select); no manifest/git writes; injections observed (nav echoes carried off-site proxy URLs; URL values self-verified localhost via location.href throughout).
