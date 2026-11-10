# Combat-seam clears are board-wide — per OWNER RULING (Paul 2026-11-10) an initiative roll, short rest, or long rest signals old-combat-ends/new-combat-begins ONLY for the creature that rolled/rested, and EB Join is NOT a new-initiative-roll at all

## Summary

Owner ruling (verbatim, 2026-11-10): *"EB join is not a board wide new initiative roll. EB join can be used in the middle of combat and frequently is used for patrols and other reinforcements to join an existing battle. Initiative rolls only signal the creature making the initiative roll as joining what might be a pre-existing combat encounter. So an initiative roll, short rest, or long rest signals old combat ending and new combat beginning for the character making the initiative roll, not for everyone."*

Two law consequences to enforce in code:

1. **Per-creature scope:** a creature's own initiative roll (sheet chip or GM-card roll) and its own short/long rest clear THAT creature's stale combat state (conditions, expirations, self-buffs — the `clearAllExpirationEffects` lane, race-fixed in 6aea00d8c). They must NOT clear any other creature's state. A GM "roll for all" is legitimate only because every creature individually rolled.
2. **EB Join is not a clear seam for EXISTING creatures:** reinforcements/patrols join mid-combat; joining must leave every already-present creature's conditions, expirations, and combat-scoped entries UNTOUCHED. Joiners are fresh, so effectively nothing is swept on join (their own first roll may clear their own empty state — a no-op).

Suspect lanes found this session while verifying `bug-sheet-initiative-seam-resurrects-rider-conditions` (playbook §5 "Rider-condition seam-clear lane truth"):
- `loadEncounterToInitiative` (EB Join) sweeps `until:'combat'` entries board-wide (enforcement-gated) — a patrol joining mid-combat would wipe EXISTING creatures' combat-scoped zones/buffs. Ruling violation by construction.
- The `initiative-rolled` SSE/listener lane clears `dominated`-type entries + ladders on ANY initiative roll — if un-scoped, one creature's mid-combat re-roll frees dominated creatures elsewhere on the board.
- The victim-sheet lane (clears the roller) and the rest lanes (clear the resting character) are the CORRECT idiom — mirror, don't replace.

## Steps to reproduce

1. Live board-wide-sweep face (test-campaign): live board with creature A carrying a combat-scoped `until:'combat'` entry (enforcement on) and/or a `dominated` te on a monster; EB Join a fresh patrol monster → GET change-data: does A's entry vanish? (Expected per ruling: untouched.)
2. Live other-creature-roll face: creature A dominated / with rider conditions settled; creature B (not A) rolls initiative (its own sheet chip or GM-card roll) → A must keep its state. Reproduce whatever vanishes.
3. Ground every suspect lane in code first (`loadEncounterToInitiative`, `initiative-rolled` listeners, `clearAllExpirationEffects` callers) — some lanes may already be roller-scoped; prove each with a live face or code+test bytes either way.

## Expected behavior

Per ruling: initiative roll / short rest / long rest clear ONLY the rolling/resting creature's combat state. EB Join clears nothing belonging to already-present creatures. Board-wide roll-for-all = union of individual rolls (each roller cleared, non-rollers untouched).

## Likely location

- `src/services/encounters/encounterToInitiative.js` (`loadEncounterToInitiative` combat-scoped sweep)
- `initiative-rolled` event listeners (dominated/ladder clears — find all subscribers)
- Reference idiom: `src/services/rules/effects/clearAllExpirationEffects.js` per-creature entry (post-6aea00d8c)

## Suggested fix

Scope each seam clear to the roller/rest-actor (pass the creature identity through; mirror the per-creature `clearAllExpirationEffects(creature)` idiom). Remove/relocate EB Join's board-wide sweep for existing creatures (keep whatever per-joiner behavior is harmless). Log semantics of any clear preserved with event details. Dual-ruleset check. Re-pin affected tests; the per-creature law gets a regression pin per lane.

## Resolution

FIXED 2026-11-10. Outcome **FIXED** — per-lane red→green verified live in test-campaign (bytes below) + unit ledger green (34489 tests, 1 re-pin), lint zero, no-timers guard OK.

### Per-lane verdict (grounded in code + live bytes)

1. **EB Join / saved-load (`encounterToInitiative.js`) — VIOLATED.** Both `loadEncounterToInitiative` (unconditional) and `addMonstersToInitiative`'s fresh-board branch called `sweepNewCombatClocks` (ALL stores, `until:'combat'` filter). Live red: mid-combat Goblin+Wolf join did NOT trip the live-board branch (it was already scoped by the `else`), but the fresh-board branch + saved-load cleared absent-boards' clock owners. Fix: both `sweepNewCombatClocks` calls + import removed (joiners are fresh; present creatures untouched). Pending-OA drop (`clearAllPendingOas`) + `initiative-rolled` dispatch KEPT (both are the separate b570aa359 join-seam law).
2. **`initiative-rolled` consumer census (grep `addEventListener('initiative-rolled')`):**
   - `Initiative.jsx` listener — **VIOLATED**: looped `summary.creatures` clearing EVERY player's round latches + EVERY creature's dominated expirations + Hunter's Mark on any roll. Live red: another creature's Wolf-card initiative press wiped an unrelated ElderPaladin's `pendingExpirations` dominated entry + `activeBuffs` + persisted `Hunter's Mark` null. Fix: clear ONLY `e.detail.characterName`'s row; a detail-less dispatch (any join seam) clears NO creature; a roller absent from the board clears nobody. Campaign-level laws (`_Vex_appliedTarget`, `clearAllPendingOas`) stay unconditional (b570aa359/WM-008).
   - `CharSummary.jsx` wild-magic-surge — **VIOLATED**: `setSurgeEffects(null)` on any roll incl. detail-less. Live red (same-creature badge is correct target, but it also fired on foreign/join dispatches). Fix: clear only when `detail.characterName === playerStats.name`.
   - `useInitiativeEffects.js` — **PARTIAL VIOLATION**: gated to the roller (correct), but its `INITIATIVE_CLEARED_EFFECT_KEYS` te sweep was source-agnostic (board-wide across campaign `targetEffects`) and `restoreRegenerateTargets` swept `getAllStoreKeys()`. Live red: an EvasiveFighter own-roll cleared an unrelated ElderPaladin `blur` te row + Wild_Sage_Druid `sanctuary` te row + refilled AasimarTest regen HP. Fix: te rows filtered to roller-involving (source OR target); regenerate restore is the roller's own store only.
   - `BlindnessDeafnessModal.jsx` — **ALREADY COMPLIANT** (gates on `detail.characterName === attackerName`, roller-scoped). No change.
3. **Rest seams (`restRules-shortRest` / `-longRest`) — VIOLATED (collateral board-wide clears).** Live red: ElderPaladin's short rest logged `"Short rest: 3 combat-scoped effects ended (enforcement: zones)"` (characterName `Campaign`) — it swept AasimarTest's `until:'combat'` queue (via `sweepRestClocks`→`sweepCombatScopedExpirations({campaignName})` all-stores) + the resting char's rest cleared other stores' `blur`/`sanctuary`/`globe`/summon/realm te rows, foreign Regenerate flags/HP, foreign True-Polymorph summons/object-transforms, another druid's Wild Shape and hp_max_reduce drains. Fix: `sweepRestClocks(campaign, restKind, name)` → `ownerName`-scoped (actor log copy `"Short rest: X's N combat-scoped effect ended"`); every rest helper filtered to actor-involving rows (`te.target===actor || te.source===actor`; summons `summonedBy===actor`; transforms `polymorphSource===actor`; Wild Shape `source===actor`; regenerate/hp_max_reduce by actor name).
4. **`clearAllExpirationEffects` Sanctuary strip — VIOLATED** (a line inside the per-creature reference idiom): `te => te.effect !== 'sanctuary'` wiped the effect board-wide. Live red (shared with lane 2). Fix: scope to actor-involving rows.

### Correct idiom mirrored, not replaced
`clearAllExpirationEffects(creature)` (the 6aea00d8c write-order law) preserved verbatim; only the Sanctuary predicate was scoped (it was itself a board-wide leg). Rest/roll seams now all follow that victim/actor-scoped inbound pattern.

### Files changed
- `src/services/encounters/encounterToInitiative.js` (drop both board-wide sweeps + import)
- `src/components/initiative/Initiative.jsx` (roller-only listener clears)
- `src/components/char-sheet/char-summary/CharSummary.jsx` (own-roll surge clear; +`utils` import)
- `src/components/char-sheet/useInitiativeEffects.js` (roller-involving te sweep; roller-only regen restore)
- `src/services/rules/effects/clearAllExpirationEffects.js` (Sanctuary scoped to actor)
- `src/services/rules/effects/zoneDurationClock.js` (`sweepRestClocks` ownerName-scoped + actor log copy; `sweepNewCombatClocks` copy → "Combat board cleared")
- `src/services/rules/effects/restRules-shortRest.js`, `.../restRules-longRest.js` (every helper actor-scoped; +`utils` imports)

### Tests
New: `src/services/encounters/encounterToInitiative.per-creature-seam.test.js` (join lanes sweep nobody — live-board + fresh-board + saved-load — non-vacuous real-`sweepNewCombatClocks` contrast, actor-scoped `sweepRestClocks`). Re-pinned (old board-wide design → per-creature law): `initiative-init-rolled-handler.test.jsx` (+ detail-less-join-clears-nobody, absent-roller clears nobody, foreign-dominated-queue survives), `CharSummary-EventHandlers.test.jsx` (+ foreign/join keeps badge), `useInitiativeEffects.effectClearing.test.js` (+ roller-only regen), `useInitiativeEffects.invisibilityRegen.test.js`, `zoneDurationClock.test.js`, `clearAllExpirationEffects_rest_cleanup.test.js`, `restRules-shortRest.test.js`, `restRules-longRest.test.js`, `restRules-longRest-special.test.js`, `handlePlainDamage.ma1489-life-drain.test.js` (source-read pin now `(campaignName, name)`).

### Live evidence (test-campaign, closed-tab two-pass admin clears at entry & exit)
- **Face A (EB Join):** Goblin + Wolf join, live-board branch — ElderPaladin/AasimarTest `pendingExpirations`/`activeConditions`/`activeBuffs`/`targetEffects`/`regenerateActive` byte-UNTOUCHED; zero `combat-scoped` log rows. Fresh-board + saved-load faces proven by unit (UI auto-navigates with a settled board present); non-vacuity: real `sweepNewCombatClocks` on the SAME seed evicts 2.
- **Face B (foreign roll):** EvasiveFighter own sheet Initiative roll — its cs initiative stamped 18; unrelated ElderPaladin `blur`+`sanctuary` te rows, `regenerateActive:true`, hp 20, 2 expirations ALL survive (pre-fix vanished); AasimarTest `barkskin` survives.
- **Face C (in-view GM-card roll):** Initiative mounted, Wolf `[data-kind="initiative"]` "+2 (12)" press (detail Wolf) — ElderPaladin dominated queue + finite rider + `activeBuffs` + persisted `Hunter's Mark` all survive (pre-fix wiped).
- **Face D (short rest):** ElderPaladin short rest — own combat clock gone, `activeConditions:[]`, regen false; AasimarTest `until:'combat'` queue SURVIVES; log `"Short rest: ElderPaladin's 1 combat-scoped effect ended"` characterName ElderPaladin (pre-fix: characterName `Campaign`, swept AasimarTest too).
- **Face E (own roll still self-clears):** ElderPaladin own Initiative roll clears its own `pendingExpirations`→`[]` + `activeConditions`→`[]` while another creature's clock survives (6aea00d8c regression holds).

### Dual-ruleset
No `*2024*` twins under `rules/effects` or `char-sheet/useInitiativeEffects`; seam-clear is ruleset-agnostic engine code (one implementation). Verified via glob.
