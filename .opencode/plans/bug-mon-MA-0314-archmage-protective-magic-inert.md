# BUG MA-0314 — Archmage "Protective Magic (3/Day)" reaction row is INERT (flavor b)

**Verdict: FAIL** — inert row: zero affordance, zero resolution, zero spend, zero log, even with a genuine spell-origin trigger live (MV-6/MA-0006 inert-fingerprint recipe).

## Row
- id MA-0314 | monster Archmage (archmage) | category reactions | actionIndex 0 | actionName "Protective Magic (3/Day)" | actionType other
- Campaign: test-campaign only (header verified at every step; page.url() localhost:5173 throughout)

## Data fingerprint (public/data/monsters.json:6515 — READ ONLY, not edited)
Exact row dict keys: **`name`, `description` — nothing else.**
```json
{ "name": "Protective Magic (3/Day)",
  "description": "The archmage casts <em>Counterspell</em> or <em>Shield</em> in response to the spell's trigger, using the same spellcasting ability as Spellcasting." }
```
- NO `usage`, NO `uses`/`maxUses`, NO `automation` (no `{type:'reaction',trigger:'enemy_spell_cast',effect:'counterspell'}`).
- Contrast (all verified PASS byte-shapes): Aberrant Cultist (MA-0013), Arcanaloth (MA-0300), Arch-hag Tongue Twister (MA-0305) all author `usage` + `uses/maxUses` + `automation.effect:'counterspell'`.
- Playbook MA-0300: gated monster reactions keyed **ONLY** off `automation.effect` (no name matching). `grep -rn "Protective Magic" src/` = ZERO consumers (hits only monsters.json rows 6515/36951/38014).

## Code fingerprint
- `getGatedMonsterReaction` (MonsterCardHelpers.js:564) reads `action?.automation?.effect` → null for bare row.
- `GatedReactionSlot` (MonsterAction.jsx:134) `if (!def) return null;` → no gated span rendered (MA-0006-era `mc-dice-link-reaction` / current `mc-dice-link` GatedReactionLink both unreachable).
- `monsterReactionUsesRemaining` (MonsterCardHelpers.js) needs `action.maxUses ?? action.uses` → null → no "(3 left)" chip; "(3/Day)" exists only in the name text, never parsed (`formatActionUsage` reads `action.usage` only).
- `handleGatedReaction` (MonsterCardModal.jsx:1298) `if (!getGatedMonsterReaction(action)) return;` → forced clicks inert.
- No generic reaction branch resolves bare rows app-wide.

## Live evidence (test-campaign)
1. Baseline curl: change-data `{}`, log `[]`. EB search "Archmage" → checkbox → Join Encounter → cs: `Archmage 1 npc` + PC casters (DivinationWizard, AberrantSorcerer, …). Header = `test-campaign`.
2. Card row outerHTML (twice — pre-trigger and with live trigger), zero affordances:
   `<div class="mc-action "><strong>Protective Magic (3/Day).</strong> <span>The archmage casts <em>Counterspell</em> or <em>Shield</em>…</span></div>`
   — no `.mc-dice-link`, no `[role=button]`, no uses chip.
3. Trigger built genuinely: armed DivinationWizard initiative card target-select → "Archmage 1" (native selectOption), sheet cast flow §4 → Fire Bolt HIT 19 vs AC 17 → RAW campaign `lastAttack` spell-origin confirmed via curl (`rollType:"attack"`, `damageSchool:"Evocation"`, `attackerName:"DivinationWizard"` player, `targetName:"Archmage 1"`). `isSpellOriginLastAttack` would return true.
4. Forced proof (MV-6): with trigger live, forced `el.click()` ×2 on row + row `<strong>` → NO popup, `lastAttack.counterspellResolved` still absent, `counteredBy` absent, `Archmage 1` store `{}` (no `monsterReactionUses`), log contains ZERO counterspell/shield/refusal/ability_use entries.
5. Control probe (no spell-origin lastAttack): pre-trigger forced clicks also zero popup/zero log — indistinguishable from the trigger-live state = gate cannot even refuse (refusal vocabulary `counterspell_refused (countered|round|uses)` impossible to emit).

## Engine alive / row is the gap
The Counterspell gate machinery IS live for stamped rows (MA-0013 Aberrant Cultist, MA-0300 Arcanaloth, MA-0305 Arch-hag registry PASSes; Fire Bolt cast + damage + lastAttack stamp all worked live in this session). The row itself is the unwired data gap.

## SEPARATE SEAM NOTED (PC cast, out of scope)
First Fire Bolt cast errored: `resolveMagicalAmbushInvisible` (spellCastService/execution/index.js:134-136) THROWS when caster runtime `activeConditions` is null (fresh Admin-cleared store) — every sheet spell cast dead until any condition seeds the array. Workaround used: Condition Add modal Deafened→Apply. Flagging for owners; MA-0314 evidence gathered post-seed, so trigger authenticity unaffected.

## Fix template (cite only — do not edit per task rules)
MA-0300/MA-0013 data-only fix shape (zero code change): stamp row with
`"usage":"3/Day", "uses":3, "maxUses":3, "automation":{"type":"reaction","trigger":"enemy_spell_cast","effect":"counterspell"}`
plus DELETE `combat-ui-viewingMonster` + reload to drop stale snapshot. Counterspell-vs-Shield CHOICE: engine resolves Counterspell only (no Shield branch) — if choice fidelity required, advisory-note per MA-0300 pattern or extend effect registry. "3/Day" then enforced via reactionMaxUses + monsterReactionUses spend + `counterspell_refused (countered|round|uses)` zero-spend refusals.

## Cleanup
Admin → Clear Change Data + Clear Campaign Log (native confirms, test-campaign) → verified `{}` / `[]`.
