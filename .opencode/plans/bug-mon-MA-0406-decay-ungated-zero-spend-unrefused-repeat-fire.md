# bug-mon-MA-0406 — Blob of Annihilation / Decay legendary chip: ungated, zero-spend, unrefused repeat-fire, no engulf selection

- **Row**: MA-0406 | Blob of Annihilation (monsterIndex `blob-of-annihilation`) | category `legendary_actions` | actionIndex 1 | actionName `Decay` | actionType `other`
- **Rules text**: "The blob deals 14 (4d6) Necrotic damage to each creature engulfed by it. The blob can't take this action again until the start of its next turn."
- **Verdict**: **FAIL** — repeat-click unrefused (primary), plus zero-spend / dead header economy (MA-0405 root) and no engulf-selection consumer.

## Environment / repro
- http://localhost:5173, campaign `test-campaign` (header verified), GM localhost.
- Fresh start: Admin → Clear Change Data + Clear Campaign Log (native confirms both named "test-campaign"); cs `{}` verified via curl before test.
- EB → check "Blob of Annihilation" → Join. cs: `activeCreatureName: "Blob of Annihilation 1"`, round 1, blob 448/448, all `targetName: null`.
- Armed blob target = HexWarlock via initiative target select; cs `targetName: "HexWarlock"` verified. Baseline HexWarlock HP 73.

## Live evidence (same turn, two clicks)
1. **Click #1** — popup: `Decay · 12 · 4d6: 6, 1, 1, 4` → "**12 damage applied to HexWarlock — HP: 73 → 61**". Log: `roll|damage|Blob of Annihilation 1 Decay` + `hp_change`.
2. Popup dismissed (single click, no stage-2 reroll stage; `popup-overlay` flushed).
3. **Click #2 — same turn, immediately** — popup: `4d6: 2, 2, 1, 4` → "**9 damage applied to HexWarlock — HP: 61 → 52**". Second `roll|damage` + `hp_change` log row, ~25 s later. **No refusal popup, no cooldown gate, nothing spent.**
- cs after: `HexWarlock.currentHitPoints: 52` (73 − 12 − 9 = 52, exact); `lastAttack` = Decay, rawDamage 9, Necrotic, `damageApplied: true`.
- cs spend keys: **absent** — no `monsterLegendaryUses`, no `_legendaryUses_usedRound`, no `monsterLegendaryActionCooldowns` anywhere in cs (blob has no store key at all). No `ability_use` spend log, no `*_refused` log rows (full log = 6 rows: encounter, initiative, 2× decay roll, 2× hp_change).

## Answers to open questions
- **Does chip APPLY damage?** YES — plain-damage seam lands exact rolled 4d6 on the single armed target (`handleDamage` → `rollDamage` → `handlePlainDamage` → `applyDamageToTarget`; popup `damageApplied`, cs hpΔ confirms). NOT a roll-only shell.
- **Does 2nd same-turn click refuse?** NO — unrefused, second full 4d6 applied. Advertised cooldown ("can't take this action again until the start of its next turn") is entirely unenforced.

## Root cause (code trace)
- `legendaryHeaderAction()` (`src/services/encounters/monsterLegendaryUses.js:153`) requires `rows[0].uses != null`. Blob's header row is authored as `{ name: "Legendary Action Uses: 3", description: … }` — **no `uses` field** → header `null` (MA-0405 confirmed).
- `MonsterCardBody.jsx:55` ternary: `legendaryHeader ? <gated slice(1)> : <ungated full rows>` → with null header the legendary section renders **all rows including the header row** as plain action rows, wired straight to `handleDamage` — `legendaryGate` / `handleLegendaryRow` / `resolveLegendaryRow` never mounted.
- Consequence: `expendLegendaryUse()` (which owns the uses counter, turn latch, and the MA-0073 `monsterLegendaryActionCooldowns` gate that WOULD refuse this repeat click via `hasLegendaryCooldownClause` — blob Decay's description matches the regex) is never called. Economy, latch, and per-action cooldown all dead for this monster.

## Gaps (honest)
- **Spend gap**: no uses counter exists/spent — both clicks free.
- **Cooldown gap**: MA-0073 cooldown infrastructure present but unreachable for blob-shaped headers.
- **Engulf-selection gap**: `rg -l engulf src` → only `randomEventService.js`. No engulfed-set consumer; "each engulfed creature" degrades to the single GM-armed target. No "engulfed" state tracked on targets either.
- **Header row leak**: "Legendary Action Uses: 3" renders as a normal (non-chip) row in the Legendary Actions section rather than a `(N left)` counter header.

## Secondary observations
- Blob immunities list includes Necrotic (its own row is unaffected — damage went to the player target only; correct direction).
- Damage applied with no resistance/immunity fold on HexWarlock (he has no Necrotic defense) — arithmetic exact.

## Fix suggestion (not applied — no edits per row rules)
Teach `legendaryHeaderAction()` to parse the trailing count from the header row name (`/Legendary Action Uses:\s*(\d+)/i`), so blob-shaped headers activate the existing gated section, spend counter, latch, and MA-0073 cooldown. Engulf-set multi-target application remains a separate consumer gap.

CLEANUP: final Admin clears done (native confirms named "test-campaign"); cs `{}`, log `[]` verified via curl.

VERIFIED: FAIL
