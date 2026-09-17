# BUG MA-0388 — Bestial Spirit (Air) "Beast's Strike": dynamic-formula zero-affordance dead row (FAIL)

**Verdict: FAIL** — MA-0014/MA-0286 dynamic-formula class. Row renders as plain text with raw unresolved tokens; no to-hit chip, no damage chip, no affordance of any kind; forced clicks inert; nothing rolls, nothing logs.

Campaign: test-campaign ONLY (header + `__campaign__` verified). localhost:5173.

## Row
- monsterIndex `bestial-spirit-air`, actionIndex 0, "Beast's Strike", type attack, reach 5 ft.
- description: "Melee Weapon Attack: +spell attack modifier, reach 5 ft. Hit: 1d8+2+WIS modifier Piercing damage."
- damageDicePrimary "1d8+2+WIS modifier" (dynamic); NO fixed attackBonus.

## Disk dump — monsters.json actions[0] FULL keys
`name, description, attack_bonus: null, reach, damage_dice_primary, damage_type_primary` — no `spell_attack_bonus`, no caster/spellcaster, no summoner-link keys in the flat block.

## Grep evidence — dynamic resolvers require caster context absent from EB join
- `summonSpiritHandler.js:60` and `primalCompanionHandler.js:88` replace "+spell attack modifier" / "WIS modifier" **only at summon time**, from `playerStats` (spellAbilities.toHit, Wisdom bonus) — i.e. the creature is resolved when a caster casts Summon Beast/Spirit Companion.
- An EB-joined flat NPC ("Bestial Spirit (Air) 1") has no caster link; cs creature keys dumped (name/ac/hp/init/targetName/saveBonuses/monsterIndex) — no caster/spellAttack fields. Tokens can never resolve on this path.
- `MonsterCardHelpers.js:266` `attackRowMissingToHit` (MA-0286): attack wording + `attack_bonus == null` → TRUE → `MonsterAction.jsx:41` `ActionDamageLinks` returns null. Attack chip branch requires `attack_bonus != null` → not rendered. No save_dc → no save affordance. No legendary/reaction gates.

## E2E evidence (test-campaign)
- Header `test-campaign` ✓; EB search exact 1 row → Selected Monsters (1) → Join. cs: ac11 hp20/20 init12 monsterIndex bestial-spirit-air.
- Armed: spirit target combobox → ElderPaladin; cs curl `targetName: "ElderPaladin"` ✓; EP initiative card HP 224/224 top (AC 19 per MA-0387 precedent, same store).
- Card DOM dump (`.mc-action` row): `<div class="mc-action"><strong>Beast's Strike.</strong> <span>Melee Weapon Attack: +spell attack modifier, reach 5 ft. Hit: 1d8+2+WIS modifier Piercing damage.</span></div>` — **chips: []** (zero `.mc-dice-link`/`[role=button]`/`button`); raw "+spell attack modifier" and "WIS modifier" text unrendered-resolved.
- Forced clicks ×3 (strong name / desc span / row container, force:true): popup null ×3, no modal, no roll UI.
- Log audit curl: 2 entries only (encounter joined + initiative roll). Zero attack rows, zero damage rows, zero hp_change from the 3 clicks.
- cs post-clicks: spirit 20/20, EP unchanged; change-data contains NO "NaN"/"undefined" strings (no math executed at all).

## Root cause
By-design MA-0286 honest suppression (auto-hit prevention) with no alternate affordance: dynamic "+spell attack modifier"/"WIS modifier" are resolvable ONLY through the summon-spell caster path (summonSpiritHandler/primalCompanionHandler); an EB-joined instance has no caster context, so the row is permanently inert — the GM has no way to roll this attack.

## Cleanup
- Admin native confirms BOTH naming "test-campaign"; curl verified `change-data {}` / `log []` ✓.

## Notes
- One navigate call executed an off-localhost aliyuncs proxy wrapper URL (403, static page, no state impact); recovered by re-navigating localhost:5173 and re-verifying header. page.url() localhost throughout the rest; curl localhost = truth.

VERIFIED: FAIL
