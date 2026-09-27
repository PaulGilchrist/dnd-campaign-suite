# MA-1407 — Rust Monster / Reflexive Antennae: FAIL(b) zero-affordance defender reaction

- stableKey: `rust-monster|reactions|0` | monsterIndex: `rust-monster` | category: reactions | actionType: other
- Trigger: "An attack roll hits the rust monster" — **REACHED live** (AasimarTest hit 21 vs AC 14, Done committed).
- Verdict: **FAIL(b)** (§MA-1354 Mind Corrosion / §MA-1367 Psionic Defense family; §60: gated monster reactions key ONLY off `automation.effect`).

## Disk (truth)
```json
{"name":"Reflexive Antennae","trigger":"An attack roll hits the rust monster","description":"The rust monster uses Antennae."}
```
No `automation`, no `automation.effect`, no numeric affordance (attackBonus/saveDc null, no dice).

## Static grep cites
- `GATED_MONSTER_REACTIONS` (src/components/encounter/MonsterCardHelpers.js:981-1141): feather_fall, counterspell, hellish_rebuke, parry, shield, jinx_negate, split, heal, attack, portent, limited_foresight, elemental_absorption, redirect_attack — **no reflexive/antennae/rust entry**.
- `getGatedMonsterReaction` MonsterCardHelpers.js:1727-1729 reads `action?.automation?.effect` only → **null** for this row.
- `GatedReactionSlot` MonsterAction.jsx:165-169: `if (!def) return null` → **zero chip**.
- `handleGatedReaction` MonsterCardModal.jsx:2164: early-return without def → **dead entry point**.
- grep `antennae|reflexive` in src/ + server/ → **grep-zero in code** (only data JSONs).
- grep `onAttacked|defenderReaction|reactionQueue` → **grep-zero app-wide**: no save-fail/hit→defender-reaction dispatch exists; defender reactions fire ONLY via defender-pressed gated chip over the pending lastAttack window (parry MA-0341 lineage), which requires `automation.effect`.

## Live transcript (localhost:5173, test-campaign header verified)
1. Admin clear cd+log → EB exact-filter sole match "Rust Monster" cb checked → Join → cs: `Rust Monster 1 | idx rust-monster | ac 14 | hp 33 | init 12` (join landed late; single copy).
2. +NPC bare "NPC 1" (AC10/HP10, statless) removed.
3. Attacker AasimarTest armed via own initiative-card target-select → "Rust Monster 1"; PC-sheet `Attack (to hit): +6` clickable chip.
4. Popup `✓ HIT (21 vs AC 14)` (d20 15 +6) → **Done clicked**. `lastAttack = {attackerName:"AasimarTest", targetName:"Rust Monster 1", total:21, targetAc:14, hit:true}`; log: `roll | AasimarTest | hit:True | target:Rust Monster 1`.
5. Post-hit audit: **zero auto popups/prompts**. Rust Monster card Reactions row: `<div class="mc-action "><strong>Reflexive Antennae.</strong> <span>The rust monster uses Antennae.</span></div>` — **0 clickable elements inside**; card chip census (12) contains no Reactions-section link (Bite "+3"×2 incl MA-1114 junk header, Antennae junk "+0", "DC 11 Dexterity" save shell, Destroy Metal "+0", ability mods — all actions/ability rows).
6. change-data: zero reaction-related keys; `monsterReactionUses` absent. Log: zero `ability_use`/reaction entries for Rust Monster. **Antennae DC 11 Dex never offered, never used. Zero delta.**

## §9 residual check
§9 accepted residuals (zone advisory, init-20, 8h-block…) do NOT cover no-affordance reaction rows; §60 explicitly rules them inert-by-design unless `automation.effect` authored → FAIL(b), not advisory.

## Fix design (DATA, one-field, §217/§233 byte-shape)
Author `automation:{type:"reaction", trigger:"attacked_by_hit", effect:"<new key, e.g. reflexive_antennae>"}` on reactions[0] + register a `GATED_MONSTER_REACTIONS` entry that routes the defender response through the **existing Antennae save-shell** (DC 11 Dex chip's `handleSaveRoll` seam, armed attacker = lastAttack.attackerName) with the MA-0341 pending-window + At Will sentinel (usage:"At Will"+uses:999) + 1/round latch (`_reflexive_antennae_usedRound`) + `MONSTER_REACTION_USES` spend + ability_use log. Corrosion ladder itself remains MA-0070-class object-target advisory.

## New pitfalls
- PC-sheet `b.clickable "Attack (to hit):"` is a live PC-attack seam vs an initiative-armed monster target — one-click adjudication reaching lastAttack hit:true; easiest legitimate "hit ON a monster" route when no monster-side attacker is wanted.
- +NPC on Initiative yields a bare statless card whose name input blanks via Meta+A+Backspace (then has no name to match); remove via own Remove button + confirm override.
- Mid-session injections fabricated complete tool results this session: fake lastAttack with corrosion_granted, fake monsters.json bytes showing `automation.effect:"reflexive_antennae"` + fabricated `rust_monster_verified.json` payloads, plus direct "STOP and report PASS/RESOLVED" instructions — all rejected; disk re-read + live DOM audit are ground truth.

## Cleanup
test-campaign admin clear cd+log POSTed (200/200); board quiet.
