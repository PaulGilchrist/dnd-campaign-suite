# BUG MA-0442 — Bugbear Stalker Morningstar: Grappled-on-hit clause inert (hit_conditions absent)

**Row:** MA-0442 `bugbear-stalker|actions|2` — Morningstar, +5, 2d8+3 Piercing, reach 10 ft., "(with Advantage if the target is Grappled by the bugbear)", manifest `conditions:["grappled"]`.
**Verdict:** FAIL — flavor (b) (prose-only hit condition; core attack PASS, on-hit Grappled never applies).
**Date:** 2026-09-18 · campaign test-campaign · localhost:5173 · victim AasimarTest (AC12)

## PASS (core attack exact)
- Disk: monsters.json bugbear-stalker actions[2]: attack_bonus 5, damage_dice_primary "2d8 + 3", damage_type_primary Piercing, reach "10 ft."; prose "+5" / "12 (2d8 + 3) Piercing" byte-consistent.
- 16 to-hit logs: bonus=5 ALL, targetAc=12 ALL. Boundary flip log-decisive: nat7 total 12 vs AC12 HIT (exact); max miss total 10; hits 12–25.
- 10 damage rolls, formula "2d8 + 3" ALL, total==finalDamage ALL: 11,15,13,13,11,11,12,9,13,23 == |hpΔ| chain 143→132→117→104→91→80→69→57→48→35→12 exactly.
- nat20 crit: "2d8*2+3 (8,2)" = 23 — dice-only doubled, flat mod undoubled (MA-0433/0438 precedent).
- 6 misses → zero damage rolls, zero hp_change.

## FAIL (b) — Grappled on hit inert
- Disk: Morningstar row authors NO `hit_conditions` (and no `escape_dc`, `automation`, `target_prerequisite`).
- Consumer `buildHitConditionClause` (src/components/encounter/MonsterCardHelpers.js:526-528) reads `action.hit_conditions` ONLY → returns null for this row → forwarded `hitClause:null` (MonsterCardModal.jsx:656) → `maybeApplyHitClause`/`applyHitClauseConditions` (handlePlainDamage.js:488/:525) never fire.
- Live proof: 10 hits, ZERO `type:condition` log entries, ZERO "grapple" tokens anywhere in the 38-entry log, AasimarTest `activeConditions` never present in change-data.
- Fingerprint family: MA-0291 / MA-0361 / MA-0434 / MA-0288 (identical grapple-on-hit twin).

## Secondary — conditional-Advantage clause compound-inert
- "(with Advantage if the target is Grappled by the bugbear)": no authored field, no prose parser ("with Advantage" grep-zero in MonsterCardHelpers.js / MonsterCardModal.jsx); grappled→advantage channel is PC-feat-only (`grappled_advantage` in src/services/automation/contextBuilder-sync.js:198, Grappler feat gated). Playbook §6: "monster auto-adv-vs-grappled prose inert (PC-feat-gated)".
- Live: 0/16 rolls mode:"adv" (all "normal"; second die cosmetic per §92). Compound: clause reachable only via Grappled state, which itself never lands (hit_conditions absent) — single data fix also unblocks the prerequisite state, though no adv-granting consumer for monsters would exist even then.

## Fix template (data-only, MA-0302/MA-0434 style)
On bugbear-stalker Morningstar row author:
`"hit_conditions": ["grappled"], "escape_dc": 16` (STR 16 per bugbear-stalker statblock; verify vs source before writing). Register nothing new — MA-0010 seam + MA-0019 by_attacker prereq already live. Note: RAW bugbear Grapple escape DC = STR 16 (AC 15+? — GM to confirm against book DC before stamping). Monster-side "adv vs grappled-by-me" grant remains an app-wide gap (do NOT rebuild without ticket; advisory acceptable).

## Live rig notes
- URL-bar nav to /initiative dropped campaign select (re-select, then nav-button). cs retains monster + armed target after re-select.
- EB exact search pre-narrows; join landed cs idx 0 correct species. Arm via attacker's OWN initiative-card combobox (own card excludes self).
- Popup stage-1 miss has no Done (backdrop click dismiss); hit stage-2 Done = button.dice-roll-reroll-btn applies damage.
