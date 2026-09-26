# MA-1242 — Noble Prodigy "Shield" reaction: FAIL(b)/DATA

**Monster:** Noble Prodigy (`noble-prodigy`) · **Row:** reactions[0] "Shield"
**Verdict:** FAIL(b)/DATA — one-field fix (missing `automation` block). Zero affordance live; SHIELD machinery proven LIVE on same board.

## Symptom (live census 2026-09-25, test-campaign)
- EB join Bandit + Noble Prodigy (+ Mind Flayer Arcanist control) → explicit "Join Encounter" → cs = `Noble Prodigy 1, Bandit 1` (+`Mind Flayer Arcanist 1`).
- Noble Prodigy card, Shield row: **0 in-row controls** (`span.mc-dice-link` count 0). Row renders prose only: "Shield. The noble casts Shield in response…"
- Center-click probe on Shield row: 0 popups (`.popup-overlay`/`.sp-overlay`/`.sp-modal` visible = 0), log delta 0 (3→3), 0 console errors.

## Root cause (§60 gated-reaction fingerprint)
Gated monster-reaction chips arm ONLY off `automation.effect`:
- `MonsterCardHelpers.js:1714` `getGatedMonsterReaction(action)` — registry-first lookup on `action.automation.effect`; Noble Prodigy's Shield row has **no `automation` key** (disk-verified `public/data/monsters.json`: `name`+`trigger`+`description` only) → null.
- `MonsterAction.jsx:165` `GatedReactionSlot` renders null when gate is null → no chip.

## Machinery is LIVE (grep + control contrast)
MA-1170 (Mind Flayer Arcanist Shield, FIXED 2026-09-25, §483) shipped the full shield channel:
- Registry entry: `MonsterCardHelpers.js:1026` `shield: { effect:'shield', trigger:'targeted_by_spell', label:'Shield', icon:'fa-shield' }`
- Dedicated resolver branch: `resolveMonsterGatedReaction` → `def.effect === 'shield'` → `resolveMonsterShieldReaction` (`MonsterCardHelpers.js:1797`). **NOT** the parry channel — shield has its own resolver; the +5 AC fold rides the EXISTING generic `getShieldAcBonus` (`loggedDiceRollUtils.js:49`) read at `useLoggedDiceRollAttack.js:481`, consumed one-shot by `consumeShieldAcBonus` (`attackPostProcessing.js:222`, filters `effect==='shield' && oneShot:true` so PC Shield-spell buffs survive — §483).
- Stamp builder `buildShieldBuff` (`MonsterCardHelpers.js:1416`): `{ effect:'shield', acBonus: automation.acBonus || 5, oneShot:true }` — acBonus MUST come from authored row; RAW Shield = **+5 AC**.
- **Control proof:** same encounter, Mind Flayer Arcanist card Shield row arms chip `Shield (999 left)` (`span.mc-dice-link` ×1) — channel reachable end-to-end; Noble Prodigy's zero-affordance is a pure disk-row defect.

## Fix (DATA only — copy Mind Flayer Arcanist block verbatim)
In `public/data/monsters.json`, Noble Prodigy reactions[0], add to existing row (keep name/trigger/description):

```json
"usage": "At Will",
"uses": 999,
"maxUses": 999,
"automation": {
  "type": "reaction",
  "trigger": "targeted_by_spell",
  "effect": "shield",
  "acBonus": 5
}
```

- `acBonus: 5` per Shield spell RAW (+5 AC; Noble Prodigy AC 16 → 21 against the triggering spell attack).
- 1/round reaction economy + honest uses counter ride the §60 At-Will sentinel (`usage:"At Will"` + uses/maxUses:999): every press spends `MONSTER_REACTION_USES[shield]` (999→998) + `_shield_usedRound` latch + `lastAttack.shieldResolved` stamp (MA-1170 shape; MA-0013 latch lineage).
- Gate keys off spell-origin lastAttack (`isSpellOriginLastAttack` MA-0013 seam) with this monster as target, damage NOT yet committed (MA-0548 pending window) — §483.
- After edit: monsters.json stale-cache caveat (§3) — close card ×, re-select campaign, reopen; EB-joined combatants keep stale snapshots → remove + re-join for live verify.

## Post-fix verify recipe
§483 MA-1170 flow byte-holds: spell-origin lastAttack seed + pending window → avatar `el.click` over pending → chip `link.click()` (§233 z-order) → armed activeBuffs stamp → next attacker resolve folds effAc 16→21 (`shield:5`, hit:false if total ≤20) → `shield_consumed` → effAc back to 16; chip counter decrement in place.

## Test pin caution (§216 stale-pin inversion)
`MonsterCardHelpers.ma1170-shield-reaction.test.js:194` and any census tests pinning non-Arcanist shield rows → null may need inversion when Noble Prodigy row gains automation. Grep for row-→null pins before landing.
