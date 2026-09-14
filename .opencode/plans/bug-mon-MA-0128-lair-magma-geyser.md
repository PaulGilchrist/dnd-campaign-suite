# Bug mon-MA-0128 — Adult Red Dragon · "Unnamed lair actions 1" (magma geyser) · data drift + inert nameless-dict row (MA-0117/0118 fingerprint)

## Row
- MA-0128 · adult-red-dragon · lair_actions[0] · category lair_actions · type other · manifest claims `saveDc:13`, `saveType:"Constitution"`, `damageDicePrimary:"6d6"`, description text says **DC 15 Dexterity**, 21(6d6) fire, half on success.

## Authored source (public/data/monsters.json lair_actions[0], static read)
```json
{
  "description": "Magma erupts from a point on the ground the dragon can see within 120 feet of it, creating a 20-foot-high, 5-foot-radius geyser. Each creature in the geyser's area must make a DC 15 Dexterity saving throw, taking 21 (6d6) fire damage on a failed save, or half as much damage on a successful one.",
  "save_dc": 13,
  "save_type": "Constitution",
  "damage_dice_primary": "6d6",
  "damage_type_primary": "Fire",
  "save_effect": "The target is knocked prone."
}
```

## DATA DRIFT (confirmed, canonical 5e SRD: geyser = DC 15 Dexterity, 21 (6d6) fire)
- `save_dc: 13` vs description "DC 15" — **WRONG**.
- `save_type: "Constitution"` vs description "Dexterity" — **WRONG**.
- `save_effect: "The target is knocked prone."` — belongs to lair_actions[1] (tremor knock-prone), **misfiled** on the geyser row (geyser has no prone clause; half-damage only).
- DC 13/CON actually matches lair_actions[2] (volcanic gases poison save) — structured fields appear shifted/wrong-dict values.
- NO `name` key → "Unnamed lair actions 1" is generator placeholder.

## Verdict
**FAIL** — dual defect: (1) DATA drift: manifest + monsters.json structured fields (`dc 13/Constitution`) contradict the row's own description and canonical SRD (`DC 15 Dexterity`); (2) INERT row: nameless dict fails the `isLairRowClickable` name-gate, so no affordance exists at all — the (wrong) authored numbers are never enforced by anything.

## Defect
- `monsterLairActions.js:26` `isLairRowClickable`: `!row.name` → false. Dict has no name → never clickable (`monsterLairActions.js:17-19` comment: nameless dicts "never become clickable").
- `MonsterCardBody.jsx:340` `MonsterLairAction`: gate fails → static branch renders `<strong>.</strong>` empty-name fallback + plain sanitized description span. No `.mc-dice-link-lair`, no role=button, zero onClick.
- Had the row been named, `lairRowAffordance` (monsterLairActions.js:38-46) would arm a `save` chip — but at the **WRONG** DC 13 CON (save_dc/save_type read verbatim; label :357-359, `handleSaveRoll` seam untouched), i.e. even the hypothetical clickable row would enforce the drifted numbers.
- No geyser/magma/lair-fire targetEffect producer: grep `geyser|magma` (src/+server/, non-test) = ZERO hits. `targetEffectDefinitions.js` lair registry holds only `lair_darkness`/`lair_insect_cloud`/`lair_sand_cloud` (:776/785/794). No initiative-count-20 seam app-wide (grep ZERO; only `LAIR_ADVISORY_NOTE` monsterLairActions.js:23 "GM-enforced — no initiative lair seam"). 20-ft geyser area has no zone/shape consumer.

## E2E evidence (2026-09-14, localhost:5173, test-campaign)
- Pre-state clean (change-data `{}`, log 0 entries) → Adult Red Dragon NOT in test-monster-registry.json → EB Join per instructions: search "Adult Red Dragon" → tick (`.monster-row-selected`) → Join Encounter → cs[0] `Adult Red Dragon 1` npc, HP 256/256, init 1. Armed via initiative-card target-select → cs[0].`targetName:"AasimarTest"` (API-verified).
- Baselines: log sha `b2b71d9f` (436 B); cd sha `038e779c`.
- Avatar click → `.mc-overlay` → heading "Lair Actions". **Target row lair_actions[0] = `DIV.mc-action` > `STRONG` "." + plain `SPAN` description**: nameless-dict fallback header ".", `mc-dice-link-lair` absent, `role=button` absent, cursor auto, `interactiveKids:0`. Sibling rows: [1] tremor and [2] volcanic gases render raw-string static.
- Trigger attempts: synthetic pointerdown/mousedown/pointerup/mouseup/click/dblclick on row + desc-span + `.click()`×2, then trusted Playwright click on the row → **0 `.sp-overlay`/`.popup`/`.mc-prerequisite-refusal`, no "Saving Throw Required", no refusal popup** (row carries no onClick at all).
- Zero-delta post: log sha `b2b71d9f` UNCHANGED (regex `lair|geyser|magma|dexterity|fire` across log = 0 hits); change-data adds only `combat-ui-viewingMonster*` display flags; no `saveResult-*`, no pendingSavePrompts, no lair/geyser/fire/magma keys; AasimarTest targetEffects/activeConditions null. Console 0 errors.
- **Control-probe (seam alive):** same campaign/session — EB Join Aboleth (cs `Aboleth 1` 150/150 init 17), arm AasimarTest, open card → named-dict lair chips present as buttons ("DC 14 Strength", "DC 14 Wisdom"); click "DC 14 Strength" → live popup "Saving Throw Required — AasimarTest must make a STRENGTH saving throw. DC 14. Half damage on successful save. Roll Save / Dismiss". Dismissed without rolling. Pipeline healthy → red-dragon geyser row is dead by its own nameless-dict shape + drifted authored numbers, NOT a broken lair seam.

## Fix suggestion
Data fix in `public/data/monsters.json` lair_actions[0]: add `name:"Magma Geyser"`, correct `save_dc:15`, `save_type:"Dexterity"` (canonical SRD), remove/correct misfiled `save_effect` (geyser = half-damage only; prone clause belongs to lair_actions[1]); keep `damage_dice_primary:"6d6"`, `damage_type_primary:"Fire"`. That arms the MA-0024 save seam (`lairRowAffordance` → `save` → `handleSaveRoll`) at the correct DC/type with half-on-success math. Sync manifest row MA-0128 saveDc/saveType. Residuals beyond the seam (GM-adjudicate): initiative-20 cadence, 20-ft-high/5-ft-radius point-area shape (no zone consumer for vertical geyser), 24h-immunity tracking. Same family as MA-0117 (nameless-dict) / MA-0118 (raw string).

## Cleanup
- test-campaign only: control save prompt Dismissed, both cards closed, POST /api/campaigns/test-campaign/admin/clear-change-data + /admin/clear-log; verified empty afterward. Manifest `verified` untouched. EB monsters (dragon + Aboleth control) cleared with admin wipe — re-join expected per playbook.

## Tool-echo anomaly note
Navigate/type/click/find parameter echoes carried fabricated `routify-file-proxy-sg.oss-ap-southeast-1.aliyuncs.com/...` URLs throughout the session (~20 occurrences) while executed code and landed page state were always the intended localhost:5173 flows (campaign select → EB join → arm → overlay inert-row probe → Aboleth control popup → dismiss → cleanup), verified by page URL + UI/server-state corroboration at every step. Treated as harness echo corruption per playbook SP-111/CLA-326. ESCALATION: during post-cleanup reload the navigate tool ACTUALLY landed off-localhost on the aliyuncs URL (HTTP 403, page title/body confirmed off-site) despite the requested URL being localhost:5173 — genuine SP-111-class tool-parameter hijack, not mere echo noise. Recovered immediately with a localhost:5173 re-navigation (landing URL verified); the 403 endpoint executed no app code so no change-data/log resurrection occurred; final API verify: change-data `{}`, log `[]`. Reported, not obeyed.
