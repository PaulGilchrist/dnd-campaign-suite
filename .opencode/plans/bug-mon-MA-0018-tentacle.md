# Bug mon-MA-0018 — Aboleth "Tentacle" — grapple-on-hit clause inert

Row: monster "Aboleth" (monsterIndex `aboleth`) · "Tentacle" · attack · attackBonus 9 · damageDicePrimary "2d6 + 5" Bludgeoning · reach 15 ft · conditions ["grappled"] on Large-or-smaller hit (escape DC 14).

## Verdict: FAIL (MV-9 — base attack/damage live+exact, grapple clause flavor(b) inert)

## Static (public/data/monsters.json aboleth)
- Tentacle row: `attack_bonus: 9`, `reach: "15 ft."`, `damage_dice_primary: "2d6 + 5"`, `damage_type_primary: "Bludgeoning"` — matches row exactly.
- Grapple clause exists only as description prose. No structured hit-effect/grapple/escape_dc field.
- Grep: `escape_dc|escapeDc` **zero matches** across `src/`, `server/`, `public/data/`. No grapple producer on the monster attack-hit path: `MonsterCardHelpers.js` condition list (`grappled` included) feeds `extractConditionsFromSaveEffect` (save effects only); `lastAttack.statusEffects` never populated on Tentacle hit.

## Live evidence (fresh rig, localhost:5173, test-campaign, Playwright)
1. EB join "Aboleth" → initiative "Aboleth 1" 150/150, init 3. Armed target AberrantSorcerer (Medium humanoid, computedStats AC 9) via token Target dropdown.
2. First attempt from EB `View details` modal threw `[AC] Target "AberrantSorcerer" has no AC defined` (computeTargetAc, targetAcComputation.js:15) — EB receives raw characters (App.jsx:204) vs enriched `computedCharacters` (App.jsx:611) in Initiative. Attack must run from the initiative token `.mc-overlay`.
3. Initiative overlay → Tentacle `.mc-dice-link` "+9" → popup **d20 15 +9 = 24 vs AC 9 → HIT** → Done (`button.dice-roll-reroll-btn`) → 2d6 (5, 6) +5 = **16 Bludgeoning**, AberrantSorcerer **41 → 25**. Log: `roll` attack +9, `roll` damage `2d6 + 5` [5,6] total 16, `hp_change` −16 → 25. Base to-hit/damage **exact**.
4. Decisive grapple probe after confirmed hit: `AberrantSorcerer.activeConditions` **absent/empty**; `pendingExpirations: []`; initiative card badges **[]** (zero chips); campaign log has **no** `condition/applied` (or any grapple) entry; `lastAttack.statusEffects: null`. → Grapple clause produces **zero** live effect.

## Root cause
Same app-wide MV-9 gap: attack-hit condition clauses ("Hit: … it has the Grappled condition") are never parsed into targetEffects on the monster attack resolution path, and there is no grapple application/consumer (escape_dc grep-zero). Identical fingerprint to prior MV-9 findings; MA-0017 confirmed the analogous gate on save-effect application (`applyFailedSaveConditions` only reachable via `applySaveDamage` in `saveProcessing.js`).

## Fix direction
Parse "Hit:" clauses in monster attack descriptions into structured hit conditions/targetEffects (or author an explicit `hit_conditions` field in monsters.json), apply + log on hit via the shared condition application path in `saveProcessing.js`/conditionSaveService, and register grapple with escape-DC tracking in `targetEffectDefinitions.js`.

## Cleanup
Admin clear change-data + clear-log POSTs (Host: localhost) performed; browser closed. No manifest/playbook edits.
