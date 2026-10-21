# test-maintain state (updated 2026-10-21, run2 batch #212 flush)
- Cursor: run2#1439 DONE (marker 14/14 canonical line-1). Batch #212 GREEN — 30,635 pass, exact canon pair + 3 expected, WATCH #3 SILENT (39th clean, /tmp/batch212.log) (exactly 2 FIXME: steps-config languageWarnings + Players dragging :41; + 3 expected; WATCH #3 = ElementalAttunementModal.phase-flow DC-11 phase-race registered batch#211, stable 4/4 isolated, untouched-window — if it recurs: REAL, stabilize before proceeding; watches #1 WizardStepSpells silent since #183, #2 NPCs.duplicate-name silent since #200).
- NEXT dispatch after adjudication: run2#1440 = queue head from disk, verify with `sed -n '1p' .opencode/plans/test-maintain-queue.txt` — NEVER memory (#1383 phantom rule). (Queue head at flush: rules-proficiencies.implementsOfMercy.test.js — proficiencies rules lane; rules-root cluster in progress: #1435 actions/#1436 armor/#1437 styles/#1438 helpers/#1439 hunterPrey closed; implementsOfMercy = campaign-item/feat proficiency-grant face probably — READ source+disk identity-first #1360 method.)
- Batch discipline: anchor run2#1439; NEXT flush after run2#1453 (Batch #213) unless user requests earlier.
- Counters at #212: completed 2582 / remaining 110 / total 2692 (verified ✓ 2582+110=2692; strict drop 124→110; both queue copies synced).
- Families CLOSED this window: wardingBond ALL-6 (#1425-#1430, 49 boundary), breath trio (#1431+#1390+#1295 mapped), zone-engine quad (#1434 four-engine seam map + #1405/#1432/#1416), rules-root ticket trio MN-020/FT-046/hunterPrey (#1437/38/39). LANDMARK: weakening producer-carries-source => #1295-class collisions PURELY reader-side (fix recipe: readers add source).
- Standing stale cites (retarget on touching): regenerateHandler:13->L250-264/.active:52/:53->:247/:268; MonsterCardHelpers.infernal-wound:10 :75->:127; applyDamage.hypnotic-break :281-333->:287-380; saveResults :159-167->:350-384/:169->:411-417; revivify base :85->:322/:286-310->:341-362/:504->:199-254; roar base :107-191->:180-218/:221-248/:263-283/:307-377 (Modal.staged-roar:10 fix-on-turn); errors :116->:310; bugs-ledger :222->:292; weakening clock-payload :85->:158.
- Coverage-gaps reported unowned (owner decision, maybe queue): noSavePath.js:51 (#1420); applyFeyShadowTouchedSpells/applyRulesType + addFightingStyleFeatFeatures/addBackgroundFeatures (#1437/38).
- 🔴 new-#212 full detail in ledger block: stale-cs multi-te overwrite; negative-heals-uncapped+contradiction+NaN-poison; fire-and-forget no-catch x3 sites; 2014 disk-dead trigger bytes; non-sorcerer-surge RAW-violation; ternary guard-hole localeCompare death.

## MARKER / DETERMINISM / PARITY CANON (enforced every lane)
- MARKER: exactly one '// @maintained-by-ai' at line 1 — ANY variant ('AUDITED' etc.) VOIDS THE PASS (#1361 incident; orchestrator fixed once).
- DETERMINISM BAR (#1366+): argument-keyed STATEFUL strict store fakes THROW unknown owner/key/campaign/arity + read-order censuses; explicit re-seed not Once-chains (vitest-4 clearAllMocks RETAINS implementations #1312); spies afterEach-restored; fake-timer Date.now log-freezes.
- DISK-PARITY GOLD (#1365 method): read BOTH rulesets programmatically every lane; fabricated fixtures banned; claimed-pin existence audits both directions (#1368 byte-repair, #1394/96 verified-exist); coercions census six-family spectrum in batch #209 ledger block.
- FAKE-TEST HARVEST standing duty: vacuous it.each ignored-args (#1389), order-dependent leaks (#1286), objectContaining envelopes (#1395/96), expect.any on mutations (#1307/41), trivially-empty results (#1266/97).

## CLOSED DOMAINS (do not re-queue)
effects/ FULLY CLOSED #1280-#1332 (turnStart seam map, restRules SR/LR families, expireStale maturity table, clear- family, zone clock). features/ lanes #1333-#1397 (65 serviced so far: enchantment/dominion, protection/heal, holy/aura, companion/mount, breath/paralysis clusters). spellCalc2024 #1264-#1277, getPlayerStats #1254-#1259, 2024 attackCalc #1235-#1244, applyDamage #1182-#1210, dc-success x12 #1230, steps/, advisory, maps, npcs, items.

## CITED-RANGE SHIFT MAP (retarget stale cites on citing file's touch)
- regenerateService.test.js:13 + .active:52 -> applyTurnStartEffects L250-264; .active:53 L524 -> expirations_additional :247/:268 (#1283/96/97 deleted 3rd pin).
- MonsterCardHelpers.infernal-wound.test.js:10 :75 -> infernalWoundService.test.js :127 (#1380).
- applyDamage.hypnotic-break.test.js:15 :281-333 -> :287-380 (#1378).
- sp091 rest-latch :6 contract cite -> prayerOfHealingService.test.js :483-541 stamp bytes :516-521 (#1394); .results prose cites shifted :277/:311/:345/:381/:483/:610 (#1394).
- primalCompanionService gates cite kept-by-name; .share-chain:5 reciprocal (#1395/96).
- Standing: bane rec-1287 folded-done; wm003 :88-104; carryingCapacity :15-59; attackCalc2024 base map; error-handling :38-61; senses-speed :237-245; rules.test.js mega-queue intact (#199/200 + :935).

## ACCUMULATED REC QUEUE (apply when owning file comes up)
- Tighten cited objectContaining/expect.any in: useSimpleSpellHandlers bless slotLevel 🔴-fix-owner (report-only, source); restRules-longRest base done #1312; massHealingWord/massCure twin owner-checks done; primalCompanionService cones 🔴-dead-strings; turnStartEffects_additional :675 placeholder RESOLVED real-tests #1324; wildCompanion rec APPLIED keep #1314; healService poison-gate 🔴 owner decision; invisibility inline-dupe delegation recs x2 (#1382); arcaneFortitude lane (queue later) share-family boundary per #1395/96 split.
- Next queue heads verbatim each turn from disk.

## OPEN SOURCE BUGS (report only — full detail bugs ledger #199-#209)
- 🔴 new #209: AoE-heal first-6 affiliation-blind x2 (MCW/MHWD, range never enforced); paralyzingBreath te-source collision (#1295 twin confirmed); prayerOfHealing caster-stats-leak + neg-heal-log; mountService rider-unvalidated ok:true + size unnormalized; primalCompanion dead-guards/:0/alive-===false/dead-exports; rayOfEnfeeblement metaCtx-never-attached (heighten unreachable).
- 🔴 standing: forcecage ruleset-hardcode :9-19; rules.js carryingCapacity=HP :394-399; Improved Illusions wipe :348-356/:775; Starry 120ft :17; armorClass UD shield-drop trio+Dance gate; Swift Quiver :428-429; HC 'Light' disk; Short-Sword :306; applyDamage :552-557/:451; survivivor-guard-dead :446; BM tiers trackedResources :80-83; FP save triad; weakening-breath :482; naturalRecovery dead-post-batch; WS cache-stale :287; triggerFear/triggerCompulsion dead; holyAuraDamage CON-vs-con.
- 🗑 census in ledger #207-209 blocks.

## Harness discipline
- NO-DISPATCH-DURING-BATCHCHECK: end turn after launching boundary check; adjudicate GREEN-vs-CANON (exactly 2 FIXME + 3 expected) before dispatching.
- Detached suite (inline &) gets killed with parent shell — ALWAYS tool background:true (#206 lesson); tool-managed runs notify; foreign runs probe EXIT bounded only.
- Verbatim queue heads via sed -n 'Np' EVERY dispatch (#1125/1383 incidents).
- Contradictory/noisy returns -> scoped disk adjudication before accept (#1249, ':7 marker paste' noise benign if grep shows line 1).
- Spec: ~/.config/opencode/commands/test-maintain.md (PREFLIGHT + SCOPED-GIT active).
