# Bug mon-MA-0019 — Aboleth Consume Memories: targeting prerequisite gate absent (FAIL)

Row: MA-0019 · "Consume Memories" · save DC 16 Intelligence · 3d6 Psychic (half on success) ·
prerequisite: "one creature within 30 feet that is **Charmed or Grappled by the aboleth**" ·
0-HP clause: "The aboleth gains the target's memories if the target is a Humanoid and is reduced to 0 HP".

## Verdict: FAIL — gate-ignoring half-implementation
Core DC/type/both damage branches are exact (PASS-subset quality), but the row **fires on
targets that do not satisfy the stated Charmed/Grappled-by-aboleth prerequisite** → strict FAIL.

## Live evidence (test-campaign, 2026-09-13, fresh EB Join "Aboleth 1")
1. **Core exact**
   - Prompt: "Saving Throw Required — INTELLIGENCE saving throw. DC 16. Half damage on successful save." (DC/type ✓)
   - FAIL branch (AberrantSorcerer, INT −1, GM-applied Charmed): d20 14 + −1 = 13 vs DC 16 → SAVE FAILURE;
     log `save-damage` rolls [3,3,6] total 12, saveSuccess:false, **finalDamage 12 (full)**; hp_change −12 (41→29). ✓
   - SUCCESS branch (DivinationWizard, INT +11): d20 7 + 11 = 18 vs DC 16 → SAVE SUCCESS;
     log `save-damage` rolls [5,2,4] total 11, saveSuccess:true, **finalDamage 5 = floor(11/2)** (MV-10);
     hp_change −5 (82→77). ✓
2. **Gate ABSENT (the FAIL)**
   - Live probe: Consume Memories save prompt fired at **DivinationWizard who had NO conditions**
     (no `activeConditions` on cs entry or character key) — not Charmed, not Grappled, not "by the aboleth".
   - Aboleth initiative-card `[data-testid="target-select"]` offers **all 14 combatants**, zero filtering
     by Charmed/Grappled.
   - Data: monsters.json Consume Memories row carries only `save_dc/save_type/damage_*` — no
     precondition/target_restriction field; prerequisite exists only as description prose.
   - Code: `grep -in "consume.?memories|consumeMemories" src server` → **zero hits**; row resolves via
     generic monster save path (MonsterAction.jsx `.mc-dice-link` → SavePromptModal → applyDamage.js),
     which never parses "that is Charmed or Grappled by" prose. `escape_dc`/grapple-target gate grep-zero
     (MV-9 consistent: zero grapple producers app-wide).
   - Condition Add modal chips DO include Charmed and Grappled (§13 confirmed live), so prerequisite can be
     manually staged, but nothing consumes it: gate unarms → row is un-gated vs any combatant.
3. **Provenance gap:** even when Charmed is applied via modal, no "by the aboleth" attribution is recorded
   (`activeConditionMeta.charmed = {dc:10, ability:'wis'}` — no source creature). Gate cannot exist.
4. **Memory-gain-at-0-HP clause: inert.** `grep -in "memories" src server` → zero consumers (only public/data
   prose). No memory/kill tracking code exists; clause unenforceable.
5. Side note: GM-applied Charmed on Sorcerer was removed after the damage ("took damage (Friends)")
   — charm-on-damage-wake removal fired for a Psychic hit; expected generic charm behavior, not row-specific.

## Fix pointer
Add a structured prerequisite (e.g. `requires_conditions: ["charmed","grappled"]` + source attribution)
to the data row and a target-eligibility gate in the monster save-row launcher (MonsterCardBody/MonsterAction
target chooser + save dispatch); add "by <source>" provenance to condition application. Memory-gain clause
can remain flavor or gain a log-only stamp at 0 HP.
