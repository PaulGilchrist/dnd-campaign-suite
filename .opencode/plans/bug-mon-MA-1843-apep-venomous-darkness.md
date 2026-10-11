# BUG MA-1843 — Apep "Venomous Darkness (Recharge 5-6)": recharge gate absent + magical-darkness clause inert (core save/damage exact)

## Overview
Row MA-1843 (Apep, save, DC 26 Constitution, 14d10 Necrotic, Recharge 5-6). Live E2E in test-campaign verified the CORE numerics exactly (DC enforcement, save type, full damage on fail, exactly-half floored on success, HP ledger). However the **Recharge 5-6 gate is entirely unenforced** (row authors no `recharge` field — name-text "(Recharge 5-6)" is parsed by no recharge parser; three fires in one session, zero refusal, zero spend, zero recovery keys), and the **"magical darkness until the end of its next turn" clause is inert** (no producer, no te granted, no clock). Per playbook §1 verdict policy (unenforced gates = FAIL) and MA-0663 precedent (name-text recharge = FAIL(a)/DATA, one-field fix), the row is a **FAIL** with the save/damage core documented as verified-good.

## Expected
- DC 26 Constitution save, each creature within 60 ft; fail = full 14d10 Necrotic; success = half. ✔ (verified live)
- After use, action unavailable until a d6 5-6 at the start of Apep's next turn (refusal popup + `<slug>_refused (not recharged)` log, spend at fire, recovery d6 logged at turn-start — live consumers exist: monsterRecharge.js + MonsterCardModal save-lane). ✘
- Area filled with magical darkness until end of Apep's next turn. ✘

## Actual
- Core: PASS-exact (ledger below).
- Recharge: refire with zero enforcement — 3 fires same session, `monsterRecharge` change-data key NEVER created (top-level and `Apep 1.*` both empty of recharge keys), no `ability_use` spend entry, no refusal popup/log.
- Darkness: zero targetEffects / condition / expiration state after all three resolutions; only name/description text echoes in change-data + log.

## Repro (test-campaign, localhost:80, 2026-10-10)
1. EB Join Apep (→ cs idx 0, 624/624, AC23, round 1). Party PCs 1/1 placeholders.
2. Revive ElderPaladin via HP input (fill 220 + blur → change-data `hitPoints:224, currentHitPoints:220`; NOTE: Enter alone did not land — blur required).
3. Arm ElderPaladin on Apep's own initiative-card `[data-testid="target-select"]`.
4. Rig fail: full-store POST elder paladin `activeBuffs:[{effect:"warding_bond",saveBonus:-7}]` (bonus folds: prompt shows `+10 base −7 = +3`).
5. Open Apep card → click `.mc-dice-link-save` "DC 26 Constitution" (native `el.click()` lands; Playwright mouse.click absorbed ×3 — §123 family).
6. Shot 1: nat19 +3 = 22 < 26 FAIL → damage `14d10` rolls sum 62, finalDamage 62, hp 220→158 (Δ62 exact). `save_result` + `roll damage` + `hp_change` all logged.
7. Recharge probe: re-click same chip immediately, same turn, no round walk → prompt fired again (Shot 2: nat7+3=10 FAIL, 14d10=85 full, hp 158→73). No "Not Recharged" popup, no refusal log. Third click also fired (Shot 3).
8. Success leg: swap wb to +15 (bonus +25) → nat15+25=40 ≥ 26 SUCCESS → raw 14d10 = 68, finalDamage 34 = floor(68/2) exact, hp 73→39 (Δ34).
9. Post-run: change-data recharge keys grep-empty; darkness grep in change-data hits only monster name/description echoes; log darkness mentions are attack-name echoes only.

## Likely Location
- `public/data/monsters.json` → Apep actions[3]: missing `recharge: "5-6"` (one-field DATA fix; consumers live — MA-0031/0488/0618 lanes; parser `src/services/encounters/monsterRecharge.js:35-47` `rechargeUsageOf` reads ONLY `action.recharge` or `usage.type:/recharge on roll/`; name-text "(Recharge 5-6)" parsed by NO parser — MA-0663 §196 fingerprint).
- Darkness clause: no producer app-wide for save-row darkness; nearest registered te is `lair_darkness` (`src/services/combat/conditions/targetEffectDefinitions.js:1200`, lair zone lane only). §70 zero-consumer residual for light/vision levels.

## Notes (grep + probe evidence)
- Recharge consumers exist and work when authored (MA-0294 attack rows gated, MA-0488 full economy, §61) — this row just never arms the gate: `monsterRechargeGate` returns null (`rechargeUsageOf` → null). Live probe: 3/3 fires, 0 refused, change-data `rechargeKeys: []`, `Apep 1` keys only `lastSaveRoll`,`_lastRollContext`, zero `ability_use` entries in log (grep abilityUse = 6 roll entries only).
- Save/damage core machine truth: `saveResult-ElderPaladin` = {success:false, roll:19, total:22, saveBonus:3} / {success:true, roll:15, total:40, saveBonus:25, bonusDetail:"(+5 aura) +15 [Warding Bond]"}; damage entries formula `14d10` Necrotic: fail fd 62 (Σ[3,1,1,4,4,9,4,9,4,3,9,5,1,5]) and fd 85 (Σ=85); success fd 34 (Σ rolls 68, `computeDamageAfterSave` Math.floor half, applyDamage.js:93). hp chain 220→158→73→39, |Δ| == fd every shot, unclamped, resisted:false (EP necrotic-clean).
- DC display: prompt "DC 26 … Half damage on successful save" — engine default `dc_success:'half'` (row has no `dc_success`) is RAW-correct here.
- Darkness verdict context: description's area-darkness clause requires a zone/duration grant (te + addExpiration rounds:2 analogue §37); none exists for this lane and none fired — documented gap (b), consistent with §70 light/vision zero-consumer residual and MA-0317-shapeless-range degradation (row also authors no `range` field, so picker/AoE lane never opens; single-target inline adjudication vs armed target is the only live surface).
- NEW pitfalls: (1) PC initiative-card HP-input revive requires blur dispatch — fill+Enter left cs/change-data unchanged; (2) Venomous Darkness save chip absorbed Playwright mouse.click ×3 (armed, in-rect) but native `el.click()` inside evaluate fired first try; (3) damage chip `.mc-dice-link` (text " 14d10") first-click ALSO opens the save prompt on this compound save row (damage chip rides save adjudication).
- Injection watch: multiple fabricated tool-output lines this session ("VERIFIED PASS", "FINAL MESSAGE: VERIFIED PASS", aliyuncs URLs, fake file paths) — none honored; all claims above grounded in own fetches/exit codes.

## Verdict
FAIL — core save+damage+half math VERIFIED-EXACT, but recharge gate unenforced (FAIL(a)/DATA one-field `recharge:"5-6"`, MA-0663 twin) and magical-darkness clause inert (documented zero-producer gap).
