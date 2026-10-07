# Bug SP-075 — Magic Missile (2024) upcast level dropped in MM lane

## Symptom (live, test-campaign, DivinationWizard lv20, 2024)
Cast at Level = 2 selected (radio `Level 2 ... [checked]`), but:
- Distribute popup: "Magic Missile — 3 Missiles to Assign" / "Assigned: 0 / 3" (expect 4)
- Log spell entry: `spellLevel: 1, missileCount: 3, missileDamage: "1d4 + 1", damageType: "Force"` (expect spellLevel 2, missileCount 4)
- Slot ledger: `spell_slots_level_1` 2→1 consumed; `spell_slots_level_2` unchanged at 3.
  A level-2 slot was NEVER paid. (Matches prior CLA-Improved-War-Magic lead "12 force" = 3 darts at lv2.)

## Root cause (grep-probed)
Upcast level travels as `spell.upcastLevel` (SpellDetailPopup.jsx:321,331 `onCast({...spell, isUpcast, upcastLevel, ...})`)
but the Magic Missile lane reads only `spell.level`:

1. `src/hooks/combat/spellGates.js:455` — `gateMagicMissile`: `const slotLevel = spell.level || 1;`
   → `totalMissiles = 3 + (slotLevel - 1)` is always base-level (3). Ignores `spell.upcastLevel`.
2. `src/hooks/combat/useSpellMetamagicFlow/useComplexSpellHandlers.js:223` — `handleMagicMissileConfirm`:
   `const slotLevel = spell.level || 1` → `finalMetaCtx.slotLevel` always 1; line 232 hardcodes `isUpcast: false`
   → `prepareSpellCast` pays a LV1 slot. `executeMagicMissile` (helpers.js:567) then rolls `getMagicMissileCount(1)` = 3 dice.
3. `src/services/rules/spells/spellCastService/execution/helpers.js:497` — `getMagicMissileCount(slotLevel) = 3 + (slotLevel - 1)`
   exists and scales correctly, but never receives the chosen slot level.

## Rules note
Canonical `public/data/2024/spells.json` (magic-missile) description: "You create three glowing darts of magical
force. Each dart deals 1d4 + 1 Force damage to its target. The darts all strike simultaneously, and you can direct
them to hit one creature or several." `damage_at_slot_level` is `1d4 + 1` at every level (no 2024 scaling text).
The app's `3 + (slotLevel - 1)` formula is 2014-style scaling; whichever scaling is canonical for this app, the
slot ledger is objectively wrong (lv2 selection consumes lv1 slot) and the lane is internally inconsistent.

## Fix sketch
- spellGates.js:455 → `const slotLevel = spell.upcastLevel || spell.level || 1;`
- useComplexSpellHandlers.js:223 → `const slotLevel = spell.upcastLevel || spell.level || 1;`
  and pass `isUpcast: Boolean(spell.upcastLevel)` to prepareSpellCast.
- Verify popup total, executor dart count, and `spell_slots_level_N` debit at lv2 and lv4.

## Verified OK (lv1 base behavior)
- lv1 cast: 3 darts; split 2→Bandit 1 (raw 8), 1→Bandit 2 (raw 2), total 10; slot lv1 −1.
- All 3 darts one target: raw 10 on Bandit 1 (hp 3 → 0, overkill kill).
- Force damageType quoted in every spell log entry; NO attack-roll ledger entries (0 attack rolls).
