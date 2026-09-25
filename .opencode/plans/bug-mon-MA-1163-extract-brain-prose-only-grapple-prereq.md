# Bug MA-1163 — Mind Flayer Extract Brain: prose-only Grappled prerequisite, target_prerequisite UNAUTHORED

**Verdict:** FAIL(a)/DATA (one-field fix) — save axis itself EXACT.

## Disk (public/data/monsters.json, index=mind-flayer, actions[1], byte-quoted)
- name "Extract Brain" · attack_bonus 0 · save_dc 15 · save_type "Constitution" · save_effect "55 (10d10) Piercing damage...Success: Half damage." · reach "" · damage_dice_primary "10d10" · damage_type_primary "Piercing"
- **`target_prerequisite` ABSENT** — "one creature that is Grappled by the mind flayer's Tentacles" is prose-only. Manifest `conditions:["grappled"]` is prose-derived (§449).

## Seam evidence (source)
- `evaluateTargetPrerequisiteGate` (MonsterCardHelpers.js:688) call-site **handleSaveRoll MonsterCardModal.jsx:2014** — save path gate LIVE (MA-0019 codified).
- `parseTargetPrerequisite` returns null when the key is absent → `satisfied:true` unconditional → gate inert by DATA GAP, not dead seam.
- MA-0687 adjudication (playbook:209): prose target-prerequisite row lacking structured `target_prerequisite` with live gate seam = **FAIL(a) DATA, one-field fix** — NOT §70 advisory.

## Live proof (test-campaign, 2026-09-25, strict E2E)
- **NO-GRAPPLE probe:** Bandit 1 cd `activeConditions` absent (verified pre-press) → "DC 15 Constitution" chip ACCEPTED: nat18+0 ✓ save, half 25 applied, **zero refusals** (no `.mc-prerequisite-refusal`, 0 `/refus/i` log entries across all 8 fires). Eligibility unenforced = defect.
- **GRAPPLED state:** ea-overlay Add→Apply clean (§460): cd `activeConditions:["grappled"]` + meta {dc:10, ability:str} + `condition applied` log; `.ea-overlay` closed.
- **FAIL leg (grappled):** nat12+0 ✗DC15 → FULL 10d10 [4,8,2,6,3,3,3,1,2,5]=37, `saveSuccess:false`, Δ−37 exact. (+5 more honest fails: 62/60/56/61/57, each fd==full-dice-sum==|hpΔ|.)
- **PASS leg (grappled):** nat19+0 ✓DC15 → full 60, finalDamage 30 = floor(60/2) exact, Δ−30 exact.
- DC/type stamp on every victim save entry: `saveDc:15`, `saveType:"Constitution"`, `dcSuccess:"half"` ✓ (8/8).
- Ledger: hp chain 999→974→937→875→815→759→698→641→611; Σfd 388 == Σ|hpΔ| 388 ✓. Console 0 errors.
- Advisory: `saveBonuses.con:1` in cs but save rolls stamp `bonus:0` / popup "(d20 N + 0)" — nat-vs-DC; no recorded face sat on the nat14 boundary so no outcome flipped (advisory, saveProcessing bonus-fold, out of row scope).
- 0-HP brain-devour clause: GM-adjudicated — no `hp_threshold_kill` authored (parseHpThresholdKillClause null), app stamps nothing special at 0hp for this row; rigged 999 victim never reduced (per §129 dead-clamp advisory family).

## Fix
One field on mind-flayer actions[1]: `"target_prerequisite": {"conditions": ["grappled"]}` (MA-0019 byte-shape; MA-0687 source-agnostic variant — omit `by_attacker` until Tentacles hit-clause provenance exists, MA-1162 bug open). Gate already live on the save path: no seam work needed.
