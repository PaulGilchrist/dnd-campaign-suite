# Bug MA-0014 — Aberrant Spirit (Beholderkin) "Eye Ray": clickable damage chip rolls nothing

## Title
Eye Ray damage chip `1d8+3+spell level` renders but click is a silent no-op — no to-hit roll, no damage roll, no log entry.

## Expected
Dynamic token resolution: a non-numeric spell attack/damage formula (`+spell attack modifier`, `+spell level`) should resolve to numbers (caster spell attack bonus, current spell level) and roll/log normally — matching how numeric-token actions behave.

## Actual
- No d20 to-hit affordance at all (`attack_bonus: null` → attack link suppressed, MonsterAction.jsx:54,63).
- Damage chip `1d8+3+spell level` IS rendered (clickable button in `.mc-overlay`), but clicking produces no popup, no damage, no campaign-log entry (log stayed at 4 entries before/after click).

## Repro
1. http://localhost:5173 → test-campaign → Encounters.
2. Search "Aberrant Spirit" → check "Aberrant Spirit (Beholderkin)" → Join Encounter (lands in Initiative; target AasimarTest).
3. Open monster card overlay (.mc-overlay) → Actions → click the `🎲 1d8+3+spell level` chip on Eye Ray.
4. Observe: nothing happens; log count unchanged (GET /api/campaigns/test-campaign/log → 4).

## Location
- `public/data/monsters.json` — aberrant-spirit-beholderkin: `attack_bonus: null`, `damage_dice_primary: "1d8+3+spell level"`, no `spell_attack_bonus`/numeric fields.
- `src/components/encounter/MonsterAction.jsx:54,63` — attack link requires non-null `attack_bonus`.
- `src/components/encounter/MonsterCardModal.jsx:29-30` — `extractDamageDiceFromDescription` passes the truthy non-numeric string through unchecked, so an unroll­able chip renders.
- `src/components/encounter/MonsterCardModal.jsx:543-561` — `handleDamage` calls `rollExpression("1d8+3+spell level")`.
- `src/services/dice/diceRoller.js:42` — `parseExpression` regex `^(\d+)?d(\d+)((?:[+-]\d+)+)?$` fails on `+spell level` → returns null → `if (result)` skips rollDamage/log silently.
- Grep-zero consumer of dynamic tokens in monster path: only `spell_attack_bonus`/`spell_save_dc` check at MonsterCardModal.jsx:219 (needs numeric fields the data lacks; `/spell attack/i` description match only tags `isSpellDamage` on an attack roll that can never fire).

## Notes
Known MV-6 rule covers missing `attack_bonus` → static text/no dice link; the gap here is that the damage link still renders for an unparseable formula and dies silently in `handleDamage`. Fix options: resolve `spell level`/`spell attack modifier` tokens against caster data before rolling, or suppress the chip (and surface text only) when `parseExpression` returns null.
