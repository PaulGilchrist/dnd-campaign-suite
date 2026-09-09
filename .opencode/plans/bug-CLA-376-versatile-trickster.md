# Bug — CLA-376 Versatile Trickster (Rogue, 2024) — FAIL

**Date:** 2026-09-09 · **Host:** AasimarTest lv20 Rogue, rules 2024, subclass **Arcane Trickster** (swapped from Thief this run — feature lives under Arcane Trickster major lv13 in this app's `public/data/2024/classes.json`; manifest "Thief lv13" was stale).
**Rig:** EB Thug ×2 (AC 11, Medium), gridless (5ft gate LENIENT per playbook §7), armed via full-combatSummary POST.

## Data ground truth
- Trip option (`Cunning Strike` lv5 / `Devious Strikes` lv14, maxEffects 2): `cost 1d6, effect prone, saveType/saveAbility DEX, saveDc 'ability'`. **App-canonical Trip save = DEX** (manifest "STR saves" is stale RAW wording — not a bug).
- Consumer chain exists end-to-end (grep): `attackRollRiders.js buildCunningStrikeStep` → `attackRiderHandler.js applyRiderOption:356-387` (Trip-gated `isWithinRange` scan → RAW-combatant keys) → `AttackRiderModal.jsx:30-112` (`SecondaryTargetModal` "Versatile Trickster") → `versatileTricksterHandler.js applyVersatileTrickster` (size gate + campaign te + `ability_use` log). Zero-consumer excuse NOT available.

## PASS halves (live-proven this run, self-issued curl ground truth)
- Trip+Withdraw rider apply → primary Thug 1 DEX save DC16 real roll+log (`save_result … failed (DC 16, rolled 15)`), prone applied (`Thug 1.activeConditions ["prone"]`).
- Post-save **"Versatile Trickster" chooser renders** ("Trip applied to Thug 1… Trip another creature within 5 feet…", lists Thug 2 (Medium)) — pick Thug 2 → "Trip Secondary Target" →
  - te written: `{target:"Thug 2", option:"Trip", effect:"prone", saveType:"DEX", source:"Versatile Trickster", duration:"until_start_of_next_turn"}`
  - log: `ability_use | AasimarTest | Versatile Trickster | Trip applied to Thug 2 (secondary target via Versatile Trickster).`
- Cost is PER-OPTION, paid once per Trip (no extra die for the VT second target — RAW correct): single Trip = "Forgoing 1d6"; Trip+Withdraw = "Forgoing 2d6" (sneak formula popup showed 9d6 at lv20 for single-Trip).

## FAIL clauses
1. **Canonical trigger dead — single-option Trip never shows the chooser.** `applyRiderEffect` Trip leg `await`s the save then **returns `null`** (attackRiderHandler.js:658); `applyRiderOption` returns `results[0]` when 1 option chosen (:415-417) → `null`; `AttackRiderModal` gates the VT picker on truthy `result` (`applied && result`, :31) and **closes** on `applied && !result` (:20). Live proof (attack #1, Trip only): HIT → save FAILED → modal vanished, `versatileTricksterSecondaryTargets=[Thug 2]` + `versatileTricksterPrimaryTarget/Action` **persisted unwritten-to-UI**, zero "Versatile Trickster" log, no chooser in any overlay poll. The chooser only surfaces when a SECOND truthy-result option (e.g. Withdraw) rides along — Trip+Withdraw. Fix: in `handleApply`, when `action` offers Trip + VT passives, run the VT picker off the persisted `versatileTricksterSecondaryTargets` key instead of `result` truthiness (or make `applyRiderOption` return a popup wrapper on multi/one-save legs).
2. **Second target never rolls a save and never gains Prone state.** `applyVersatileTrickster` only writes a te marker + popup claiming "must make a Dexterity save"; it never calls `createSaveListener` (mirror attackRiderHandler.js:580-597). Live: no Thug 2 save prompt, no `save_result`, `Thug 2.activeConditions = null`; te `saveDc:'ability'` is an unresolved string with no prone-applying consumer. Clause "both targets roll saves, prone on fail" = popup-only for leg 2.
3. **Stale-key replay bypasses the Trip gate.** The handler gate (`chosen.effect==='prone'`) exists, but `AttackRiderModal` re-reads the persisted `versatileTricksterSecondaryTargets` on EVERY post-apply mount and never clears it. Live: after the earlier Trip cast, a later **Withdraw-only** (non-Trip) rider apply falsely re-surfaced the "Versatile Trickster" chooser with the stale Thug 2 entry (same CLA-326 stale-array family). Fix: clear the three VT keys at `applyRiderOption` entry (or gate the modal read on this cast's chosen options).

## Verdict
**FAIL** — core clause "Trip pick → second-target chooser" unreachable on the canonical single-Trip selection; second-target leg is popup/te-marker-only with no save roll and no Prone application; Trip-only gate leaky via persisted-key replay. Picker + handler + log themselves work when the modal survives.

## Cleanup state
Admin clear change-data + campaign log done post-run; persisted rider selection keys (`versatileTricksterSecondaryTargets/PrimaryTarget/Action`, `_CunningStrike_usedRound`) cleared by the admin wipe. Servers left running. Host subclass **Arcane Trickster lv20 PERMANENT** (registry updated).
