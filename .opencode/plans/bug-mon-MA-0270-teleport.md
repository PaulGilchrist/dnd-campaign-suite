# BUG MA-0270 — Androsphinx "Teleport (Costs 2 Actions)" legendary row INERT

**VERDICT: FAIL (inert)**

## Row
- Monster: Androsphinx (`androsphinx`), `monsters.json` `legendary_actions[1]`, "Teleport (Costs 2 Actions)", actionType other.
- Static: bare `{name, description}` — no `delegates_to`, no `automation`, no `usage`.
- Live rig: test-campaign (header verified), cs idx2, init 2, HP 199/199, round 15.

## Evidence
1. **Affordance enumeration** (evaluate on `.mc-action` row): buttons 0, `.mc-dice-link` 0, links 0, onclick 0, tabindex null, cursor auto. HTML = `<strong>Teleport (Costs 2 Actions).</strong> <span>…120 feet…</span>` — pure text.
2. **Two trusted clicks on row** → zero popup, zero console errors; curl log 270 → 270 entries, **delta 0**.
3. **Control**: Claw `+12` chip (Actions) click → live roll popup "d20 1 +12 (+12 to hit)" + log `type:roll attack Claw Androsphinx 1` (dismissed without Done, no damage mutation). Pipeline alive; the row's silence is row-specific.
4. **Grep producers — zero**:
   - `sphinx_teleport|monsterTeleport|monster_teleport` in src/server: 0 hits.
   - `teleport` in MonsterAction.jsx / MonsterCardBody.jsx / MonsterCardModal.jsx: 0 hits — monster row renderer has no teleport affordance branch (only attack_bonus/save_dc/dice emit chips, §42z).
   - `tokenMove|token_move|moveToken|positionChange` non-test: hex-map party marker only (travel, not combat tokens); no client POST to `/positioning`.
   - `sphinx` in src/services: 0 hits. Log contains 0 teleport rows ever.
   - Existing teleport handlers are PC-only: `teleport→handleCloudsJaunt`, `psychic_teleportation→handlePsychicTeleportation` (§7 CLA-320: pool-spend+popup+ability_use log, **NO grid token move — no position consumer exists**), giantAncestryOptions PC.

## Root cause
- **DATA**: bare row — no automation/delegates_to → MonsterAction emits no affordance (row-inert, same family as MA-0269 legendary Claw Attack FAIL).
- **ENGINE**: app-wide there is **no monster token-move / position consumer** (MA-0320 precedent; §7 "no position consumer exists"). Even if authored (`auto_effect`/`teleport` automation), the best achievable is the CLA-320 pool-only record model (legendary-use spend + log, no 120-ft token relocation). Fully wiring this row requires a movement subsystem, not a data patch.

## Fix options (advisory)
- Data-only, consistent with precedent: `automation {type:'auto_effect', effect:'sphinx_teleport'}` + legendary-use ledger → record-only PASS-subset, zero grid move.
- Full fidelity: blocked on absent position-move consumer (§7 gap, MA-0320) — out of scope.

No manifest/playbook/registry edits made.
