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

## Resolution
FIXED — the "Likely location" was confirmed exactly: the player branch of `handle()` committed a single bare `setRuntimeValue(target.name, 'currentHitPoints', healAmount)` with no death-state touch.

**Fix (mirrors the HoUoM `7d64885e3` merged contract — `handOfUltimateMercyHandler.applyResurrectionHeal`):** in `src/services/automation/handlers/healing/revivificationHandler.js`, the player branch now commits ONE `setRuntimeBatch(target.name, { currentHitPoints: healAmount, deathSaves: [false,false,false], deathFailures: [false,false,false], isDead: 0 }, campaignName)` — the same merged one-POST idiom as the HoUoM twin and the sheet-revive lane (`db0ad4cf8`), and equivalent to the `applyHealing.js:24-28` chokepoint reset. The monster branch is untouched (summary-canonical). The rage spend, event dispatch, and `hp_change` audit row are unchanged (24caf7978 parity kept). Dual-ruleset check: single shared handler (`automation/index.js` registers `revivification` once; Rage of the Gods is a 2024-Zealot feature) — no 5e twin to propagate.

**Files changed:**
- `src/services/automation/handlers/healing/revivificationHandler.js` (import + player-branch batch write)
- `src/services/automation/handlers/healing/revivificationHandler.test.js` (mock gains `setRuntimeBatch`; the two player-branch pins retargeted to the batch; NEW regression pin "clears the death-state keys on resurrect (isDead-stuck regression)" asserting all four bytes, exactly-once batch, and no separate HP `setRuntimeValue` — mirroring the HoUoM `handOfUltimateMercyHandler.test.js:328` twin)

**Verification:**
1. LIVE repro (pre-fix, :5173, test-campaign, sanctioned EF Barbarian/Zealot class surgery per playbook §11): `Rage:` → `Rage of the Gods:` → corpse seeded via full-store `POST /AasimarTest {currentHitPoints:0, hitPoints:143, isDead:1}` → cs `targetName` armed → pressed `Revivification:` → bucket landed `{currentHitPoints:18, hitPoints:143, isDead:1}` — bug confirmed exactly as filed (rage 5→4 spent, honest `hp_change delta:18 note:'Revivification'` row).
2. LIVE fix-verify (:5173, fresh reload + re-select, corpse re-seeded WITH stale `deathSaves:[t,t,false]`/`deathFailures:[t,t,t]` to prove the full reset): press → success popup, bucket = `{currentHitPoints:18, isDead:0, deathSaves:[false,false,false], deathFailures:[false,false,false]}`, new `hp_change {delta:18, currentHp:18, maxHp:143, isHealing:true, note:'Revivification'}` row, rage 4→3.
3. Adjacent sanity: re-press refuses honestly (`AasimarTest is not at 0 Hit Points.`) with a fetch-hook census showing ZERO victim POSTs; HoUoM + applyHealing sibling suites re-ran green (51/51).
4. Tests: `revivificationHandler.test.js` 14/14; healing-handlers folder 23 files/212 tests green; lint clean (zero warnings); full suite 35491/35492 — the single failure (`NPCs.test.jsx` generate-modal test) passes in isolation, is an unrelated suite-load flake in the NPC lane (zero healing/revivification refs), pre-existing.
5. Cleanup: EF class surgery restored byte-exact (md5 `0df29ff3…` == PX baseline, `git status public/campaigns/` EMPTY); closed-tab two-pass admin clears GET-verified change-data `{}` + log `[]`.

**Note on the companion bug:** this fix removes the zombie source (`bug-revivify-stale-isdead-negative-heal.md` was enabled by the stuck flag fooling `isCreatureDead`), but the Revivify lane's own missing `oldHp <= 0` assert / negative-delta floor is a separate seam that file must handle on its own.

**Playbook pitfall discovered (for orchestrator to fold):** the `Rage of the Gods` uses gate (`combatStanceHandler.js:254-261`) stores REMAINING uses in `rageOfTheGodsUses` (max→`?? maxUses`; refuse at `<= 0`; decrement on success) — re-arming the stance between presses means PATCHing `rageOfTheGodsUses` to the MAX (1), not to 0; writing 0 pins the exhausted face. Also: activation popups stack and persist across `browser_run_code_unsafe` calls — dismiss `Done` buttons before asserting on fresh popup copy.
