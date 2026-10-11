# BUG MA-1898 — Garmr "Corpse-Fire Breath (Recharge 5-6)": recharge gate absent (cone/save/damage core exact)

## Overview
Row MA-1898 (Garmr, aoe-save, DC 24 Dexterity, 12d10 Necrotic, 60-ft Cone, Recharge 5-6). Live E2E in test-campaign verified the CORE numerics exactly — cone picker opens multi-target, DC 24 DEX enforced, fail pays full 12d10 exact per target, success pays floor-half exact, Necrotic-only, HP chains exact on both victims. The **Recharge 5-6 gate is entirely unenforced**: row authors no `recharge` field (no `usage` dict either), so `rechargeUsageOf` (monsterRecharge.js:30-45) returns null and the gate never arms. Two fires in one fight, zero refusal, zero spend, zero recovery keys. MA-1843/MA-1859 breath-twin fingerprint. One-field DATA fix: `"recharge": "5-6"` on actions[3] (consumers live — MA-0488/0618 lanes, flat `recharge:"5-6"` enforced spend + `.mc-recharge-refusal` + d6 recovery at own turn-start).

## Expected
- DC 24 Dexterity, each creature in 60-ft Cone; fail = full 12d10 Necrotic; success = half. ✔ (verified live, both targets)
- After use, action unavailable until a d6 5-6 at start of Garmr's next turn (refusal popup + `corpse_fire_breath_refused (not recharged)` log, spend at fire, recovery d6 logged). ✘

## Actual
- Cone picker: "60-ft Cone (GM positions tokens; selection advisory)" header; 12 selectable PC checkboxes (multi-target offer CONFIRMED — description-token cone parse Modal:147, NOT §211 range-less degradation despite absent `range` field); submit button "(2)" count tracked.
- DC/type enforcement: every prompt "DC 24" DEXTERITY, Source "Garmr 1"; picker text byte-matches row.
- FAIL leg (wb −30 rig): ElderPaladin nat10 + (−22) = −12 < 24 fail → 12d10 Σ[9,5,1,9,2,2,1,10,8,9,10,8]=73 finalDamage 73 hp 224→151; HexWarlock nat19 + (−31) = −12 < 24 fail → 12d10 Σ[10,10,10,9,10,8,10,1,5,9,2,9]=61 finalDamage 61 hp 103→42. Per-target separate 12d10 pools.
- SUCCESS leg (wb +30 rig, second fire = recharge probe): ElderPaladin nat9 + 38 = 47 ≥ 24 → raw 73, finalDamage 36 = floor(73/2) exact, hp 151→115; HexWarlock nat8 + 29 = 37 ≥ 24 → raw 72, finalDamage 36 = floor(72/2) exact, hp 42→6.
- Necrotic-only: every damage entry damageType "Necrotic"; zero other types; both victims disk resistances/immunities [] (necrotic-clean; AasimarTest/War_Cleric avoided as Necrotic-resist).
- HP truth: change-data currentHitPoints chains EP 224→151→115, HW 103→42→6; |Δ|==finalDamage every shot, unclamped.
- Recharge: second press same fight reopened picker and fired (2nd `ability_use` "Corpse-Fire Breath (Recharge 5-6)" logged); NO refusal popup/log, NO spend, change-data recharge-state keys grep-empty top-level AND per-char (no `monsterRecharge`, no `corpse_fire_breath_refused`).

## Likely Location
- `public/data/monsters.json` → Garmr actions[3]: missing `"recharge": "5-6"` (one-field fix; name-text "(Recharge 5-6)" parsed by NO parser — MA-0663/MA-1843/MA-1859 fingerprint).
- `src/services/encounters/monsterRecharge.js:30-45` rechargeUsageOf reads only flat `action.recharge` / `usage.type:"recharge on roll"`.

## Notes / pitfalls
- NEW: Leading Evasion chooser overlay (HeroesFeastBard) auto-opens BEFORE each per-target save prompt on this PC AoE run; Skip is mandatory per prompt — clicking "Roll Save" while it stands lands but the evasion decline must be logged first (`leading_evasion_declined` per target). Not a defect; expected chooser, budget one extra Skip per target.
- Prompt queue shows "(1 of 2)" only on first target; subsequent prompts render without the counter.
- MA-1843 chip-absorb held FALSE this session: native el.click() fired the DC chip first try both legs.
- MA-1896 URL-bar /encounters nav deselect trap re-confirmed; reload also deselects — campaign button re-select required.
- Stray fabricated non-localhost URL echoes appeared in two navigate tool responses (MA-1843 injection-watch pattern) — not honored; page URL verified localhost throughout.

## Verdict
FAIL(b)/DATA — save core + cone multi-target + full/half math + HP ledger all VERIFIED-EXACT; recharge gate ungated (MA-1843/MA-1859 family, one-field fix `"recharge": "5-6"`).
