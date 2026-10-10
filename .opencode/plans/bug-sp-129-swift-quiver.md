# SP-129 Swift Quiver — E2E VERIFICATION RESULT: FAIL

**Campaign:** test-campaign · **Host:** FeyRanger (lv17, 2024, Gloom Stalker Ranger, Longbow equipped) · **Victim:** Bandit 1 (AC 12, maxHp rigged 999) · **Date:** 2026-10-09

## Canonical spell (public/data/2024/spells.json)
- Level 5, Ranger, Transmutation, Casting Time: **Bonus Action**, Range Self, **Concentration up to 1 minute**, material "a Quiver worth 1+ GP".
- Text: "…you can make two attacks with a weapon that fires Arrows or Bolts… The spell magically creates the ammunition needed for each attack. Each Arrow or Bolt… disintegrates immediately after it hits or misses."
- Automation block: `{ type: "concentration_bonus_attack", trigger: "each_turn", action: "bonus_action", weaponAttack: true, concentrationSpell: "Swift Quiver", attacks: 2, weaponRequirement: "arrow_bolt_weapon", attack_type: "ranged" }`

## Lane (src/)
- `src/services/rules/core/attackCalc2024.js` — `findSwiftQuiverBow` (:423), `resolveSwiftQuiverStats` (:437), `buildSwiftQuiverAttack` (:451), `buildSwiftQuiverAttacks` (:476), pushed into getAttacks at :591.
- Gate: combatSummary creature `concentration.spell === 'Swift Quiver'` (:479-480). Damage formula cited from code: `1d8 + Dexterity Modifier (5)` (Longbow 1d8 Piercing, DEX +5, to-hit +9 = DEX 5 + PROF 4).

## What passed
1. **Cast OK.** Prepared list was missing Swift Quiver; added via wizard step 14 (mi-overlay `.mi-skip` dismissed first; row toggle requires `.list-item-checkbox-trigger` click — plain row/double clicks no-op). Persisted: spells[] = [Pass Without Trace, Hunter's Mark, Summon Fey, Swift Quiver].
2. **Slot burn OK.** Lv5 slot 1→0 (`spell_slots_level_5: 0`).
3. **Concentration stamp OK.** combatSummary FeyRanger `concentration: { spell: "Swift Quiver", dc: 17 }` (survived page reload).
4. Cast produced advisory popup "Swift Quiver: No target selected — no attack made." (Done button present) — self-target advisory only.

## BLOCKER (root cause)
**Bonus-action attack affordances never appear.** Post-cast (and after full reload), the sheet's Bonus Actions section lists only castable bonus spells (Cure Wounds, Pass Without Trace, Summon Beast, Swift Quiver, Summon Fey) — no "Swift Quiver (1st Attack)" / "(2nd Attack)" rows, no inline affordance anywhere (grep of rendered DOM: no `Swift Quiver (` matches).

**Root cause:** `buildSwiftQuiverAttack` (attackCalc2024.js:451-470) emits `actionType: 'Bonus Action'` but **omits `type: 'Bonus Action'`**. `CharBonusActions.jsx:867` filters `if (attack.type !== 'Bonus Action') return false;` → both Swift Quiver rows are silently dropped from the BA lane. Every sibling BA builder sets both fields (e.g. off-hand :207-208, Dual Wielder :404-405, Psychic Blade :403-405).

**Why tests are green:** `attackCalc2024-special-attacks.test.js:134-136` asserts only `name` and `isSwiftQuiver`; test helper normalizes `type: opts.actionType`, so the missing field is never caught at unit level, and no component test covers the CharBonusActions filter for these rows.

## Blocked verifications (consequence of blocker)
- Two BA attacks resolving (rolls/damage logs) — **cannot press, affordance absent**.
- Once-per-turn BA gate (third press) — not testable.
- Concentration break → BA gone — BA was never present; concentration badge itself works (renders "Swift Quiver DC 17").
- Ammunition/conjured retrieval: advisory text only in spell description; no retrieval automation in lane (grep: no retrieval handler). Advisory-only per raws text "disintegrates immediately after it hits or misses" — acceptable as note, not a gap.

## Suggested fix (not applied — verify-only task)
In `buildSwiftQuiverAttack` add `type: 'Bonus Action'` alongside `actionType` (match sibling BA rows). Add unit assertion `expect(result[0].type).toBe('Bonus Action')` and a CharBonusActions render test gate.

## Verdict: **FAIL**
Cast pipeline + concentration stamp solid; the core payoff (2× BA attacks) is unreachable in the UI due to missing `type` field on built attack rows.
