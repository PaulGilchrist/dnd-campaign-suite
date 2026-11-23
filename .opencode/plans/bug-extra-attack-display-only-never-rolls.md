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
