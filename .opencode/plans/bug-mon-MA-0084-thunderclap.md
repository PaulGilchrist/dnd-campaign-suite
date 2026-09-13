# bug-mon-MA-0084 — Adult Bronze Dragon · "Thunderclap" · legendary_actions · aoe-save · FAIL

## Row (manifest MA-0084, adult-bronze-dragon|legendary_actions|3)
DC 17 CON, 3d6 Thunder, fail → Deafened until end of target's next turn; "each creature in a 20-foot-radius Sphere centered on a point the dragon can see within 90 feet". Full save/dice metadata authored → clickable per MV-23. Victim: ElderPaladin lv20 CON 20 (save +10 app-computed incl aura), HP 224.

## Verdict: FAIL — AoE shape clause (MV-21 fingerprint, same bar as MA-0031 cone absence). Core single-target save math + condition application EXACT.

## Evidence (live, test-campaign, header verified MV-18)
- `.mc-overlay` Thunderclap row renders `3d6` `.mc-dice-link` ✓ clickable (MV-23 holds).
- **Shape:** `.secondary-target-row` count = **0** — no sphere/point picker; handleSaveRoll resolves only armed `cs.targetName` (MV-21). 20-ft Sphere clause unmodellable → FAIL per MA-0031 precedent.
- **SUCCESS branch exact:** d20 8 +10 = 18 vs DC 17 → `save-damage 3d6 [4,6,4] total:14 finalDamage:7 saveSuccess:true`, `hp_change delta:-7 (224→217)`; activeConditions null, zero condition log ✓. (2nd success: [6,3,3]=12→6, delta -6 ✓.)
- **FAIL branch exact:** d20 1 +10 = 11 vs DC 17 → `save-damage 3d6 [4,6,4] total:14 finalDamage:14 saveSuccess:false`, `hp_change delta:-14 (207→193)`; `condition applied: Deafened`; runtime `activeConditions:["deafened"]`; Deafened badge renders on ElderPaladin sheet ✓ (MV-27 damage-bearing save applies conditions).
- **Gate:** 2nd (and 3rd/4th) click same round re-fires DC 17 prompt with zero consumption/latch — legendary uses ungated (consistent MV-21/28 recharge-family behavior).
- Persistence quirk (non-blocking): `combatSummary.creatures` HP re-stamps stale 224 while runtime key `ElderPaladin.currentHitPoints` holds truth (193); HP truth per log/runtime key (MV-1).

## Cleanup
- POST /api/campaigns/test-campaign/admin/clear-change-data + /admin/clear-log (Host: localhost); browser closed; no manifest/playbook edits (manifest `verified` left untouched per instructions).
