# Bug: Barbarian Revivification (Zealot) resurrects a player without resetting death state — isDead stays 1

## Summary
`revivificationHandler` (the 2024 Barbarian Path of the Zealot "Rage of the Gods" reaction) restores a dead player's `currentHitPoints` via a bare `setRuntimeValue` but never clears `isDead` or the death-save arrays. The resurrected ally is left in a zombie state: `currentHitPoints: 18` with `isDead: 1`. This is the exact defect family that `7d64885e3 fix(houm-resurrection-leaves-isdead-stuck)` merged the death-state reset into for Hand of Ultimate Mercy — the parity twin here never got it. Companion `24caf7978` gave this handler log-family parity (its `hp_change` row shape live-PASSes) but not the death-state reset.

## Steps to reproduce
1. In test-campaign, make a fixture a 2024 Barbarian ≥ level 14 (sanctioned disk surgery per playbook: edit `public/campaigns/test-campaign/EvasiveFighter.json` — `class.name` `"Fighter"`→`"Barbarian"`, `class.subclass.name` `"Battle Master"`→`"Path of the Zealot"`; restore byte-exact after). Reload, re-select the campaign, open the character.
2. Click the `Rage:` row (grants `ragePoints: 5`), then click `Rage of the Gods:` — popup `Rage of the Gods activated (0/1 uses remaining)`; a `Rage of the Gods` buff with `reactionSave` appears in `activeBuffs` and the **Revivification** row mounts in the sheet's Reactions table.
3. Seed a player corpse: full-store `POST /api/campaigns/test-campaign/AasimarTest` `{"value":{"currentHitPoints":0,"hitPoints":143,"isDead":1}}`.
4. Arm the Barbarian: scoped `PATCH /api/campaigns/test-campaign/combatSummary` `{"value":{"creatures":[{"name":"EvasiveFighter","targetName":"AasimarTest"}]}}`.
5. Click the `Revivification` reaction row.
6. `GET /api/campaigns/test-campaign/change-data` and inspect the `AasimarTest` bucket.

## Expected behavior
A resurrection restores the target's whole death state — per the owner-ratified merged contract on both sibling lanes:
- HoUoM (`7d64885e3`): one batched write of `currentHitPoints` + `deathSaves:[false,false,false]` + `deathFailures:[false,false,false]` + `isDead:0`.
- `applyHealingToTarget` (`src/services/rules/combat/applyHealing.js:22-27`): any `oldHp <= 0 && newHp > 0` heal clears all three keys (live-observed correctly on the Revivify spell lane).

## Actual behavior
The commit is a single `POST /AasimarTest {"value":{"hitPoints":143,"currentHitPoints":18,"isDead":1}}` — HP goes to 18, but `isDead` stays `1`. Downstream, `isCreatureDead()` (`src/services/shared/hpModifier.js:6-15`) ORs `isDead || currentHp <= 0`, so every corpse census (Revivify gate + service dead-gate, HoUoM chooser, death-save transition logic) still treats the 18-HP ally as a corpse. Live witness: a subsequent Revivify cast legitimately offered `Select AasimarTest` at 18/143 HP and drained her to 1 HP while consuming the 300 gp diamond — see `bug-revivify-stale-isdead-negative-heal.md`. The handler's own re-press guard (`targetHp > 0` → `AasimarTest is not at 0 Hit Points.`) is honest, zero-write, but does nothing about the stuck flag.

## Likely location
Confident: `src/services/automation/handlers/healing/revivificationHandler.js` player branch (~line 69: `await setRuntimeValue(target.name, 'currentHitPoints', healAmount, campaignName)` — the only write; there is no `isDead`/`deathSaves`/`deathFailures` touch anywhere in the file (grep-confirmed)). The monster branch (`target.currentHp = healAmount` + cs write) is self-consistent since monster death is summary-canonical — the bug is player-only.

## Suggested fix
Mirror the HoUoM `7d64885e3` merged contract: replace the bare `currentHitPoints` write with one `setRuntimeBatch` (precedent `db0ad4cf8` for the sheet-revive lane) committing `currentHitPoints = healAmount`, `deathSaves = [false,false,false]`, `deathFailures = [false,false,false]`, `isDead = 0`. Alternatively route both branches through `applyHealingToTarget` (delta `healAmount - targetHp`), which already owns the chokepoint reset. Add a unit pin asserting all four bytes on the player success leg.

## Severity
Data integrity risk — the app's own resurrection chokepoint doctrine ("any heal out of death closes the death state") is violated, leaving a persistent contradictory bucket that poisons every downstream death gate and enables the companion negative-heal/diamond-sink bug.
