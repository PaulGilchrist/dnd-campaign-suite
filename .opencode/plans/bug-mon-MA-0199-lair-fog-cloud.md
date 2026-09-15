# BUG MA-0199 — Ancient Bronze Dragon lair fog cloud row INERT (raw-string data shape)

- Verdict: **FAIL** (flavor b — inert row, zero affordance)
- Row: MA-0199 `ancient-bronze-dragon|lair_actions|0` "Unnamed lair actions 1" (placeholder name — generator emits when entry lacks name)
- Date: 2026-09-15, run window 08:10–08:13 UTC, dev :5173, campaign test-campaign

## Data shape (disk truth, public/data/monsters.json)
`lair_actions[0]` is a **RAW STRING**:
"The dragon creates fog as though it had cast the fog cloud spell. The fog lasts until initiative count 20 on the next round."
No dict, no `name`, no `zone`, no save fields. `lair_actions[1]` is a dict (save_dc 15 CON thunderclap; also carries `1dlO` typo — MA-0086 residual).

## Why inert (code path)
- `MonsterCardBody.jsx:339-340`: `typeof==='string'` lair entries hit the static branch BEFORE the name-gate — renders `<div class="mc-action"><span>…prose…</span></div>` with ZERO clickable children (live DOM capture 08:12 UTC: `links: 0`, `strong: []`).
- `monsterLairActions.js:25-26` `isLairRowClickable` requires object + `row.name` → raw string fails; affordance never computed.
- MA-0167 refinement holds: raw-string rows render NO name token at all (not even the MV-24 stray ".").

## Live evidence (zero delta)
- No `.mc-dice-link-lair` chip in overlay (`lairLinks: []`).
- Forced `el.click()` ×2 (`clickableKids: 0`) + trusted mouse click at row center → log 2→2 during probe window, change-data: no `lastAttack`, no `pendingSavePrompts`, `targetEffects: null`, zero popups.
- CONTROL (engine alive): Rend "+16" `.mc-dice-link` same overlay → live `type:roll rollType:attack name:Rend total:19 bonus:+16 damageType:Slashing` log entry at 1789459972541.
- Join verified: EB "Ancient Bronze Dragon 1" hp 444 ac 22 cs-idx 0 (registry match).

## Registry
- `lair_fog_cloud` te IS registered: `src/services/combat/conditions/targetEffectDefinitions.js:851` (Lair group).
- Producers of `lair_fog_cloud`: ONLY the structured zone dict on **adult-bronze-dragon** `public/data/monsters.json:1907` + tests (`monsterLairActions.test.js:613/:686`). ZERO producer for this raw-string ancient row.

## Notes — MA-0085 fix recipe (verbatim, reusable)
"No-save lair area: `{name, description, zone:{radius_ft, no_save:true, effect_key:"lair_fog_cloud", noun:"fog"}}` → `affordance:'zone'` (monsterLairActions.js:40 — requires radius_ft AND no save_dc) → zoneOnly picker "20-foot fog. No saving throw" + te arm, zero save prompt. `lair_fog_cloud` te registered (Lair group); `zone.noun` passthrough (default darkness byte-identical MA-0043)."
- Pair row in same block as structured save row (Thunderclap: dc/dice/deafened save_effect must contain the condition word for MA-0017 seam; dc_success:"none" suppresses half boilerplate). Fix authoring typos (1dlO→1d10) in data locks too.
- Adult-bronze-dragon sibling already carries the fixed shape with advisory text "Persists until initiative count 20 on the next round." — mirror it for ancient-bronze-dragon.

## Advisory gap (§7)
Initiative-count-20 subsystem does not exist app-wide (MA-0118 grep fact) — even after the data fix, the fog's duration clause remains GM-advisory; obscurity/line-of-sight clauses have no consumer.

## Cleanup
Admin change-data + log cleared post-run; verified `{}` / `[]` quiet.
