# BUG MA-1522 — Sprite "Invisibility" (sprite|actions|3) — FAIL(b)/DATA

**Date:** 2026-09-28 · **Campaign:** test-campaign ONLY · **Rig:** EB-joined initiative LIVE: Sprite 1 (init 21, hp 10) + Bandit 1 (hp 996)

## Row (verbatim disk, `public/data/monsters.json` sprite actions[3])
```json
{"name":"Invisibility","description":"The sprite casts Invisibility on itself, requiring no spell components and using Charisma as the spellcasting ability."}
```
Keys: `name` + `description` ONLY. NOT a "Spellcasting" row (plain Invisibility action, §57 lane n/a without markup).

## Verdict: FAIL(b) — inert plain-text row, zero affordance (§60/§114 fingerprint)
Not FAIL(a): zero bogus side-effects proven below. Not PASS-subset: no advisory sentinel, no te granted, nothing recordable.

## Evidence
### Static grep
- `automation` ABSENT → `isMonsterSelfBuffRow` false (monsterSelfBuff.js:25-26); self-buff chip gated on it (MonsterAction.jsx:256).
- `advisory` ABSENT → AdvisoryLink never renders (MonsterAction.jsx:335-339, MonsterCardModal.jsx:582).
- `spell_save_dc`/`spellcasting_ability` ABSENT → `isUtilitySpellCastRow` false at gate (MonsterCardHelpers.js:388).
- Description has NO `<strong>/<em>` markup → `extractSpellNamesFromSpellcasting` = [] (§57/MA-0421) → no spell chip.
- `attack_bonus`/`save_dc`/dice ABSENT → no +0 junk chip either (cleaner than quasit MA-1369 which carried `attack_bonus:0`).
- te `invisible` IS registered (targetEffectDefinitions.js:778); producers = automation self-buff rows only. Sprite = UNARMED twin (MA-1369 census: unarmed quasit/sprite/will-o'-wisp vs armed duergar/green-hag/imp).

### Live (Playwright, DOM + API GETs only)
- Card row DOM: plain `<div>` = `<strong>Invisibility.</strong> <span>…</span>` — links 0, buttons 0, inputs 0, `.mc-dice-link*` 0, cursor:auto.
- Press ×2 (strong + description span, DOM `.click()`): popup-overlay/sp-modal/sp-overlay/dsp-overlay count 0→0→0.
- Log: 54 → 54, ZERO new entries (whole-log invisibility-scan: 0 hits).
- Sprite state: activeConditions None; `Sprite 1` change-data keys unchanged (`_lastRollContext`,`lastAttackRoll`,`lastSaveRoll`,`pendingCombatSuperiorityPrompt` — all pre-existing MA-1519/21 residue); top-level `targetEffects` KEY ABSENT → no `invisible` te granted, no `invisible_granted/_ended`.
- No bogus side-effects: Bandit 1 hp 996 unchanged, conds None; `pendingSavePrompts` KEY ABSENT (no forced DC save); `lastAttack` unchanged (stale MA-1521 Heart Sight stamp).
- Console: 0 errors; only pre-existing warnings (apple-mobile meta, class_level_scaling) — NO "Spell not found" fake-chip noise.

## Fix (zero code — imp MA-1019 byte-shape, sanctioned armed twin)
```json
{"name":"Invisibility",
 "description":"The sprite casts <strong>Invisibility</strong> on itself, requiring no spell components and using Charisma as the spellcasting ability.",
 "spellcasting_ability":"Charisma",
 "automation":{"type":"monster_self_buff","effect":"invisible","rounds":600}}
```
Self-buff lane then arms: chip → te `invisible` on self + ONE merged 600-round clock (§37 hours×600) + grant log; attack/cast enders already LIVE (MonsterCardModal.jsx:1963-1964, 2122). Concentration-break ender + invisibility advantage adjudication = §70 advisory residuals (MA-0658 twin precedent). Sprite Concentration trait (maintain two spells) = §70 residual.

## End state / cleanup
Sprite block ends at MA-1522 (MA-1523 = next monster). Admin cleared change-data + log at end (quiet 0/0).
