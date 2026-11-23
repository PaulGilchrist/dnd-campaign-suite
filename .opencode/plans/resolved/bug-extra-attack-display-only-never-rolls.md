# Extra Attack is display-only — a weapon press never rolls more than one attack (both rulesets)

### Summary
Every Fighter/Paladin/Ranger sheet above level 4 displays a prominent “Extra Attacks: N” resource line, but the attack pipeline never consumes it: one weapon-row press commits exactly one attack roll, one damage row, one log row — at level 6 (5e) and at level 18 (2024, where Extra Attack should scale to 3 extra swings). The Extra Attack class feature has no runtime effect anywhere in the game.

### Steps to reproduce
Both rides were run live on 2026-11-23 in `test-campaign` (dev pair, :5173, CAMPAIGN_LOCK set).

Leg A — real 5e fixture:
1. Enter `test-campaign`, go to Initiative, click `+ Monster`, search `Goblin`, spawn 1 (real 7/7, AC 15).
2. On the board, arm `select[aria-label="FixtureFighter5e target"]` → `Goblin`.
3. Open the FixtureFighter5e sheet (sidebar Characters → FixtureFighter5e). The summary shows **`Extra Attacks: 1`** (plus Action Surge 1/1, Second Wind 1/1).
4. Click the `Longsword` row (`div.left.clickable` in the Actions table).
5. The `.popup-modal` stages ONE roll: `d20 8 +6 (+6 to hit) → 14 | ✗ MISS (14 vs AC 15)`. Press `Done`.
6. Observe: the popup closes, no second popup appears, and `/api/campaigns/test-campaign/log` grows by exactly ONE row: `FixtureFighter5e attacks Goblin with Longsword: 8 +6 (+6 to hit) vs AC 15 — MISS`.

Leg B — 2024 control (EvasiveFighter, level 18 Fighter/Battle Master):
1. Arm `select[aria-label="EvasiveFighter target"]` → `Goblin`.
2. Open the EvasiveFighter sheet, click the `Glaive` row.
3. One popup, one roll (`d20 17 +9 → 26 HIT`); `Done` commits one damage row (`1d10+3 …`) and one `roll` + one `hp_change` row. Goblin 7→0. No second (or third/fourth) attack popup follows.

### Expected behavior
At level ≥ 5 the Attack action makes more than one weapon attack. The engine models this elsewhere already — the `lastCombatResult.attackEvidence` stamp captured during Leg B carries `d20Rolls: [17, 17]` (a multi-roll ARRAY), so the wire format anticipates multiple rolls. At minimum, a lv6 5e Fighter press should stage/commit 2 attacks; a lv18 2024 Fighter up to 4.

### Actual behavior
One d20, one row, one damage commit per press, in both rulesets. The `Extra Attacks: N` sheet line is pure decoration. There is also no gating that would represent “the Attack action” being spent — pressing the row again is just another single attack, so the multi-attack concept is absent, not batched.

Console/network: no errors, no extra requests — the second attack is simply never produced.

### Likely location
Confident (grep census): `extraAttacks` has exactly three consumer families, none of them the attack chain:
- `src/services/character/classRules.js:142` / `:210` and `classRules2024.js:309` / `:374` — compute `extraAttacks = level > 4 ? 1 : 0` (note: a flat 1 even at lv11/17, so the DISPLAY is also wrong for high-level fighters; EvasiveFighter lv18 shows the same flat count).
- `src/components/char-sheet/char-summary/CharClassFeatures.jsx:76/544/615` — sheet display rows.
- `src/services/combat/automation/automationInfoBuilder/attack.js:215/:235` — only reads `auto.extraAttacks` from features that DECLARE `bonus_attacks`/`dual_wielder_attack` automation (Flurry-style payloads), never the class-level Extra Attack.
`src/services/rules/rules-actions.js` defines single weapon action rows (no `attacks` multiplicity), and no file in `src/services/combat/` (actionPipeline, steps/attackRoll*) references extra attacks.

### Suggested fix
Decide the product behavior first (this is a feature gap dressed as a resource line):
1. Simplest honest option while unbuilt: stop rendering “Extra Attacks: N” as a resource line (or relabel it info-only), so the sheet doesn’t promise a mechanic the engine lacks.
2. Full option: in the sheet/monster attack lane, loop the attack-roll steps `1 + extraAttacks` times (the evidence format already supports `d20Rolls[]`), staging one popup per swing or one multi-roll popup, per-turn action budget gated. Start at `src/services/combat/actionPipeline.js` + the sheet attack handler in `src/components/char-sheet/` (the `div.left.clickable` press path) and fix the lv11/17 scaling in `classRules*.js` at the same time.

### Severity
Broken feature — a flagship class feature is advertised on every martial sheet but does zero at runtime; damage output is ~half (or worse) of what the ruleset the character claims to use specifies.

## Resolution

FIX: FIXED (owner decision 2026-11-23 = full option: multi-swing staging, per-turn budget gate, canonical scaling table).

### What was actually wrong
- Confirmed core defect: the sheet press lane (`handleAttackClick` → `rollAttack` → staged `.popup-modal`) never consumed the class-level Extra Attack; every press committed exactly one attack in both rulesets.
- The bug file's "fix the lv11/17 scaling in classRules*.js" premise was partially wrong: those flat `level > 4 ? 1 : 0` values are the PALADIN/RANGER getters, and flat-1 is canonical for them (they never scale). Fighter never flowed through classRules — its display lane (`CharClassFeatures.jsx computeExtraAttacksMax/monkExtraAttacks/barbarianRageScaling2024`) already reads the canonical `extra_attacks` table columns. Live-verified post-triage: EvasiveFighter (lv18 2024) displays `Extra Attacks: 2` (the bug file's "flat display" claim was misattributed).
- Ground-truth correction (canonical app data wins over the bug text): BOTH `public/data/classes.json` (5e, nested under `class_specific`) and `public/data/2024/classes.json` (top-level column) scale Fighter 1 extra @lv5, 2 @lv11, 3 @lv20 — NOT lv17 (the fourth attack lands at lv20 in both rulesets per the app's tables). A lv18 2024 Fighter therefore stages 3 attacks per press, not 4.

### Changes
- NEW `src/services/character/extraAttacks.js` — single runtime source: `getExtraAttacks(playerStats)` (table read per ruleset shape, flat lv5+1 fallback for Barbarian/Monk/Paladin/Ranger whose 5e tables carry no column) and `isExtraAttackEligibleRow` (Action-type weapon rows only; excludes Bonus Action rows so Flurry/off-hand `bonus_attacks` never double-fire, save-based rows, Psychic Blade rows, and spell rows).
- NEW `src/components/char-sheet/useExtraAttackChain.js` — stages one `.popup-modal` per swing sequentially. A swing resolves when the sheet's dwell surface fully drains (popup host + sheet modals + rider-chain save prompts — the same surface the attack-row dwell dim and `damageApplied` auto-retire effect already model). A staged HIT's Done dispatches `dice-roll-done` before closing, so the wait extends across the commit faces (damage popup / Charge chooser / Shield Bash prompt) — the next swing's popup never races or lands under the previous swing's damage result. Logs one `automation/extra_attack` row per granted Attack action; every swing keeps its own `roll`/damage/`hp_change` rows and full rider chain.
- `useCharActionsAttackHandlers.js` — the five duplicated press-roll blocks collapsed into one `stageAttackRoll` seam that arms the chain then rolls swing 1 (chooser confirm/cancel paths included; the per-turn action bucket charge at press is unchanged).
- `CharActions.jsx` — wires the chain hook; `chainPromptArmed` predicate lifted to a shared memo (one owner for the auto-retire + chain watcher).
- `AttackResultPopup.jsx` — the Cancel-staged-damage lane now also dispatches `attack-staged-cancelled` (window bus, sibling of `dice-roll-done`); the chain drops its queued swings on it.
- Per-turn budget: runtime-store latch `_extraAttackGrantedTurn` `{round, activeCreature}` (CLA-044 latch shape) — Extra Attack swings are granted once per turn; re-pressing the row the same turn rolls a single attack and logs nothing new. With enforcement/actionEconomy ON, `assertCanAct`'s spent action bucket refuses the re-press outright. Out of combat there is no turn budget, so presses grant (no latch stamped).

### Verification
- Live re-ride in `test-campaign` (:5173, dev pair), post-fix:
  - Leg A `FixtureFighter5e` (lv6 5e): press stages 2 attacks (to-hit popup → damage face → dismiss → swing-2 popup auto-staged; no third). Log: one `extra_attack` row + per-swing roll/damage/hp rows. Re-press same turn → single attack, no new row.
  - Leg B `EvasiveFighter` (lv18 2024): press stages 3 attacks (attacks 17/15/19, damage 11/10/16, hp_change per swing) with Studied Attacks advantage + Shield Bash prompt + Charge chooser riding normally (same-chain doctrine held, incl. prompt vs corpse on the earlier dead-target walk). Re-press same turn → single attack.
  - Controls: `ElderPaladin` (2024 Paladin lv20, flat fallback = 1 extra): 2 swings, one damage row per swing on a healthy target (120→105→95) — one-row-per-attack invariant intact; `Disciplined_Monk`: 2 swings. Bonus-action lanes untouched (BA rows excluded by eligibility — unit-pinned).
- New tests (all passing): `src/services/character/extraAttacks.test.js` (39 — incl. canonical-table round-trip pins for both rulesets), `src/components/char-sheet/useExtraAttackChain.test.jsx` (13 — staging, commit-race bridge, rider/modal/prompt holds, cancel drop, budget latch + round re-arm, off-turn continuation), `src/components/char-sheet/useCharActionsAttackHandlers.extraAttack.test.js` (5 — press seam arms once per allowed press, denied presses arm nothing).
- Touched-area run: 749 files / 7521 tests pass. `npm run lint`: zero warnings. `no-timers-guard`: OK (no timers added). Full suite: 3538/3542 files; the 2 `server/services/ai/authoring/{party,storyBible}.test.js` failures are PRE-EXISTING (live-roster pin 13 vs 14 since the permanent `FixtureFighter5e` fixture, d709198ef) and 2 observed flakes (`AiDressButton`, `PolymorphSelectionModal.focus`) pass in isolation — none related to this change.
- Closeout: Admin cleared change-data + campaign log for `test-campaign` (exit state `{}` / `[]`).

### Note for the map
Priority-target row "after any Extra-Attack decision, re-ride the weapon press expecting N>1 roll" — SATISFIED live (ZA follow-up). The Known-Quirks bullet "Extra Attack is display-only" (ZA era) is DEAD — the display was already scaling for Fighter; the runtime now consumes it.
