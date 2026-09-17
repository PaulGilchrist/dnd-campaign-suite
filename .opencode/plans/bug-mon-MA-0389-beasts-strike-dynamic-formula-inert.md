# Bug MA-0389 — Bestial Spirit (Land) "Beast's Strike" — dynamic-formula row inert (FAIL)

**Verdict: FAIL** — MA-0014/MA-0286 chip-suppressed inert twin; zero affordances, dynamic tokens unresolved, forced clicks produce nothing. Identical fingerprint to MA-0388 (Bestial Spirit Air) sibling, plus multi-slash damage-type parse noise.

## Row
- id MA-0389 | Bestial Spirit (Land) (monsterIndex `bestial-spirit-land`) | actionIndex 0 | "Beast's Strike" | type attack
- `attack_bonus: null`; `damage_dice_primary` "1d8+2+WIS modifier"; `damage_type_primary` "bludgeoning/piercing/slashing"
- description: "Melee Weapon Attack: +spell attack modifier, reach 5 ft. Hit: 1d8+2+WIS modifier Bludgeoning/Piercing/Slashing damage."

## Evidence (test-campaign, localhost:5173, header verified)
1. **Disk**: monsters.json actions[0] has no numeric attack_bonus, no caster/spell_attack_bonus, no summoner-link keys. Same flat block as MA-0388 twin.
2. **Code path (known fingerprint, confirmed not re-derived)**: `attackRowMissingToHit` (MonsterCardHelpers.js:271) matches "Melee Weapon Attack" wording + `attack_bonus == null` → TRUE → `ActionDamageLinks` returns null (MonsterAction.jsx:41) → no damage chip; attack chip requires numeric attack_bonus → no attack chip. "+spell attack modifier"/"WIS modifier" resolve ONLY at summon time via caster context (summonSpiritHandler.js:60, primalCompanionHandler.js:88); EB-joined flat NPC has none → tokens never resolve.
3. **DOM (modal via avatar click)**: `.mc-action` row renders as plain text: `Beast's Strike. Melee Weapon Attack: +spell attack modifier, reach 5 ft. Hit: 1d8+2+WIS modifier Bludgeoning/Piercing/Slashing damage.` — ZERO buttons/chips/badges/links, cursor:auto. Multi-slash type appears ONLY as raw substring of description text; no parsed damage-type chip/render — multi-slash adds parse noise but nothing renders.
4. **Forced clicks ×3** on the row: visible popup/dialog probe `[]` all three times; no roll, no prompt, no pipeline event. Row inert.
5. **cs/log null-proofs**: change-data contains no NaN/undefined; targetName=ElderPaladin retained; HP 30/30 unchanged. Log = exactly 2 entries (encounter joined + initiative roll); zero attack/damage entries from clicks. (Row 1's sibling "Beast's Strike — Charge" retains its functional "DC 20 Str" save chip — proves modal rows DO render affordances when authored data permits; suppression is specific to MA-0389.)

## §290-292 popup / MA-0273 notes
No popups triggered (§290-292 N/A — nothing fires). MA-0273 class behavior unchanged.

## Cleanup
Admin native confirms naming test-campaign: Clear Change Data → `{}`, Clear Campaign Log → `[]`, curl-verified.
