# Sheet attack committed behind the Shield Bash rider: damage is deferred, and silently ABANDONED when the rider chain is Cancelled/Dismissed

## Summary
When a sheet weapon-attack HIT triggers the Shield Bash attack rider (save-prompt →
push-or-prone chooser), pressing `Done` on the staged-HIT popup does NOT apply the weapon
damage at commit time — there is no damage face, no `hp_change` row, and the target's HP stays
unchanged on every surface. The damage is instead held in the parked chain and only lands if the
rider chain is *fully completed* (Roll Save → result → chooser → Apply → Done); on every
abandonment path (rider chooser **Cancel**, save-prompt **Dismiss**) the committed attack damage
is silently lost with zero error or refusal. A control attack from a character without the rider
lands synchronously on Done.

## Steps to reproduce
Starting state: `test-campaign`, EvasiveFighter (2024 Swords Bard fixture, shield equipped —
its melee hits arm the Shield Bash rider), a fresh Goblin joined via Encounter Builder.

1. On the GM tab (localhost), arm the sheet lane: scoped
   `PATCH /api/campaigns/test-campaign/combatSummary` `{value:{creatures:[{name:"EvasiveFighter",targetName:"Goblin"}]}}`.
2. Open EvasiveFighter's sheet; press the `Glaive` activation cell in `.attacks`.
3. Staged popup mounts: `Glaive … ✓ HIT (18 vs AC 15) Done / Cancel attack`. Press **Done**.
4. Observe: NO damage face appears; a `Saving Throw Required` overlay mounts instead
   ("Goblin must make a STR saving throw. DC 17 … Source: Shield Bash"). Target HP unchanged
   (7/7), zero `hp_change` rows after the press (verify via `/log` and the board row).
5. **Abandon leg:** press **Dismiss** on the save prompt. Everything closes; target stays 7/7;
   the weapon damage NEVER lands (repeated 3× across two different goblins — hit totals 18 and
   the earlier chain ending in chooser-Cancel→prompt-Dismiss; both permanently lost).
6. **Complete leg (for contrast):** repeat steps 2–4, then Roll Save → (result face) Done →
   the Push/Prone chooser mounts → pick Push → Apply Effect → Done on the confirmation face.
   → the pending weapon damage NOW lands — and it flushes the backlog of ALL parked hits at
   once: the observed row was `hp_change targetName:"Goblin 2" delta:-19`, which EXCEEDS the
   single glaive max (1d10+3 = 13) — it was two deferred hits (chains from steps 2–4 of both
   runs) committing together, roughly two minutes after the original Done presses.

Control (same session): ElderPaladin sheet Longsword press → staged HIT → Done → damage
`delta:-21` row + `currentHp 0/7` synchronously. The sheet lane itself is fine; the
rider-parked lane is the defect.

## Expected behavior
`Done` on a staged HIT commits the weapon damage immediately (one `hp_change` row, target HP
moves) regardless of add-on riders. Choosing **Dismiss** on a Shield Bash save prompt (or
**Cancel** on the chooser) should skip only the push/prone rider — never retro-cancel damage
the player already committed. At minimum, abandoning the chain must not silently strand a
committed hit; and a deferred commit must never be visible-forever (target card shows 7/7 while
two hits sit pending).

## Actual behavior
- Commit-time: zero damage application (popup census: damage face never mounts after Done).
- Abandon paths: committed attack permanently lost, no refusal copy, no console error.
- Complete path: deferred damage lands late — and flushes multiple parked commits in one row
  (delta -19 for one `hp_change`), diverging from the honest one-row-per-attack shape used
  everywhere else.
- Collateral: because the HP delta arrives minutes later, board truth lags the player's belief
  (cards stayed 7/7 while hits were parked); a monster row evicted from the board meanwhile
  strands the commit entirely (observed: after the final abandon cycle the joined Goblin row
  vanished from the server combatSummary with its last hit's damage still unlogged — the
  multi-tab mirror provenance of the eviction is not isolated).

## Likely location
Medium confidence, behavior-derived:
- `src/services/automation/handlers/combat/attackRiderHandler.js` — `handleShieldBash` arms the
  save prompt via `createSaveListener` (`src/services/automation/common/savePrompt.js`) and
  returns; the sheet commit pipeline evidently treats that as a pause that holds the base
  weapon damage, instead of applying damage first and queuing only the push/prone rider.
- `src/hooks/combat/useLoggedDiceRollAttack.js` + `src/services/automation/handlers/handlePlainDamage.js`
  — the sheet popup-Done continuation: find where the rider branch diverts before
  `applyDamage`, and what the prompt's onCancel/Dismiss lane does with the parked damage
  (appears to drop it) while the chain-end commit path re-applies a backlog (explains the -19
  double-flush).
- Compare the monster-lane shape (`MonsterCardModal` / `handleAttack`) where rider-bearing
  commits did land damage honestly in prior runs (XE/XF).

## Suggested fix
Read the shield-bash rider's return contract and the save-prompt resolve/dismiss seams: base
weapon damage should commit at Done (its own `hp_change` row) BEFORE the push/prone save chain
mounts; Dismiss/Cancel then only drops the rider. Whatever mechanism currently re-applies a
parked backlog at chain end (the -19 flush) should be removed once commits are synchronous, or
at least split one-row-per-attack. Add regression pins: (a) rider-firing sheet hit → Done →
exactly one `hp_change` row synchronously even when the prompt is Dismissed; (b) full-completion
path applies weapon damage once, never a merged multi-hit delta.

## Severity
Broken feature / data-integrity risk — a committed attack can silently vanish (never applied,
never logged), and when it does apply it can merge multiple attacks into one wrong-shaped row
and land long after the player moved on.
