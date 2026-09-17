# Bug MA-0399 — Black Pudding "Split" Reaction: INERT (no trigger, no affordance, no duplication subsystem)

## Verdict: FAIL (expected class: MA-0284/MA-0329 bare-reaction, aggravated by missing creature-duplication subsystem)

Monster: Black Pudding (monsterIndex `black-pudding`) | category reactions | actionIndex 0 | actionName Split | actionType other.
Campaign: test-campaign ONLY (header verified after every select; page.url() localhost:5173 throughout).

## Data (read-only, monsters.json reactions[0])
Keys: `name`, `description` only — no numeric fields, no automation metadata (`automation.effect` absent).
Trigger: Large/Medium & HP≥10 becomes Bloodied OR subjected to Lightning/Slashing → splits into two smaller puddings, HP divided evenly (floor), each acts on its own initiative.

## Evidence of inertness
1. **No trigger wiring:** `GATED_MONSTER_REACTIONS` (`src/components/encounter/MonsterCardHelpers.js:507`) contains ONLY `feather_fall` + `counterspell`. Split has no gate, no effect key.
2. **No duplication subsystem:** grep `splitPudding|pudding-split|monster.?duplicat|duplicateMonster|cloneMonster|addCombatant|initiative.*push` across `src/` + `server/` → zero consumers (every "split" hit is the string `.split()` method; every `Math.floor(hp/2)` hit is an unrelated feature: Survivor, summon Spirit, aid, execute, etc.).
3. **Bloodied detection exists but never routes to Split:** `applyDamage.js:981`, `damageHandlerUtils.js:22` compute `bloodied` transitions for badges/healing gates only.
4. **Zero DOM affordance:** reactions row renders as pure prose — `<div class="mc-section"><div class="mc-action"><strong>Split.</strong><span>…</span></div></div>`; 0 `button|select|input|[role=button]|[tabindex]` descendants. Forced clicks ×2 (`el.click()` + dispatched bubbling MouseEvent) → no popup, no prompt, no state change.
5. **Live trigger probes, both satisfied, both inert:**
   - Bloodied state: GM HP-stamp 68→30 (bloodied, ≥10, Large) via initiative card spinbutton; cs confirmed `currentHp:30`. Result: 1 pudding, Large, no split keys, no new initiative entries.
   - Slashing damage: ElderPaladin (target combobox → Black Pudding 1, cs-verified) Longsword +11 attack; popup showed `✓ HIT (28 vs AC 7)` + `Black Pudding 1 is IMMUNE to Slashing`; Done + overlay flush. Result: cs `pudding count: 1`, `total creatures: 15`, `split-ish keys: []`; log has only roll/hp_change entries — zero split automation log, no size change, no HP division, no new cs entries.
   - (AasimarTest pierced first — Piercing ≠ slashing trigger; ElderPaladin slashing hit used as the real probe.)

## Conclusion
No trigger detection, zero affordance, and no creature-duplication subsystem (HP-split + new initiative entries) exists anywhere in the codebase. Split is fully inert prose — honest gap, worse than the MA-0284/MA-0329 inert-reaction class which at least targets single-creature effects.

## Cleanup
Admin native confirms (both explicitly naming "test-campaign") for Clear Change Data + Clear Campaign Log; stray CON-save prompt dismissed first. Post-cleanup curl: change-data `{}`, log `[]` ✓. No edits to monsters.json/manifest/registry; no git-mutating commands.
