---
name: automations-verify
description: work through docs/automations-manifest.json, verifying one automation per subagent.
---

You are the primary agent verifying combat automations against `docs/automations-manifest.json`. You do not verify automations yourself — you dispatch each unverified row to a single subagent, one at a time.

**CRITICAL: Before a subagent declares an automation a "setup gap" or "cannot test," it MUST actually attempt to fix the setup. Common failures from past runs:**
1. **Premature "setup gap" declaration:** Never claim a character can't cast a spell without first reading `public/data/2024/spells.json` or `public/data/spells.json` to verify which classes actually have access. Many past "setup gaps" were AI errors — Dominate Beast is a Druid/Sorcerer spell, not Bard-only; Hunter's Mark is a Ranger spell, not unavailable.
2. **Wrong spell class attribution:** Always verify spell class lists from the JSON data files before claiming a character class can't use a spell. Check both `public/data/` (5e) and `public/data/2024/` (2024 ruleset) paths.
3. **Server caching blame without evidence:** The server uses in-memory caching with 10s debounce (`changeData.js`). If character edits don't appear to take effect, wait 15+ seconds, reload, or use the Admin panel to clear the cache. Do NOT claim "server caching is blocking" as a reason to give up — this was a past AI mistake when the real issue was the client failing to POST the updated data.
4. **Wrong target type:** If a spell rejects a target type, add the correct type of NPC using the Encounter Builder rather than claiming the test cannot proceed.
5. **Level requirements:** Check spell slot levels — 6th level spells require at least level 13 characters. Don't try to cast 6th-level spells on level 9 characters.
6. **Monsters join initiative only via "Join Encounter":** Encounter Builder → search the exact monster name → tick the row checkbox → "Join Encounter". The "+ NPC" button on the Initiative view adds a *bare statless campaign NPC*, not a database monster. Quantity-suffixed creatures appear in initiative as "Goblin 1", "Goblin 2".
7. **GM features are localhost-only:** the Encounter Builder, creature cards, and encounter tools are read-only off localhost. Run the app on localhost before building any scenario.
8. **Caster-merged summons verify via the CAST path, not EB-direct:** summon-type spell automations (`summon_spirit`: Animate Objects, Summon Beast & kin, …) spawn a combatant whose stats are the caster's MERGED at cast time. Verify by having the caster PC cast the spell and exercising the merged combatant's card. A flat instance of such a creature joined directly via the Encounter Builder has NO caster context and its dynamic rows are HONESTLY SUPPRESSED by design (MA-0286) — that is NOT a FAIL.
9. **The monster must also have a target set:** when a monster forces a save on a character, arm the target on the monster's own card (`targetName`) — an unarmed monster's roll hangs forever, no "vs AC", no damage.

This list exists because subagents kept giving up on fixable problems. Treat it as a floor, not a ceiling: when a subagent finds a new pitfall like these, it goes back into this list (see step 3f below) so the next subagent doesn't rediscover it the hard way.

## Verdict rules (STRICT trichotomy — GM directive, 2026-09-02)

Every subagent run must land on exactly one of PASS / FAIL / INCOMPLETE. There is no fourth bucket, and "incomplete" is NOT a soft landing for unimplemented features:

1. **PASS** — the automation triggered and behaved exactly as specified (a documented PASS-subset is allowed only when the implemented core is exact and every gap is explicitly reported with grep/control evidence).
2. **FAIL (bug)** — EITHER (a) it triggered but behaved wrong, OR (b) **it is not implemented at all**: dead/inert feature row, plumbing collected with zero consumers, click produces no popup/keys/logs, or a control probe shows the feature grants zero observable delta. Unimplemented = BUG, not incomplete. A half-hardcoded implementation that works but ignores rule gates (e.g. fires on successes, skips proficiency checks) = BUG too.
3. **INCOMPLETE** — ONLY when the subagent genuinely cannot BUILD the scenario through existing UI even after exhausting the pitfalls checklist: the required monster/spell/state does not exist in any data file, the trigger state is physically unreachable in the app, or the expected behavior is so ambiguous it cannot be judged. It must name the ONE concrete thing that blocks setup — never "the feature seems unimplemented" (that is FAIL).

**Summon variants (pitfall 8):** for a summon-type spell automation, PASS/FAIL is judged on the CAST path — the merged combatant produced when the caster PC casts the spell. Zero affordance on an EB-direct-joined flat copy of a caster-dependent creature (dynamic `"+spell attack modifier"` tokens honestly suppressed, MA-0286) is BY DESIGN — never file it as FAIL.

If a run dies without a verdict (memory guard, crash, timeout), the row goes back to `"not verified"` and onto the queue for a fresh attempt — that is a failed attempt, not incomplete.

If the manifest row's wording contradicts canonical PHB/app data and the GM supplies canonical wording, fix the row's `name`/`triggerConditions`/`expectedBehavior` in the manifest when recording the verdict, and cite the canonical text in the bug file.

## Support files (create if they don't exist)

- `docs/test-setup-playbook.md` — accumulated known-good recipes ("how to build a 2024 Monk," "how to force a failed saving throw," "how to join an encounter with a specific monster") **and** the pitfalls list above. Grows over time as subagents succeed or get tripped up.
- `docs/test-character-registry.json` — list of existing test characters and NPCs already present in "test-campaign," keyed by class/subclass/race/subrace/feat/background (for characters) or name (for NPCs), so reuse is a lookup instead of a search.
- `docs/test-monster-registry.json` — monsters already in `test-campaign` initiative, keyed by monster name, with the config each test needed, so reuse is a lookup not a rebuild. The playbook above is SHARED with monster-actions-verify — append to it, don't fork it.

## Primary agent steps

1. Kill all running processes for this project: `pkill -9 -f "node.*server" 2>/dev/null; pkill -9 -f "vite" 2>/dev/null; pkill -9 -f "concurrently" 2>/dev/null; pkill -9 -f "dnd-campaign" 2>/dev/null; echo "all killed"`
2. Read `docs/automations-manifest.json`. Your queue is every row marked "not verified." Also read `docs/test-setup-playbook.md`, `docs/test-character-registry.json`, and `docs/test-monster-registry.json` if present (create empty versions if not) — you'll pass all three to each subagent.
3. For each row, one at a time:

   a. **Skip data-granting backgrounds:** If the entry is `type: "background"` and has `"data-granting only"` in its `notes` field, mark it as `"verified"` in the manifest and move to the next row — no subagent needed.

    b. Dispatch a subagent (task template below) with: the single automation's details (name, trigger conditions, source location), the current setup playbook (including the pitfalls list), and the current character and monster registries. Do not give it the rest of the manifest. We are in no rush; memory conservation matters more than speed.

   c. Wait for it to return.

    d. Immediately after the subagent returns, update that row's status in `docs/automations-manifest.json` on disk: `"verified"` / `"broken — see .opencode/plans/bug-<slug>.md"` / `"incomplete — see .opencode/plans/incomplete-<slug>.md"`. Write this change to the file right away — do not hold updates in memory and write them all at the end. If this run is interrupted, the file on disk should always reflect every row completed so far. **If the subagent crashed/aborted without a verdict (memory guard, timeout), set the row back to `"not verified"` and re-append its ID to `.opencode/plans/queue.txt` — do not mark it incomplete.**

    e. **If the subagent reports a new character/NPC** (whether created or reused-and-confirmed), record it in `docs/test-character-registry.json` now; **if it reports a monster newly placed into `test-campaign` initiative, record it in `docs/test-monster-registry.json`** — before moving to the next row.

   f. **If the subagent reports a new playbook recipe or a new pitfall it ran into** (something that cost it real time before it figured out the fix), append it to `docs/test-setup-playbook.md` now, so later rows in this same run — and future runs — benefit from it.

   g. **If a row comes back "incomplete":** FIRST check the incomplete-report against the verdict rules. If its stated reason is that the feature is unimplemented / has no consumer / is an inert row / a control probe shows zero delta — that is FAIL: convert the row to `"broken — see .opencode/plans/bug-<slug>.md"` yourself (write the bug file from the report's evidence; keep any design notes inside the bug file's Notes section) and delete the incomplete file. Only genuine setup-blocked incompletes proceed: re-dispatch exactly once more with the same inputs plus the note from its incomplete-report (what it got stuck on) prepended, so the retry doesn't repeat the same dead end. If the retry is *also* incomplete, leave it as `"incomplete — needs manual setup — see .opencode/plans/incomplete-<slug>.md"` and move on. Do not retry a third time automatically — that's a signal it genuinely needs a human, not more subagent time.

   h. Move to the next row. After every status write in this step, keep `.opencode/plans/queue.txt` in sync by regenerating it from the manifest's remaining `"not verified"` IDs.

4. When the queue is empty, regenerate `.opencode/plans/queue.txt` from the manifest as the final handoff, then report totals: verified, broken, incomplete (needs manual setup).

---

## Subagent task (given one automation at a time)

You are verifying a single combat automation: `{automation_details}`

You are given the current **setup playbook** (including known pitfalls), **character registry**, and **monster registry** — read all three before doing anything else.

**All interaction with the running app happens through Playwright MCP.** This is a strict end-to-end test — direct data manipulation (editing save files, hitting APIs directly, etc.) invalidates the test.

### Step 1 — Orient (cheap, do this first)

1. Check the character registry for an existing character/NPCs matching what this automation needs. Reuse them if found — don't rebuild from scratch. **"Matching" does NOT mean the character must already be set up correctly: EDIT an existing character's class/subclass/level/spells/feats/abilities via the Edit wizard to fit your test scenario.** Do NOT expect a player character to already be configured for the automation, and do NOT treat "existing character doesn't have the right subclass/feature/level" as a blocker — repurposing an existing character by editing it is the DEFAULT path (the campaign keeps exactly one character per class for exactly this reason; the registry note tells you its current config — change it as needed, and record the new config back when done).
2. Check the setup playbook for a recipe matching this trigger type or class/subclass/feat/background combination. Follow it instead of improvising if one exists.
3. If it's unclear exactly what to build or trigger, **read the source first** (the handler/router/infoBuilder files given in the automation details, and relevant files under `public/data/2024/`, e.g. `spells.json`, `monsters.json`) rather than guessing through the UI — it's far cheaper than trial-and-error clicking and usually tells you exactly what state is needed. This is also where most of the pitfalls above get caught before they cost you time.

### Step 2 — Build/confirm the scenario (via Playwright MCP)

1. In "test-campaign," EDIT an existing 2024 character (or create one only if the class doesn't exist at all) via the Edit wizard so it has the exact class/subclass/race/subrace/feat/background needed. Never assume an existing character is already configured correctly for the automation — open the Edit wizard and set it up yourself; never 5e.
2. Create or reuse any needed NPC creatures for combat/spell targeting tests via the Encounter Builder — check the monster registry first and reuse an already-joined monster when it fits. NPC monster names must match `public/data/monsters.json` exactly (there is NO `public/data/2024/monsters.json` — monsters are shared across both rulesets); check it rather than guessing a name.
3. If what you're given doesn't quite support the scenario (missing feature, wrong target type, wrong level), **fix it** — edit the character, add the right NPC, adjust level — rather than declaring incomplete. Run through the pitfalls checklist above first; most "can't test this" situations turn out to be one of those nine.
4. **Checkpoint:** write one line to `.opencode/plans/checkpoint-<automation-id>.md` — what character/NPCs now exist and their exact names. Cheap insurance if you get compacted after this point.

### Step 3 — Trigger the scenario (via Playwright MCP)

1. Set a target before attacking — click the target icon on the creature card. When a monster forces a save on a character, arm the target on the monster's card too (`targetName`) — an unarmed monster's roll hangs forever.
2. Trigger the specific situation named in the trigger conditions (the roll, action, or combat state). Click "Done" after attacks resolve — don't skip this step.
3. If edits don't seem to take effect, check the caching pitfall above (wait 15+ seconds / reload / clear cache via Admin panel) before assuming something is broken.

### Step 4 — Verify (via Playwright MCP)

Inspect the actual app state/UI after the trigger and confirm the automation's actual behavior matches the "Expected behavior" description exactly — not just that something happened, but that it matches (correct value, correct condition, correct timing). Close-but-not-exact counts as a bug, not a pass.

### Outcomes

**PASS:** Return `"VERIFIED: PASS"` with brief evidence, plus:
- Any new playbook recipe worth recording (what combination this was, the concrete steps that worked).
- Any new registry entry (character/NPC name + its defining traits) if you built something new.

**FAIL (two flavors, both are bugs):** (a) automation behaved wrong although you triggered it, or (b) **the automation is not implemented at all** — inert/dead feature row, data collected with no consumer, click produces no popup/keys/logs, or a control probe (non-holder gets identical behavior) shows zero observable delta; a half-hardcoded feature that works but ignores rule gates (fires on successes, skips proficiency/DC checks) also counts. Prove it cheaply: grep the source for consumers + one live control probe, and record both in the bug file. Write a bug file to `.opencode/plans/bug-<id>-<slug>.md` using the Write tool, with sections: Title, Overview, Expected Behavior (quote canonical PHB/app-data wording), Actual Behavior, Steps to Reproduce, Likely Location (use the manifest source locations — or the real files you found, noting stale manifest paths), Notes (include any "needs design" options). **Read it back with the Read tool to confirm it persisted** before returning — if the read fails, write and verify again. Do not return `"VERIFIED: FAIL"` until the bug file is confirmed on disk.

**INCOMPLETE — setup-only, last resort:** This bucket exists ONLY for scenarios you genuinely cannot construct through the existing UI after exhausting the pitfalls checklist: a required monster/spell/state that does not exist in ANY data file, a physically unreachable trigger state, or expected behavior so ambiguous it cannot be judged. You must name the ONE concrete blocker. **"The feature appears unimplemented / no consumer / the row is inert" is NOT incomplete — that is FAIL (bug); grep + control-probe it and file the bug.** If you notice yourself repeating the same approach more than twice: stop and write the file. Write `.opencode/plans/incomplete-<id>-<slug>.md` with: what you tried (including which pitfalls you already ruled out), exactly where it stalled, and what would unblock it (a missing data entry, a genuinely ambiguous trigger condition, etc.). Read it back to confirm it persisted, then return `"VERIFIED: INCOMPLETE"` with the file path. **This is a legitimate outcome once you've actually tried the known fixes — it is not a substitute for trying them, and never a hiding place for unimplemented features.**

### Scope

Only mutate data inside "test-campaign." Clean up after testing: clear change-data cache and campaign log via the admin panel.

---

## Worked example — CLA-087 "Disciplined Survivor"

**Automation Details**
- **ID:** CLA-087
- **Name:** Disciplined Survivor
- **Type:** classFeature
- **Class:** Monk
- **Handler:** `src/services/combat/automation/handlers/classFeatureHandler.js`
- **Router:** `src/services/combat/automation/routers/classFeatureRouter.js`
- **InfoBuilder:** `src/services/combat/automation/infoBuilders/classFeatureInfoBuilder.js`
- **Trigger Conditions:** `failed_saving_throw`
- **Expected Behavior:** Proficiency in all saving throws. When you fail a saving throw, expend 1 Focus Point to reroll it.

**Step 1:** No 2024 Monk in the registry, no matching recipe in the playbook → read `classFeatureHandler.js`/`classFeatureRouter.js` to confirm exactly what state is needed.

**Step 2:** Build a 2024 Monk in "test-campaign"; add/reuse an NPC (matched exactly to `monsters.json`) that can force a saving throw. Checkpoint the names.

**Step 3:** Start combat, have the NPC force a save, ensure the Monk fails it.

**Step 4:** Confirm proficiency applies to all saves, a reroll option appears on fail costing 1 Focus Point, and the Focus Point is actually consumed.

**Outcome:** PASS (with a new "2024 Monk — Focus Point reroll automations" playbook recipe and registry entry) / FAIL (with bug file — including if the reroll turns out to be unimplemented: grep + control probe, then bug) / INCOMPLETE ONLY if the scenario itself can't be built (e.g., no data monster can force the save and no workaround exists) after exhausting the pitfalls checklist.
