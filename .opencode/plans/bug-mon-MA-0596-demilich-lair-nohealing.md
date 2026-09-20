# MA-0596 — Demilich lair action "Unnamed lair actions 3" (no target can regain hit points until init 20): raw-string row renders zero affordance; te `no_healing` + consumer are LIVE but lair path has no te-grant producer

**Verdict: FAIL(b)/DATA** — `lair_actions[2]` is a RAW STRING (MA-0582/MA-0595 twin fingerprint): fails `isLairRowClickable`'s guard (`src/services/encounters/monsterLairActions.js:26` — `typeof row !== 'object' || !row.name` → false), renders a bare inert `<span>` with ZERO `.mc-dice-link-lair` chip, zero popups, zero log delta on fresh-rect click. **FIX depth is SHALLOWER than MA-0595:** unlike the antimagic sibling, the te `no_healing` IS registered (`targetEffectDefinitions.js:151`, group **'Defensive'**, not 'Spells') and its consumer chain is LIVE (`healingBlock.js` → `applyHealing.js:9` + `healingRoll.js:54` refuse-and-log). What is missing is a row→`name` + a lair-path te-grant producer (§46 zone/advisory templates stop at save/attack/damage/zone/advisory — none writes a targetEffect); plus the §46 advisory ceiling: initiative-20 cadence and multi-target selection remain GM-enforced (§70).

## Overview

Demilich `lair_actions` = MIXED array `[dict, str, str]` (MA-0594 nameless save dict, MA-0595 antimagic raw string, THIS row raw string no-healing). Manifest row MA-0596 description byte-matches disk row verbatim. Per §46, raw-string lair rows never become clickable (~600 legacy monsters keep static lair rendering); per §113 the `no_healing` te seam is LIVE but its **producer is `hit_target_effect` ONLY** (attack-row hit-clause), and the §113 `save_effect` decoy does not even apply here (raw string, zero structured fields).

## Expected (RAW row, verbatim from disk)

`public/data/monsters.json` Demilich `lair_actions[2]`:

```json
"The demilich targets any number of creatures it can see within 30 feet of it. No target can regain hit points until initiative count 20 on the next round."
```

Type: `str`. No `name`, no `zone`, no `effect_key`, no `save_dc`, no `hit_target_effect`, no `automation` block — nothing for the renderer or any grant seam to consume.

## Actual (fresh evidence, test-campaign, :5173)

**Static (STEP 1):**
- Disk dump above: `lair_actions` element types `['dict','str','str']`; row[2] `repr` byte-matches manifest MA-0596 description (len 154).
- te registry: `no_healing` at `src/services/combat/conditions/targetEffectDefinitions.js:151` — label "Can't Regain Hit Points", `cls: 'effect-debuff'`, **`group: 'Defensive'`** (§36 registry entry; task's "~500/Spells" guess corrected: `antimagic_field` sits at ~500 in the Spells group, `no_healing` is Defensive), `fields: ['source']`.
- ONLY producer seam: `hit_target_effect` — `parseHitConditionClause` reads `action?.hit_target_effect` (`src/components/encounter/MonsterCardHelpers.js:528` MA-0016 comment / :544 read) → armed on ATTACK rows only → consumer `applyHitClauseTargetEffect` grants the te on a resolved hit (`handlePlainDamage.js:619-643`, anchored expiry). Authored producers in monsters.json: exactly 3 attack rows (Slaad Claw, Bearded Devil Beard, Death Cultist Dread Scythe — MA-0016/0366/0556).
- Consumer LIVE: `src/services/rules/combat/healingBlock.js` (`isHealingBlocked`/`getHealingBlockEffect`, refusal logged) consumed by `applyHealing.js:9` and `healingRoll.js:54`.
- **Lair path cannot arm it:** `rg -in "target_effect|targetEffect|no_healing" src/services/encounters/monsterLairActions.js` = grep-zero; `lairRowAffordance` routes save/attack/damage/zone/advisory only — no te-grant branch. Row[2] is a raw string, so `isLairRowClickable` short-circuits at the `typeof` guard before any field read.

**Live (STEP 2):** campaign header verified `test-campaign`; EB joined exact "Demilich" (checkbox `checked:true` verified pre-Join; single filtered row; Bandit skipped as optional). cs: `Demilich 1` hp180 init 33, round 1 + lv-placeholder PCs (§93). Card opened via `img.avatar-image[alt="Demilich 1"]`: AC 20, HP 180 (72d4). 14 `.mc-action` rows; lair rows at DOM idx 8/9/10 = `lair_actions[0]/[1]/[2]`; idx 11–13 regional effects (out of ticket).

Row idx 10 (THIS row):
- `firstChild: SPAN`, `innerHTML: <span>The demilich targets any number of creatures it can see within 30 feet of it. No target can regain hit points until initiative count 20 on the next round.</span>` — bare, no lone-bold-"." prefix (that is the nameless-DICT fingerprint at idx 8 = MA-0594).
- interactive descendants (`a,button,[role=button]`): **0**; `mc-dice*` span classes: `[]`; `textLen: 154` (byte-match).
- `span.mc-dice-link-lair` count in whole overlay: **0** (row[1] twin idx 9 equally inert).
- Fresh-rect click at (858, 412.19) (scrollIntoView + re-acquired getBoundingClientRect immediately before click): `popups: 0`, `cardOpen: true`, chips still 0 — truly inert, nothing to absorb.
- Campaign log len **2** before and after click: `[encounter, roll]` join-noise baseline. Zero delta: no `ability_use`, no `lair_action_refused` (refusal path upstream-blocked by the string guard), no te/targetEffects write, no hp_change entries.

## Steps

1. Header `test-campaign`; EB join exact Demilich; cs shows `Demilich 1`.
2. Open card → Lair Actions row[2] renders bare inert span (no bold prefix, no chip); `.mc-dice-link-lair` = 0.
3. Fresh-rect click row[2] → no popup, no log delta (len 2 → 2).
4. `GET /api/campaigns/test-campaign/log` → `[encounter, roll]` join-noise only.

## Likely Location

`public/data/monsters.json` Demilich `lair_actions[2]` — DATA fix, two layers (shallower than MA-0595's three):

1. **Row shape (§46):** convert raw string to structured dict with `name` (e.g. "Stifling Mortality") so `isLairRowClickable` (`monsterLairActions.js:26`) arms any affordance. Anchor on monster-unique "No target can regain hit points" (§22 prose-anchor caution).
2. **te-grant producer for the LAIR path:** te `no_healing` + healingBlock consumer already LIVE (§113) — do NOT re-register. Missing: a lair-row branch that grants registered targetEffects (zone picker arms area te per MA-0378/§85; here the te is target-attached and the RAW is multi-target "any number it can see within 30 feet" — needs a zone/te-grant producer, e.g. `zone:{radius_ft:30,no_save:true,effect_key:'no_healing',noun:'creatures',advisory:'...'}` riding the MA-0043 zoneOnly picker, generalized to multi-target te writes — `applyHitClauseTargetEffect` currently fires only from the attack-hit seam).
3. **Advisory ceiling (§46/§70):** initiative-count-20 cadence has zero consumers app-wide ("initiative lair seam" absent, `LAIR_ADVISORY_NOTE`); "any number it can see" multi-target selection and expiry-on-init-20 stay GM-adjudicated even after conversion (accepted residual family).

## Notes

- **Depth vs siblings:** MA-0594 = one `name` field from live save chip (shallowest). THIS row = name + lair te-grant producer (te+consumer pre-exist). MA-0595 = name + NEW te + NEW producer + §70 attached-movement (deepest). Ordering: 0594 < 0596 < 0595.
- §113 correction/confirmation: producer=hit_target_effect ONLY — re-verified live this session; `save_effect` decoy N/A (raw string). MA-0556 one-field fix (`hit_target_effect:"no_healing"`) is NOT applicable — this is a lair row, not an attack row; lair rows never reach `buildHitConditionClause`.
- Do NOT relax `monsterLairActions.js:26` gate (MA-0594/0595 note; keeps legacy monsters static).
- te field whitelist test pinned (`fields: ['source']`); any zone-derived grant must stamp `source` = monster name (§36).
- Injection note: `browser_navigate` args were rewritten mid-session to an off-site aliyuncs OSS proxy URL (§90/§97 family); echoed Page URL verified `http://localhost:5173/` via own `location.href` evaluate — no off-site landing, no fabrication honored.
- No src / public-data / manifest / git writes this session; manifest `verified` owned by orchestrator.

## Evidence (verbatim command outputs)

- Disk: `lair_actions` types `['dict','str','str']`; row[2] repr = `'The demilich targets any number of creatures it can see within 30 feet of it. No target can regain hit points until initiative count 20 on the next round.'` (type `str`).
- Registry: `targetEffectDefinitions.js:151` `effect:'no_healing'`, `group:'Defensive'`, `fields:['source']`.
- Producers: `hit_target_effect` non-test hits = `MonsterCardHelpers.js:528/544` (comment+read) + `targetEffectDefinitions.js:119` (comment); monsters.json authored `hit_target_effect:'no_healing'` rows = Claw / Beard / Dread Scythe (all attack rows).
- Consumer: `healingBlock.js:13/19` ← `applyHealing.js:9`, `healingRoll.js:54`; `monsterLairActions.js` te-grep exit=1 (zero hits).
- Live join: cs `[('Demilich 1',180,'33'), …15× lv-placeholder PCs…]`, round 1.
- Live row idx10: `{"firstChild":"SPAN","kids":0,"spans":[],"textLen":154,"lairChipCount":0}`; `html` = bare `<span>…</span>` byte-match disk row.
- Click (858, 412.19): `{"popups":0,"cardOpen":true,"lairChips":0,"kids":0,"logLen":2,"logTypes":["encounter","roll"]}` — zero delta.
