# Second-turn condition-badge CLICK (save reroll) still keys the synthetic name — holder never cleared, phantom bucket, bonus loses the holder's save

## Summary
Fix 583d078ff remapped the ST-row badge **×** (auto-break) lane to the holder, but the sibling **click** lane (condition-save reroll) was left un-remapped. Clicking a condition badge on a `(Second Turn)` row rolls the save against the synthetic row (holder's own save bonus lost), audits the synthetic name, and — because `removeCondition` is keyed by the looked-up row — a **successful** save leaves the holder's condition fully in place while materializing a phantom `{activeConditions:[]}` change-data bucket under the suffixed name. This was flagged as the "adjacent known lane (unfiled)" in playbook §119; it is now reproduced live with a control differential.

## Steps to reproduce
1. In `test-campaign` (dev pair, change-data clean), curl-seed `POST /api/campaigns/test-campaign/combatSummary` **before** campaign-select:
   `{value:{round:1,creatures:[{name:"EvasiveFighter",type:"player",initiative:"20"},{name:"EvasiveFighter (Second Turn)",type:"player",initiative:"10",secondTurn:true,holderName:"EvasiveFighter"},{name:"ElderPaladin",type:"player",initiative:"15"},{name:"AasimarTest",type:"player",initiative:"12"}]}}`
2. Select `test-campaign` → Initiative (board merges to 14 cards; ST twin survives).
3. On the **`(Second Turn)` card**, click Add (`[title^="Add condition"]`) → modal titles `EvasiveFighter` (holder remap works) → Conditions tab → `Poisoned` → leave the DC input blank (badge renders `dc:0`, making any save-click auto-succeed) → Apply. Holder gets `activeConditions:["poisoned"]`; Poisoned badge shows on BOTH cards.
4. Click the **Poisoned badge on the ST card** (not the ×) → popup `SAVE SUCCESSFUL`.
5. GET `/api/campaigns/test-campaign/change-data` and `/log`.
6. Control: re-add Poisoned via the ST modal, then click the Poisoned badge on the **EvasiveFighter holder card**.

## Expected behavior
The ST card displays the holder's conditions (CLA-360 holder-resolved display), so its badge click must resolve the save as the holder, clear the holder's condition on success, and audit the holder — the same law 583d078ff shipped for ×, b32ca1680 shipped for te badges, and the concentration badge already honors (ST-card concentration click rolled `characterName:"EvasiveFighter"`, bonus +11 — correct).

## Actual behavior
ST-card Poisoned-badge click:
- Popup bonus **+5 only** (aura); the holder's CON save modifier (+6) is lost → save total is systematically under-rolled for any DC>0 condition.
- Audit row names the synthetic creature:
  `{"type":"roll","rollType":"condition-save","characterName":"EvasiveFighter (Second Turn)","rolls":[12],"mode":"normal","total":12,"bonus":5,"bonusDetail":"(+5 aura from ElderPaladin)","condition":"Poisoned","dc":0,"success":true}`
- Despite `success:true`, holder bucket keeps `activeConditions:["poisoned"]` (badge stays on both cards — a visible lie).
- Phantom bucket materializes: change-data key `"EvasiveFighter (Second Turn)": {"activeConditions":[]}` — which replays on every SSE connect/re-select per the snapshot-replay law and orphans at the round wrap.

Control (holder card click, same session): bonus **+11** (+6 + aura +5), audit `characterName:"EvasiveFighter"`, holder `activeConditions:[]` actually cleared.

## Likely location
Confident (code-read, matches live): `src/components/initiative/CreatureCard.jsx` `ConditionsSection` line ~648 passes `creatureName={creature.name}` (synthetic) into `ConditionBadgeRow` → `onRollConditionSave(creatureName, cond)`; `createRollConditionSaveHandler.js` `handleRollConditionSave` is zero-secondTurn-aware — it finds the synthetic cs row (`:260`), `getCreatureSaveBonus` fails its character lookup by synthetic name (bonus 0), and `removeCondition` (`conditionSaveService.js:94-100`) writes `setRuntimeValue(creature.name,'activeConditions',…)` on the synthetic key. Sibling remap precedents: `createAutoBreakConditionHandler.js` (583d078ff), `useAllyEditor.js` (930393775), `Initiative.jsx openEffectAdder` (c5883e4a4). Note `ConditionEffectBadges` already receives `creatureName={effectSubjectName}` — the raw-conditions `ConditionBadgeRow` leg was simply missed.

## Suggested fix
Mirror `effectSubjectName` onto the `ConditionBadgeRow` leg: pass `creatureName={effectSubjectName}` (CreatureCard.jsx ~:648) so the save rolls and removes on the holder row — the same one-line-chokepoint shape as b32ca1680. Alternatively remap inside `handleRollConditionSave` via `isSecondTurnEntry(row) && row.holderName`. Caution: `buildRuntimeConditions` gives badge `dc:0` when no DC was stamped, so any `dc:0` click auto-succeeds — after the remap the success face genuinely clears the holder, matching the holder-card control. Pin with a `createRollConditionSaveHandler.second-turn.test.js` (holder bucket written, synthetic bucket GET-absent, audit names holder), and check for tests enshrining the synthetic-name face (precedent: playbook §119).

## Severity
Data integrity risk — a "successful" save silently fails to remove the holder's condition (wrong game state players can see), every ST-card-resolved save rolls without the holder's save bonus (wrong verdicts on real DCs), and each success materializes a phantom replay-on-connect bucket.

## Resolution
**FIXED** — diagnosis in the bug file confirmed against the live code: `ConditionBadgeRow` (CreatureCard.jsx:648) passes `creature.name` (synthetic on ST rows) into `onRollConditionSave`, and `handleRollConditionSave` was zero-secondTurn-aware — it found the synthetic cs row, `getCreatureSaveBonus` failed its character lookup (bonus 0, popup showed aura-only +5), `removeCondition` wrote `activeConditions` under the synthetic key (phantom bucket, holder untouched), and the `condition-save` audit named the synthetic creature. Reproduced live first with the exact differential (ST click: +5 / synthetic audit / holder kept `["poisoned"]` / phantom `{activeConditions:[]}`; holder control: +11 / holder audit / real clear).

**Fix (holder remap at the handler chokepoint, mirroring the sibling × lane `createAutoBreakConditionHandler.js` — 583d078ff):**
- `src/components/initiative/createRollConditionSaveHandler.js` — after finding the looked-up cs row, remap `isSecondTurnEntry(row) && row.holderName → holderName` (same `subjectName`/re-lookup shape as the × handler, comment cross-referencing the CLA-360 law); the remapped holder row feeds `rollConditionSave` (holder's save bonus + holder-positional aura), `removeCondition` + all `SUCCESS_CLEANUPS` ctx (holder's buckets, no synthetic writes), and `logConditionSave` (holder audit). Chosen over the CreatureCard prop variant so the state-write/audit chokepoint itself is ST-safe regardless of caller — consistent with the × precedent, which also left the prop passing `creature.name`. Non-ST rows stay byte-identical (row === subject short-circuit); a secondTurn row without `holderName` falls back to its own name (legacy face pinned).
- Dual-ruleset: N/A — component-lane handler, no 5e/2024 twin.
- Sibling bug kept out of scope per instructions: the `dc:0` blank-DC auto-success face was NOT gated here (`bug-condition-badge-no-dc-auto-success-removal` owns it); after this remap the dc:0 success face genuinely clears the holder, matching the holder-card control.

**Regression test:** `src/components/initiative/createRollConditionSaveHandler.second-turn.test.js` (4 tests, mirroring `createAutoBreakConditionHandler.second-turn.test.js` conventions + real structural `isSecondTurnEntry` stub): resolver receives the HOLDER cs row; holder bucket write lane (`removeCondition` creatureName=holder) + zero writes/audits keying the synthetic name; holder-click control unchanged; no-`holderName` legacy fallback. Grepped `src/components/initiative/` tests for enshrined synthetic-name assertions on this lane — none found (the §122 precedent hits were the allies-editor roster, already corrected pre-fix).

**Verification:**
- `npx vitest run` new test: 4/4 PASS. `npx vitest run src/components/initiative/`: 95 files / 708 tests PASS. `src/services/combat/conditions/` + thiefsReflexesService/creaturePresence: 20 files / 889 tests PASS. Full suite `npm run test:run`: 3155 files, 34224 passed + 3 expected-fail. `npm run lint`: clean (zero warnings).
- Live re-verify in `test-campaign` (fresh Vite load post-fix, curl-seeded ST board): Poisoned via ST modal → clicked the Poisoned badge on the **ST card** → popup `SAVE SUCCESSFUL` bonus **+11** (holder CON +6 + aura +5), audit row `characterName:"EvasiveFighter"`, holder `activeConditions:[]` actually cleared, and change-data `EvasiveFighter (Second Turn)` **ABSENT** (no phantom bucket). Adjacent lanes sanity-checked: ST-card badge **×** still breaks the holder (`condition broken` audit names EvasiveFighter, no synthetic key) and the **holder-card** badge click still rolls +11 and clears. Exit: browser closed, two-pass admin clears GET-verified `{}` / `[]` with no rehydration.
