# Bug mon-MA-0117 — Adult Green Dragon · "Unnamed lair actions 1" (grasping roots/vines) · inert nameless dict + intra-row save-metadata drift (MA-0096/MA-0107 fingerprint)

## Row
- MA-0117 · adult-green-dragon · lair_actions[0] · type other · manifest claims `saveDc:15`, `saveType:"Strength"`, save effect "restrained by roots and vines".
- Manifest label "Unnamed lair actions 1" = generator placeholder: source dict has NO `name` key (MV-24 family).

## Verdict
**FAIL** — inert row (nameless-dict fingerprint). No affordance, no DC 15 STR roll, no Restrained, no difficult-terrain state, no logs. Plus intra-row data drift making even a lifted gate wrong-mechanic (see below).

## Static read (public/data/monsters.json, Adult Green Dragon lair_actions[0])
- Nameless dict. `description` CONFIRMS the row's core prose: "Grasping roots and vines erupt in a 20-foot radius… That area becomes difficult terrain, and each creature there must succeed on a DC 15 Strength saving throw or be restrained by the roots and vines. A creature can be freed if it or another creature takes an action to make a DC 15 Strength check and succeeds. The roots and vines wilt away when the dragon uses this lair action again or when the dragon dies."
- **No `name`/affordance key** → row is raw for the clickable pipeline.
- **Intra-row drift (cf. MA-0107):** structured metadata contradicts its own description — `save_dc:15` ✓ but `save_type:"Wisdom"` (not Strength), `save_effect:"The target is charmed by the dragon until initiative count 20 on the next round."` (canonically the sibling lair_actions[2] fog effect), and `damage_dice_primary:"4d8"/Piercing` (canonically sibling lair_actions[1] thorn-wall). True save legs of THIS row (DC 15 STR → restrained) exist only as prose; the dict's machine-readable legs point at the WRONG save type/effect/damage.

## Defect
- `monsterLairActions.js:26` `isLairRowClickable`: `!row.name → false` — name-gate kills the dict despite carrying `save_dc` (identical gate to MA-0096/MA-0107).
- `MonsterCardBody.jsx:340` `MonsterLairAction` static branch: nameless dict renders `DIV.mc-action` > `<strong>.</strong>` + sanitized description span. Live DOM confirmed: cursor auto, zero interactive children, no `.mc-dice-link-lair`, no role=button, no onClick → `handleLairRow`/`resolveLairRow` never reached.
- Even if named: affordance 'save' would arm DC 15 **WISDOM** + charm + 4d8 piercing per the drifted trio — wrong vs the row's own DC 15 STR/restrained prose; and `extractConditionsFromSaveEffect` on "charmed until initiative count 20" would apply Charmed with no init-20 expiry (no initiative lair seam anywhere — only `LAIR_ADVISORY_NOTE` monsterLairActions.js:23).
- No grasping-roots te producer: `targetEffectDefinitions.js` lair entries are ONLY `lair_darkness`/`lair_insect_cloud`/`lair_sand_cloud` (:776/785/794) — no roots/vines/restrained-by-lair te; app-wide difficult-terrain hits are the Speedy Dash-ignore buff only (not a zone producer). Restrained has generic consumers (spells/grappling) but zero lair-path producer. Zone "area becomes difficult terrain" + "wilt when used again/dies" expiry: no §7 zone seam.
- `npcStatBlockUtils.js` nulls `lair_actions` for non-lair flows.

## Grep (consumers)
- `grasping roots|roots and vines|difficult.?terrain` (src+server, non-test): zero producers for this effect — only Ice Walk/Stride of the Elements prose, Speedy Dash-ignore badge/runtime flag (ConditionEffectBadges.jsx:258-259/479, CreatureCard.jsx, initiative.jsx), and MonsterCardBody/Modal prop plumbing.
- `lair` te registry: lair_darkness/lair_insect_cloud/lair_sand_cloud only. No lair roots/vines entry.

## E2E evidence (2026-09-14, localhost:5173, test-campaign)
- Campaign empty pre-state (change-data `{"value":null}`) → re-Join per registry. EB search "Adult Green Dragon" → tick → Join Encounter → cs[0] `Adult Green Dragon 1` npc HP 207 init 18.
- Armed via dragon card target-select → cs[0].`targetName:"AasimarTest"` verified by API. Baseline cd sha `a7c6e03a`; log sha `434f3062` (2 entries).
- Avatar click → `.mc-overlay` "Lair Actions" section: row = `DIV.mc-action`, cursor auto, `firstChildTag STRONG` text `"."` (nameless fallback), hasDiceLink false, role null, onclick false, interactiveKids 0.
- Trigger attempts ×2 rounds: synthetic pointerdown/up+mousedown/up+click+dblclick on row+desc-span + `row.click()`×3, then trusted Playwright click on the row: 0 `.sp-overlay`/`.popup`/`.mc-prerequisite-refusal`, 0 "Saving Throw Required" prompts.
- Zero-delta: post cd keys add ONLY `combat-ui-viewingMonster(+CreatureName)` display flags; no `saveResult-*` keys, AasimarTest targetEffects/activeConditions null; log sha unchanged `434f3062` (2 entries); regex `lair|root|vine|restrain|save|terrain` across log = 0 hits.
- **Control-probe (seam works):** same campaign same session — EB join Aboleth, arm its card target AasimarTest, open card → `.mc-dice-link-lair` ×3 role=button incl. "DC 14 Strength" (named Grasping Tide dict); click → live popup "Saving Throw Required — AasimarTest must make a STRENGTH saving throw. DC 14". Pipeline healthy; green dragon row is dead by the name-gate + raw-dict shape, not a broken seam.

## Fix suggestion
Data fix: name + de-drift the dict — `lair_actions[0]` → `{name:"Grasping Roots", save_dc:15, save_type:"Strength", save_effect:"The target is restrained by the roots and vines."}` (move the Wisdom/charm trio to [2] and the 4d8 piercing trio to [1] where they canonically live). The existing MA-0024 save seam then arms DC 15 STR + Restrained on fail via extractConditionsFromSaveEffect. Residuals to flag: difficult-terrain zone + "wilt when used again/dies" keyed replacement + DC 15 STR action to break free have no consumers (§7 zone seam) — GM-adjudicated or new te producer needed; no initiative-20 cadence (advisory per MA-0024 design).

## Cleanup
- test-campaign only: control save prompt Dismissed, card closed, POST /api/campaigns/test-campaign/admin/clear-change-data + /admin/clear-log — both 200, verified empty (change-data 2 B, log 2 B). Manifest `verified` untouched.

## Tool-echo anomaly note
Navigate/type/click parameter echoes again carried mismatched junk (aliyuncs-style URLs) while executed code and landing URLs were always the intended localhost:5173 flows — verified by landing-URL value + UI-state corroboration at every step (campaign select → EB joins → arming → overlay → clicks → control popup → cleanup). Treated as harness echo corruption per AGENTS/playbook guidance; no off-localhost action occurred.
