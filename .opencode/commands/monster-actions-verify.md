---
name: monster-actions-verify
description: Work through docs/monster-actions-manifest.json, verifying one monster action per subagent against its own description.
---

You are the primary agent verifying **monster actions** against `docs/monster-actions-manifest.json`. You do not verify actions yourself — you dispatch each unverified row to a single subagent, one at a time.

The manifest is generated from `public/data/monsters.json` by `scripts/generate-monster-actions-manifest.mjs`. Each row is one monster action/reaction/legendary/lair entry with its authored numbers (`attackBonus`, `saveDc`, `saveType`, damage dice, `recharge`, `trigger`) and its verbatim `description` as the thing to match. The row also carries an `actionType` (`attack`, `save`, `aoe-save`, `attack+save`, `condition`, `multiattack`, `spellcasting`, `other`) that tells the subagent which resolution path to exercise.

**CRITICAL: Before a subagent declares a row "cannot test" or "setup gap," it MUST actually attempt to set it up. Monster actions are GM-driven — you drive them yourself from the monster card.** The recurring failure modes:

1. **Wrong monster name:** Encounter Builder searches `public/data/monsters.json` (there is NO `2024/monsters.json` — monsters are shared). Use the exact `monster` value from the row. Quantity-suffixed creatures appear in initiative as "Goblin 1", "Goblin 2".
2. **Monsters join initiative only via "Join Encounter"** in the Encounter Builder (`addMonstersToInitiative`) — the "+ NPC" button on the Initiative view adds a *campaign NPC*, not a database monster. Read `docs/test-setup-playbook.md` for the join recipe.
3. **No target set:** a monster attack/save does nothing until the GM selects a target on the monster's CreatureCard (sets `targetName`); `getTargetFromAttacker` then resolves it. Always pick a target before clicking the action.
4. **GM features are localhost-only:** run the app on localhost or the monster card / encounter tools are read-only.
5. **Caching blame:** edits persist through in-memory cache with ~10s debounce (`changeData.js`). If a change seems not to take, wait 15+ seconds / reload / clear cache via Admin — do NOT blame caching as a reason to stop.
6. **AC/DC numbers are authored, not derived:** `attack_bonus` and `save_dc` are literal in `monsters.json`; the app uses them directly. When the row's number disagrees with its own description text, that is a data bug — file it, don't "fix the expectation."
7. **Caster-merged summons verify via the CAST path, not EB-direct:** creatures that exist in RAW only through a player's spell or ability (Animate Objects constructs, Bestial/Draconic/Fey/etc. spirits via Summon Beast & kin, summoned undead via Animate Dead, Wild Shape forms) get the caster's stats MERGED at cast time — `automation.type:"summon_spirit"` (and friends) route through `summonSpiritHandler.resolveMonsterActions`, which folds `spellAbilities.toHit`/`modifier`/ability mods into the spawned combatant (backfilled numeric `attack_bonus`, resolved dice tokens, sign-normalized). So: search spells.json for the monster's `monsterIndex` appearing in a spell's `automation.variants` — if it does, VERIFY by having a caster PC cast that spell (add it to a test caster's spellbook in test-campaign if needed), open the MERGED combatant's card in MonsterCardModal, and exercise its chips there. An EB-direct-joined flat instance of such a monster has NO caster context and its dynamic-token rows (`"+spell attack modifier"`, `"WIS modifier"`) are HONESTLY SUPPRESSED by design (MA-0286 gate) — that is NOT a FAIL. Record the cast-path result; note the EB-direct inertness as by-design in the bug file's Notes if you mention it at all.

This list is a floor, not a ceiling: when a subagent hits a new monster-testing pitfall, it goes back into this list (step 3f) so the next one doesn't rediscover it.

## Verdict rules (STRICT trichotomy)

Every run lands on exactly PASS / FAIL / INCOMPLETE. No fourth bucket; "incomplete" is NOT a soft landing for unimplemented mechanics:

1. **PASS** — the action resolved and behaved exactly as the row's `description`/numbers specify (a documented PASS-subset only when the implemented core is exact and every gap is reported with grep/control evidence).
2. **FAIL (bug)** — EITHER (a) it triggered but resolved wrong (wrong to-hit vs AC, wrong DC, wrong damage dice, half-damage not applied on a save success, condition not applied on a failed save, immunity ignored, multiattack grants the wrong number of attacks), OR (b) **the mechanic is not implemented at all**: clicking produces no popup/roll/log, the row's number is inert, or a control probe shows zero observable delta. **Recharge / limited `uses` / legendary-use tracking that is display-only text with no enforcement is a real, expected FAIL** here — record it honestly (grep the resolution files to prove no consumer, plus the live control probe). A half-implementation that works but ignores a rule gate (fires on a save success, skips the DC check) is FAIL too.
3. **INCOMPLETE** — ONLY when the subagent genuinely cannot build the scenario through existing UI after exhausting the pitfalls above: the monster doesn't exist in `monsters.json`, the trigger state is physically unreachable (e.g. a reaction whose trigger the app cannot simulate), or the description is so ambiguous it cannot be judged. It must name the ONE concrete blocker — never "the mechanic seems unimplemented" (that is FAIL).

**Summon variants (pitfall 7):** for a monster whose `monsterIndex` appears in a spell's `automation.variants`, PASS/FAIL is judged on the CAST path — the merged combatant produced when a caster PC casts the spell. Zero affordance on an EB-direct-joined flat copy of a caster-dependent creature (dynamic `"+spell attack modifier"` tokens honestly suppressed, MA-0286) is BY DESIGN — never file it as FAIL.

If a run dies without a verdict (memory guard, crash, timeout), the row goes back to `"not verified"` and its ID onto `.opencode/plans/queue.txt` — that is a failed attempt, not incomplete.

If a row's `description` contradicts canonical app/PHB data and the GM supplies canonical wording, fix the row's `actionName`/`description`/numbers in the manifest when recording the verdict and cite the canonical text in the bug file.

## Support files (create if they don't exist)

- `docs/test-setup-playbook.md` — accumulated known-good recipes ("how to put a specific monster into initiative," "how to force a monster failed saving throw," "how to line up two targets for an AoE cone") **and** the pitfalls list above. This is the SAME playbook automations-verify maintains — append monster recipes to it, don't fork it.
- `docs/test-monster-registry.json` — monsters already added to `test-campaign` initiative keyed by monster name, with the config each test needed (targets, CR, any edits), so reuse is a lookup not a rebuild.

## Primary agent steps

1. Kill all running processes for this project: `pkill -9 -f "node.*server" 2>/dev/null; pkill -9 -f "vite" 2>/dev/null; pkill -9 -f "concurrently" 2>/dev/null; pkill -9 -f "dnd-campaign" 2>/dev/null; echo "all killed"`
2. Read `docs/monster-actions-manifest.json`. Your queue is every row whose `verified` is `"not verified"`. Also read `docs/test-setup-playbook.md` and `docs/test-monster-registry.json` if present (create empty versions if not) — you pass both to each subagent. If the manifest doesn't exist, run `node scripts/generate-monster-actions-manifest.mjs` first.
3. For each row, one at a time (ONE subagent at a time — memory conservation matters more than speed):

   a. Dispatch a subagent (template below) with the single row's full details (id, monster, actionName, actionType, category, all numbers, description) plus the current playbook (including pitfalls) and monster registry. Do not give it the rest of the manifest.

   b. Wait for it to return.

   c. Immediately update that row's `verified` field in `docs/monster-actions-manifest.json` on disk — `"verified"` / `"broken — see .opencode/plans/bug-mon-<id>-<slug>.md"` / `"incomplete — see .opencode/plans/incomplete-mon-<id>-<slug>.md"`. Write to disk right away; never batch to the end, so an interrupted run still reflects every completed row. **If it crashed/aborted without a verdict, set the row back to `"not verified"` and re-append its id to `.opencode/plans/queue.txt` — do not mark incomplete.**

   d. **If the subagent reports a monster newly placed into `test-campaign`,** record it in `docs/test-monster-registry.json` now, before the next row.

   e. **If it reports a new playbook recipe or a new pitfall** that cost real time, append it to `docs/test-setup-playbook.md` now.

   f. **If a row comes back "incomplete":** check it against the verdict rules first. If its stated reason is that the mechanic is unimplemented / inert / has no consumer / the control probe shows zero delta — that is FAIL: convert the row to `"broken — see .opencode/plans/bug-mon-<id>-<slug>.md"` yourself (write the bug file from the report's evidence, keep design notes in its Notes section) and delete the incomplete file. Only genuine setup-blocked incompletes proceed: re-dispatch exactly once with the same inputs plus its blocker note prepended. If the retry is also incomplete, leave it `"incomplete — needs manual setup — see ..."` and move on. Do not retry a third time — that's a signal it needs a human.

   g. After every status write, keep `.opencode/plans/queue.txt` in sync by regenerating it from the manifest's remaining `"not verified"` ids.

4. When the queue is empty, regenerate `.opencode/plans/queue.txt` as the final handoff and report totals: verified, broken, incomplete (needs manual setup).

---

## Subagent task (given one monster action at a time)

You are verifying a single monster action: `{row_details}`

You are given the current **setup playbook** (with known pitfalls) and **monster registry** — read both before anything else.

**All interaction with the running app is through Playwright MCP.** This is a strict end-to-end test — editing save files or hitting APIs directly invalidates the test. Static file reads (`monsters.json`, source) are allowed only for the cheap orientation checks in step 1.

### Step 1 — Orient + static data check (cheap, do first)

1. Check the monster registry / playbook for this monster or action type; reuse and follow a recipe if one exists.
2. Open the monster's entry in `public/data/monsters.json` and confirm the row's numbers. Run the **data-vs-description consistency checks** and record the result — a mismatch here is itself a FAIL (data bug against `monsters.json`), even before touching the UI:
   - `attack`: authored `attackBonus` should equal the monster's `proficiency_bonus` + the relevant `ability_score_modifiers` entry, and should match the number in the description text ("Melee Weapon Attack: +9").
   - `save` / `aoe-save` / `attack+save`: `saveDc` matches the "DC N" in the description; `saveType` matches "X Saving Throw"; damage dice (`damageDicePrimary`/`Secondary`) match the dice written in the description; `saveEffect` text is consistent with the described condition/damage.
   - `multiattack`: the component attacks it names actually exist on the monster and the counts match.
   - `spellcasting`: `saveDc` matches the described spell save DC.
   - `recharge`/`uses`: the "(Recharge 5-6)" / "(2/Day)" in the name/description matches the authored field.
3. Skim the relevant resolution file (per the row's `actionType`): `MonsterCardModal.jsx` (`handleAttack` / `handleSaveRoll`), `useLoggedDiceRollAttack.js`, `hitResolution.js` (`computeEffectiveAc` → `hit = d20 + bonus >= AC`), `saveProcessing.js` (`processNpcSave` / `processPlayerSave`, half-damage, `applyFailedSaveConditions`), `applyDamage.js`. This is where pitfalls get caught before they cost clicks.

### Step 2 — Build the scenario (via Playwright MCP)

1. Launch the app on localhost, select `test-campaign`.
2. Encounter Builder → search the exact `monster` name → set quantity (2+ when the action needs multiple targets, e.g. an AoE that must catch more than one) → **Join Encounter** so the monster(s) land in initiative.
3. Ensure at least one player character (or campaign NPC) is present to act as the target. Reuse one from the registry.
4. On the Initiative view, select the monster as the active creature, then **set its target** (the card target selector → `targetName`). For AoE/save rows, arrange the required number of targets.
5. **Checkpoint:** one line to `.opencode/plans/checkpoint-mon-<id>.md` — the exact creature names now in initiative and the chosen target. Cheap insurance against compaction.

### Step 3 — Trigger the action (via Playwright MCP)

Open the monster's stat card (click the monster in Initiative/Map → `MonsterCardModal`), then click the action's dice link for its type:
- `attack` / `attack+save`: click the `+{attackBonus}` link (fa-dice-d20) in the action row.
- `save` / `aoe-save` / `condition`: click the `DC {saveDc} {saveType}` (or its dice) link → resolves the target's save (or GM Quick-Roll for a player target).
- `multiattack`: exercise each component attack the description grants.
- `recharge`: trigger twice in one fight to observe whether the recharge gate is enforced at all.

### Step 4 — Verify against the description (via Playwright MCP + log)

Inspect the AttackResultPopup AND the Campaign Log (`.log-entry`). Confirm behavior matches the row EXACTLY — not just "something happened":
- `attack`: to-hit = d20 + `attackBonus`; `hit` flips correctly across the target's effective AC; crit doubles dice; popup auto-damage rolls `damageDicePrimary` (+ `damageDiceSecondary`), and the target's HP drops by the rolled damage (respecting resistances/immunities).
- `save` / `aoe-save`: the enforced DC equals `saveDc`; the save type equals `saveType`; **failed save = full damage / full effect, successful save = half damage (or none, per description)**; every target in range is affected.
- `attack+save`: both halves independently correct.
- `condition` / any row with a `saveEffect`: on a failed save the named condition is applied to the target (visible in `activeConditions` + a `condition` log entry) and immunity is respected.
- `multiattack`: the exact number of attacks described is available/rolled.
- `spellcasting`: spells listed / DC matches the row.
- `recharge` / `uses`: **if the app does not gate second use or roll a recovery die, that is a FAIL — record it** (grep `MonsterCardModal.jsx`/`saveProcessing.js` for any consumer of `recharge`/`uses`, plus the live second-attempt probe showing zero delta).

Close-but-not-exact counts as a bug, not a pass.

### Outcomes

**PASS:** return `"VERIFIED: PASS"` with brief evidence (the rolled values, hit/miss vs AC, DC enforced, damage applied, condition applied, matching log entries), plus any new playbook recipe (the monster/target combination + exact steps that worked) and any new registry entry (monster name + what it was configured to test).

**FAIL (both flavors are bugs):** (a) it triggered but resolved wrong, or (b) **it is not implemented at all** — clicking the dice link produces no popup/roll/log, the number is inert, or a control probe (e.g. a second use of a "recharge" action, or a save that should be half-damage but isn't) shows zero observable delta. Prove it cheaply: grep the resolution files for consumers + one live control probe, record both. Write `.opencode/plans/bug-mon-<id>-<slug>.md` with sections: Title, Overview, Expected Behavior (quote the row's `description` + `monsters.json` numbers), Actual Behavior, Steps to Reproduce, Likely Location (which layer — `monsters.json` data drift vs the resolution files: `MonsterCardModal.jsx` / `hitResolution.js` / `saveProcessing.js` / `applyDamage.js` / `MonsterCardHelpers.js`), Notes. **Read it back with the Read tool to confirm it persisted** before returning. Do not return FAIL until the file is on disk.

**INCOMPLETE — setup-only, last resort:** ONLY after exhausting the pitfalls: a monster not in `monsters.json`, a physically unreachable trigger state (a reaction/legendary action the app has no way to reach), or a description too ambiguous to judge. Name the ONE concrete blocker. "The mechanic appears unimplemented / no consumer" is NOT incomplete — that is FAIL; grep + control-probe it and file the bug. Write `.opencode/plans/incomplete-mon-<id>-<slug>.md` (what you tried, which pitfalls you ruled out, where it stalled, what would unblock it), read it back, then return `"VERIFIED: INCOMPLETE"` with the path.

### Scope

Only mutate data inside `test-campaign`. Clean up after testing: clear the change-data cache and campaign log via the Admin panel.

---

## Worked example — MA-0031 "Cold Breath (Recharge 6)" (aoe-save)

**Row:** monster Abominable Yeti · actionType `aoe-save` · saveDc 18 · saveType Constitution · damageDicePrimary `10d8` Cold · description: "Constitution Saving Throw: DC 18, each creature in a 30-foot cone. Failure: 45 (10d8) Cold damage. Success: Half damage."

**Step 1:** `monsters.json` shows Yeti `spellcasting_ability`/ability mods → confirm authored `save_dc` 18 = the "DC 18" text and `10d8` matches. Any drift = FAIL(data).

**Step 2:** Encounter Builder → "Abominable Yeti" ×1 → Join Encounter; put 2+ characters in initiative; select the Yeti, line up targets for a cone (or use a single target and note the cone limitation).

**Step 3:** Open Yeti card → click the `DC 18 Constitution` link for Cold Breath.

**Step 4:** Confirm DC enforced is 18 vs each target's Constitution save; failed save takes full 10d8 Cold (rolled value), successful save takes exactly half; HP drops via `applyDamage.js`; log shows the save + damage entries. Then attempt Cold Breath again same fight with no recharge — if it fires again with no recharge gate/recovery die, that is a documented FAIL for the recharge part.

**Outcome:** PASS (recipe + registry) / FAIL (bug file: data drift, wrong DC, half-damage not applied, or recharge unimplemented — grep + probe) / INCOMPLETE ONLY if the cone scenario truly cannot be built after trying the known fixes.
