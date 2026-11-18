# Bug: Shield Bash save prompt resolved after a page reload — result unlogged, Push/Prone chooser dead, FT-082 stash left dangling

## Summary

A Shield Bash STR save prompt that is dwelling when the GM's tab is RELOADED replays correctly (the modal re-mounts from the store, waits indefinitely, and the Roll Save gesture works), but resolving it post-reload is a silent dead end: **no `save_result` row and no resolved `Shield Bash … succeeded/failed` row are ever written** (the original "must make a STR saving throw (DC 17)." row dangles as the last trace), the **Push/Prone chooser can never mount** (the `shieldBash.handler` Promise that awaited the prompt died with the previous page context), and the resolution still **clobbers campaign `lastAttack` with the Shield Bash save record and leaves the FT-082 `_shieldBashBaseAttack` stash dangling** in the character bucket — the exact collateral state the live-chain paths explicitly restore. Weapon damage of the triggering attack is already committed (safe by the b0f315161 design), so HP truth survives; the rider outcome and log honesty do not.

## Steps to reproduce

Start from test-campaign, EvasiveFighter (Shield Master holder), an EB board with the 13-PC party.

1. EB → search "Goblin" → check `Select Goblin` → **Join Encounter**; arm `select[aria-label="EvasiveFighter target"]` to it.
2. EvasiveFighter sheet → press the `Glaive` row until a HIT commits (`Done` on the staged face). With fresh once-per-turn latches (see sibling bug `bug-round-reuse-after-clear-drops-once-per-turn-riders` if latches are stale) the chain lands damage synchronously and arms `Saving Throw Required … Source: Shield Bash` (`.sp-overlay`, Roll Save/Dismiss).
3. WITHOUT touching the prompt, reload the tab (navigate to the app root), re-select test-campaign.
4. Observe: the save prompt REPLAYS (`.sp-overlay` with the same DC/target) — this part is by design and works.
5. Press `Roll Save`, then `Done` on the result face (it renders honestly, e.g. "SAVE FAILURE Total: 14 vs DC 17 d20 (15) + -1").

## Expected behavior

Same as the live (no-reload) lane, which was verified working in the same session: `Roll Save` → `save_result` row + `Shield Bash: <T> failed/succeeded the STR save (DC 17)…` row; on failure the Push/Prone chooser mounts (`Push <T>` / `Prone <T>` radios); whichever outcome, the FT-082 stash is restored so campaign `lastAttack` ends as the base weapon attack. If the chain cannot be resumed post-reload, the replayed modal must at minimum answer honestly: log the resolution and say the rider expired — not roll a result into a void.

## Actual behavior

- After step 5: `sp-overlay` count 0, no chooser ever mounts (waited 3+ s, remounted the Initiative view, nothing).
- `/api/campaigns/test-campaign/log`: last Shield-Bash-related row remains `Shield Bash: Goblin 3 must make a STR saving throw (DC 17).` — NO `save_result` row, NO succeeded/failed row (contrast: the three pre-reload resolutions in the same session each wrote both rows, e.g. `Goblin 5 failed STR save (DC 17, rolled 6 +-1 = 5)` + `…failed the STR save (DC 17). Choose an effect.`).
- `GET /change-data` after resolution: `lastAttack.attackName === "Shield Bash"` with `damageType: null` (the documented clobber) and `EvasiveFighter._shieldBashBaseAttack` left holding the stashed Glaive attack — dangling forever (its two restore points, the live chain's success/dismiss branches and `applyShieldBashEffect`, both live in the dead page context). Per the FT-082 comment in `shieldBash.js`, a clobbered `lastAttack` makes same-turn Slasher Hamstring (`slashing_damage_hit`) falsely refuse on shield holders.
- Control pair (same session, no reload): Goblin 3/4/5 pre-reload resolutions all wrote the two-row pair and cleanly restored/cleared the stash (dismissed leg additionally wrote the `save_dismissed` refusal row). The only variable changed was the reload.

## Likely location

Confident on mechanism; guessing on best seam:

- The prompt replays from the change-data `pendingSavePrompts`/save-listener store (`src/services/combat/automation/common/savePrompt.js` `createSaveListener`) via the generic `SavePromptModal` + `src/hooks/combat/saveProcessing.js` (which rolls and stamps the lastAttack save record — that part DID run).
- The rider's continuation — `shieldBash.handler`'s `await Promise.race([promise, dismissedPromise])` in `src/services/combat/steps/features/shieldBash.js` (lines ~122-176) — is a tab-local async frame parked at the `shieldBashRider` pipeline step; it does not survive navigation, so `logShieldBashSaveResult`, the chooser `modal` return, and `restoreBaseAttackAfterBash` never execute.
- `saveProcessing.js` also does not (cannot) reach back into a dead chain to write the resolved row pair or restore the stash.

## Suggested fix

Investigation first: enumerate which prompt consumers are chain-local (Shield Bash rider; possibly other `.sp-overlay` riders whose handler awaits a prompt) vs store-driven (death saves, condition saves — those replay fully). Candidate directions: (a) stamp the pending save-prompt record with the originating chain's outcome hooks is impossible across reload — instead, when a save is resolved with NO live consumer, have the resolution lane write the `save_result` + a `save_lapsed`-style honest row ("…resolved after page reload — the pending Shield Bash effect lapsed; no chooser available") and run the FT-082 `restoreBaseAttackAfterBash` from the stash (the stash lives in the character bucket, reachable store-side); or (b) on mount, detect orphaned rider prompts (save-prompt record with no live pipeline) and offer only a Dismiss-equivalent that restores the stash. At minimum: the stash restore + lastAttack re-stamp must not depend on the dead page.

## Severity

**Broken feature** (rules outcome silently lost + log dishonesty by omission): the holder's earned Push/Prone choice vanishes with no trace in the log, the "must make a STR saving throw" row dangles implying a pending adjudication that can never happen, and the dangling FT-082 stash/clobbered lastAttack is known collateral the code elsewhere deliberately repairs. Damage/HP data stays honest. Trivially reachable: any mid-encounter tab refresh while a save prompt is open — and prompts deliberately wait indefinitely.
