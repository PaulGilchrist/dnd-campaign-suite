# Bug mon-MA-0020 — Aboleth "Dominate Mind (2/Day)" — failed save applies NO Charmed (MV-14 seam re-confirmed)

Row: monster "Aboleth" (`aboleth`) · "Dominate Mind (2/Day)" · save · saveDc 16 · Wisdom · conditions ["charmed"] · save_effect: "Failure: Charmed until the aboleth dies/planes shift; controlled within 60 ft; telepathy; repeat save on damage + per 24h ≥1 mile away."

## Verdict: FAIL — exact MV-14 fingerprint reproduced on a fresh independent run

Failed save produces stamp but zero live condition, zero condition log. Same no-damage-save gate as MA-0017. No alternate charmed producer exists on the monster save path.

## Live evidence (test-campaign, Playwright :5173, fresh EB join)

- EB: Aboleth checked (1 monster, 5,900 XP) → `button.encounter-btn-join` → combatSummary `Aboleth 1` (type npc, monsterIndex aboleth, WIS saveBonus +2). Target select on Aboleth card → AberrantSorcerer (WIS 9, mod −1).
- Monster card modal → `button "DC 16 Wisdom"` → `.sp-modal` "AberrantSorcerer must make a WISDOM saving throw. DC 16" → Roll Save → **SAVE FAILURE — Total 2 vs DC 16, d20 (3) + −1** → Done.
- `lastAttack` stamp (change-data): `attackerName "Aboleth 1" → targetName "AberrantSorcerer"`, `saveType Wisdom, saveDc 16, total 2, saveResult "failure"`, `attackName/actionName "Dominate Mind (2/Day)"`, **`saveConditions:["charmed"]` captured**, `isSpellDamage true`.
- **`AberrantSorcerer.activeConditions` ABSENT** from change-data immediately after Done; campaign `targetEffects` empty; NO initiative-card Charmed badge (UI "Charmed" hits = static card description text only).
- Log: `roll | AberrantSorcerer | Dominate Mind (2/Day) | rolls [3] | saveResult failure` recorded — **no `type:"condition" action:"applied"` entry** for this DC 16 save anywhere in the log (only 2 stale pre-run `condition` entries at 05:02 with `dc:10`, unrelated prior session).

## Alternate charmed producers — none on monster save path (grep)

- `saveConditions` consumers: `saveProcessing.js` lastAttack stamps only (:77, :207); `applyFailedSaveConditions` (:304) sole `activeConditions` writer from save — invoked ONLY inside `applySaveDamage` (:420), gated `context?.autoDamageFormula && saveDc != null` (:130 player, :283 NPC). Dominate Mind has no `damage_dice_primary` → formula null → gate never opens.
- `beguilingTwistHandler.js:21` / `reactionBonusHandler.js:202` READ `lastAttack.saveConditions` but are gated on PC class features (Ranger reaction), not producers for this save. Charm spell handlers (`charmPersonHandler` etc.) are PC spell paths.
- Manual-only workaround stands: initiative-card **Condition Add** modal ("Add" button, MV-9-era) is the only way to put Charmed on a target here.

## Expiry / control / telepathy clauses — unmodeled (grep status, brief)

- No code implements "until aboleth dies / different plane", "controlled within 60 ft", "telepathy any distance", "repeat save on damage", or "repeat save per 24h ≥1 mile". No plane-shift/state machinery, no distance-control state, no charmed-by-aboleth repeat-save trigger (`calmEmotionsCleanup` handles other effects). Even if the gate fix lands, these clauses remain GM-narrative; only bare `charmed` in `activeConditions` would apply, with no auto-expiry.

## 2/Day enforcement — NOT enforced (probe result)

- Authored fields: no `uses`/`usage`/`recharge` on the action in monsters.json — "(2/Day)" exists only inside the display name; `MonsterAction.jsx:71` renders `action.usage` only if present (absent).
- Enforcement probe: **second click of `DC 16 Wisdom` in the same fight immediately re-fired the full WIS DC16 save prompt** (Roll Save/Dismiss, Dismissed) — no gate, no counter, no disabled state. change-data contains no numeric uses keys (only flavor text). Zero-cost unlimited repeat.

## Root cause (unchanged from MA-0017)

`applyFailedSaveConditions` coupled to `applySaveDamage` behind `autoDamageFormula`. Fix: call it directly in `processPlayerSave`/`processNpcSave` after save resolves when `context.saveConditions` non-empty, independent of damage formula.

## Cleanup

Admin clear POSTs (`clear-change-data`, `clear-log`) with `Host: localhost`; browser closed. No manifest/playbook edits.
