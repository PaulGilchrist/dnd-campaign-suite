# SP-004 Animate Dead — multi-cast spawn name collision, te marker loss, initiative React-key flood

## Overview
Casting Animate Dead twice in the same combat (lv3 then lv4 upcast) spawns the second swarm's first creature with the bare name "Skeleton" again. Duplicate combatant names corrupt the Initiative list rendering (hundreds of React duplicate-key errors) and the `summoned` te de-dupe silently drops control markers for every spawn after the first cast; the lv4 cast's whole `targetEffects` write also never reached disk.

## Expected (canonical, 5e/2024 3rd-level Necro)
- Each cast animates 1 (+2/slot above 3) undead, each from a different corpse — i.e. distinct creatures in every case.
- Every spawned combatant gets a unique identity in `combatSummary.creatures` and its own `te "summoned"` marker (per existing summon lane, `monsterSummon.js:17` "te summoned per spawn").

## Actual (disk truth via GET change-data)
- lv3 cast: cs `[…, Skeleton(init 16)]`, te `[{target:'Skeleton', source:'DivinationWizard', effect:'summoned'}]` — correct.
- lv4 cast (+3): cs gains **another bare `Skeleton`** (init 13) plus `Skeleton 2`, `Skeleton 3` — the bare name duplicates the lv3 spawn.
- te after lv4 cast still held ONLY the single lv3 entry: `Skeleton 2`/`Skeleton 3` (and the duplicate Skeleton) have no `summoned` marker. The handler's single `setRuntimeValue('campaign','targetEffects')` write is lost — consistent with playbook §5 full-store snapshot racing against the concurrent `storage.set('combatSummary')` POST (combatSummary snapshot won, te snapshot stale/never landed).
- Initiative page after lv4 cast: ~91–127 console ERRORS `Encountered two children with the same key, Skeleton / Skeleton-0` — React "children duplicated and/or omitted" state; some creature cards render with empty names.

## Steps
1. test-campaign, initiative live, caster (DivinationWizard lv20 2024) with Animate Dead + material component in backpack (exact string; comma-lists must be quoted in wizard step 16 to form one entry).
2. Cast Animate Dead lv3 → confirm modal "up to 1", Skeleton #1 spawns with te `summoned` ✔.
3. Re-add material (first cast consumed it), cast again at lv4 radio → modal "up to 3" ✔ → confirm (default 3 Skeletons).
4. GET `/api/campaigns/test-campaign/change-data`: cs shows duplicate bare `Skeleton`; te has only the lv3 entry.
5. Open Initiative page: console fills with duplicate-key errors (`Skeleton`, `Skeleton-0`).

## Likely Location
- `src/services/automation/handlers/spells/animateDeadHandler.js:41` — `buildCreatureEntry` names `index === 0 ? baseName : baseName+(index+1)` per cast; index restarts each cast → name collision across casts. Should number against existing cs creatures (cf. EB join "Bandit 1" suffixing).
- Same file `:93-95` — te de-dupe keyed on `creature.name`; with duplicate names later spawns never get markers; and the merged `storage.set('combatSummary')` + `setRuntimeValue(targetEffects)` pair (`:151-152`) races (un-awaited, both full-store) so the te write can be lost entirely.
- Initiative list keying on creature name (Initiative.jsx creature-card map) surfaces the collision as key-duplication.

## Notes
- Spawn lane is its own `animate_dead` handler (NOT monsterSummon reuse), by design; monsterSummon lane is monster-card-side.
- Command bonus action: no command lane app-wide (grep); popup copy "They act on your turn, right after you" is the only representation; spawned Skeleton is actionable via its own monster card (Shortbow chip "+3" verified live) — GM-advisory, honest residual.
- 24h control clock and "different corpse" constraint: grep-zero consumers; te registered without duration/expiry (unlike monsterSummon's `gm_adjudicated` register) → control persists until manual removal. Advisory gaps.
- Row verdict: PASS-subset (lv3 lane fully evidenced; multi-cast scenario defective).
