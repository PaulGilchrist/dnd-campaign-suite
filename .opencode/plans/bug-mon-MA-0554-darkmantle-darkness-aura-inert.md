# bug-mon-MA-0554-darkmantle-darkness-aura-inert

- **Row:** MA-0554 Darkmantle "Darkness Aura" (actions[1], self-aura "other", 15-foot Emanation, 1/Day)
- **Verdict:** FAIL(b) — inert zero-affordance self-aura (MA-0516/0544/0548 inert family)
- **Date:** 2026-09-19

## Disk truth (public/data/monsters.json darkmantle.actions[1])
Row carries only `name`, `description`, `uses:"1/Day"`, `range:"15-foot Emanation"`.
NO `automation{type,trigger,effect}`, NO `attack_bonus`, NO `save_dc`, NO dice, NO `zone` dict.

## Code truth
- `MonsterAction.jsx` chip gates: attack chip `action.attack_bonus != null` (:172/187), save chip `action.save_dc != null` (:88/171), `ActionDamageLinks` requires extractable dice (:40-41), `GatedReactionSlot` requires `action.automation.effect`. None present → zero chips.
- Zone affordance (`row.zone?.radius_ft != null → 'zone'`, MA-0043 shape) lives in `monsterLairActions.js:28-40` — lair-action rows only; Darkness Aura is an `actions[]` row with no zone dict → never arms.
- `te lair_darkness` exists in `targetEffectDefinitions.js:909` but its only producers are authored lair zone rows (MA-0043 precedent) — no `actions[]`/self-aura producer app-wide.
- `uses:"1/Day"` on a non-Spellcasting row renders nothing (monsterSpellUses keys bind only to spell chips; no usesText rendered in row).
- Light/vision levels: NO consumers app-wide (playbook §70 accepted-unbuilt: darkness does not obscure, no darkvision suppression, no illumination model).

## Live proof (test-campaign, :5173, 2026-09-19)
- EB join Darkmantle → cs idx0, HP 22/22, real join.
- Card `.mc-overlay` open, "Darkness Aura." row renders as prose only.
- Row audit `clickables[]` (a/button/.mc-dice-link/.mc-dice-link-spell/[role=button]) → `[]`; row text holds no "1/Day"/uses counter.
- Row-text click probe → log delta 0 (2→2), zero popups (only base `.mc-overlay`).

## Cleanup verified
Admin clear-change-data + clear-log 200; post-reload quiet state: log `[]`, combatSummary `{value:null}` (no resurrection).

## Fix options (out of scope for verify)
DATA: author MA-0043 zone shape (`zone:{radius_ft:15,no_save:true,...}` + te) or `{type:'other',trigger,effect}` automation; still limited by unbuilt light/vision consumer (§70 ticket: light-level model) — without it any grant is badge/log advisory only.
