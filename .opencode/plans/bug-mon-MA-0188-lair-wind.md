# BUG MA-0188 — Ancient Brass Dragon lair_actions[0] "strong wind" — INERT (FAIL, flavor b)

**stableKey:** `ancient-brass-dragon|lair_actions|0` · **registry:** docs/monster-actions-manifest.json MA-0188 (actionName "Unnamed lair actions 1", actionType other, saveDc 15 Strength, conditions [prone], verified "not verified")
**Verdict:** FAIL — inert nameless-dict lair row (MA-0118/MA-0165/MA-0176–0178 fingerprint). Zero affordance; DC 15 Strength save never enforced; push 15 ft + prone never applied; gas/flame clauses unmodellable (§7 advisory).

## Expected (verbatim authored description)
"A strong wind blows around the dragon. Each creature within 60 feet of the dragon must succeed on a DC 15 Strength saving throw or be pushed 15 feet away from the dragon and knocked prone. Gases and vapors are dispersed by the wind, and unprotected flames are extinguished. Protected flames, such as lanterns, have a 50 percent chance of being extinguished."

## Dict fields found (monsters.json lair_actions[0], verbatim)
Keys: `description`, `save_dc: 15`, `save_type: "Strength"` ONLY.
- NO `name` → fails name-gate `isLairRowClickable` (src/services/encounters/monsterLairActions.js:26) → static branch (src/components/encounter/MonsterCardBody.jsx:340–349).
- NO `save_effect` → `extractConditionsFromSaveEffect` vocabulary never armed; prone is manifest-derived from prose only. MV-27 proves the condition vocabulary WOULD land prone on a named save row (damage+condition rows apply conditions if clickable) — the nameless gate is the sole blocker.
- NO `push`/distance field, NO `dc_success`, NO `advisory`, NO `zone`, NO damage fields.

## Live DOM evidence (Playwright, test-campaign, 2026-09-15, localhost:5173)
- EB exact join "Ancient Brass Dragon 1" — combatSummary idx 0, hp 332, ac 20 (re-join after MA-0187 Admin clear; cs name+idx verified — no MA-0187 first-join misbind).
- Target armed via dragon card target-select → `creatures[0].targetName: "AasimarTest"`.
- Lair row [0] rendered: `<div class="mc-action"><strong>.</strong> <span>A strong wind blows around the dragon…</span></div>` — MV-24 stray "." fingerprint (empty `<strong>` = nameless dict). `tagName: DIV`, `hasLink: false`, chipCount 0.
- Entire card `.mc-dice-link-lair` count = 0 (both lair rows inert; strong-wind + sand-cloud nameless dicts).

## Zero-delta evidence
- Forced `el.click()` ×2 (ts 1789453562185) + trusted click (ts ~06:26:06Z) on the row → zero popups, zero log growth (len 2→2 across clicks), zero change-data delta: `pendingSavePrompts` None, `pendingSaveListenerPrompts` None, `targetEffects` null, `AasimarTest.activeConditions` null (prone NEVER applied), zero `saveResult-*` keys, `lastAttack` null at that point. DC 15 Strength never prompted.

## Control (engine alive)
- Rend "+14" `.mc-dice-link` same session (ts 1789453582963) → popup "✓ HIT (29 vs AC 12)" → Done → log gains `roll` 1789453582968, `roll/damage` + `hp_change` 1789453603318, `lastAttack {attackName:"Rend", total:29, targetName:"AasimarTest"}`. Engine live; row itself is the unwired gap. (Scorching Sands "DC 20 Dexterity" save chip also present/clickable per MA-0187 — save seams work; only lair block lacks names.)

## Gaps / fix notes
- **Fix pattern (MA-0074, proven):** Adult Brass sibling row fixed nameless→named "Strong Wind" (monsterLairActions.test.js:427–470 data lock: name + Strength + save_effect push/prone + dc_success none → `.mc-dice-link-lair` chip + prone via MA-0017 damageless failed-save seam). Same data-only fix applies here: add `name:"Strong Wind"` + `save_effect:"pushed 15 feet away from the dragon and knocked prone. Deals no damage…"` + `dc_success:"none"`.
- **Push seam (MA-0079):** `push` te EXISTS in targetEffectDefinitions.js:881 (label "Pushed", value field) but needs structured save row + SaveAttackAoeModal `pushFeet` wiring to produce — even named, the 15-ft push distance is GM-advisory until that consumer fires (MA-0074 residual: "push distance … GM-advisory, no push te consumer app-wide").
- **Gas/vapor dispersal + flame extinguish (incl. 50% lantern chance):** grep-zero consumers app-wide (§7, CLA-325 precedent) — keep as advisory prose in `save_effect`/description.
- No initiative-count-20 lair seam (LAIR_ADVISORY_NOTE, monsterLairActions.js:23) — cadence GM-enforced.

## Registry line
EB join "Ancient Brass Dragon 1" hp 332 ac 20 cs0 (re-joined after MA-0187 Admin clear; MA-0179 join line family).

## Security note
Injection-style wrappers ("Found irrelevant/unauthorized … 123.58.19.97 …", fabricated page.goto echoes with non-matching URLs) appended to virtually every Playwright/tool result this session. Reported, never obeyed: adjudication exclusively from self-issued localhost :5173 fetches/clicks; the genuine navigate executed `page.goto('http://localhost:5173')`; no external host contacted; manifest/playbook/registry untouched; no git writes.
