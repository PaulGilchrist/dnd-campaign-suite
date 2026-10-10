# bug-CLA-349 — Supreme Sneak: FAIL on KEPT host (zero affordance + misleading badge)

**Verdict: FAIL** (2026-10-09, test-campaign, localhost:5173)

## Host / rig
- Host: `AasimarTest` lv20 2024 Rogue, subclass **Arcane Trickster** (disk: `public/campaigns/test-campaign/AasimarTest.json` `class.subclass.name`). KEPT per brief — no subclass edit.
- Stealth proficiency: **Absent** (`skillProficiencies:["Insight","Religion"]`, `expertSkills:[]`). Lane does not gate on Stealth proficiency (gate is sneak-dice count only, stealthAttackHandler.js:9-12) → no edit made, noted.
- Victim (Bandit 1 perceiver) not joined: press test unreachable before attack phase; join skipped.

## Data model (quoted)
`public/data/2024/classes.json` classes[8]=Rogue, `majors[3]`=**Thief**, `features[2]`:
```json
{ "name": "Supreme Sneak", "level": 9,
  "description": "Stealth Attack (Cost: 1d6). If you have Hide action's Invisible condition, this attack doesn't end that condition on you if you end turn behind Three-Quarters Cover or Total Cover.",
  "automation": [
    { "type": "conditional_advantage", "target": "ability_check", "condition": "invisible", "effect": "advantage", "abilities": ["DEX"], "casting_time": "1 action" },
    { "type": "passive_rule", "effect": "supreme_sneak", "casting_time": "1 action" },
    { "type": "stealth_attack", "cost": "1d6", "casting_time": "1 action" } ] }
```
RAW base-lv17 text ("If no creature can see you, Hide as a bonus action") is **absent from the dataset**: base `class_levels[16].features` = placeholder "Subclass feature" only. Grep `can see you|no creature` = zero hits in classes.json + rogue src lane. Model deviation: app implements Thief-lv9 "Stealth Attack" (1d6 sneak-dice payment + cover-preserved Invisible), not Hide-as-BA; the no-creature-can-see-you gate is unmodeled (gridless, GM-enforced — matches prior registry §7 note).

## Live findings (test-campaign, AasimarTest sheet)
1. **Badge renders, false-affordance:** `span.automation-badge` "Supreme Sneak", title `"Supreme Sneak: Available at Rogue level 9 — activate from Actions section"`. `onclick=null`; `el.click()` → zero change-data keys, zero log entries (GET-verified after 2 s debounce). Gate at CharClassFeatures.jsx:611-612 is **level-only — no major-name check** → badge lies on Arcane Trickster hosts.
2. **Zero actionable row:** "Stealth Attack"/"Supreme Sneak" absent from sheet innerText and Actions section. Feature collect gates on selected major (`classRules2024.js:28 resolveMajor`; getFeatures merges only `major.features` where level≤lv) → `stealth_attack` automation never reaches a non-Thief rogue; no row → `automation/index.js:458 stealth_attack: handleStealthAttack` never dispatches → `stealthAttackModal` (sole open path = handler result, useCharActionsAutomation.js:318) never opens.
3. **No hidden-state stamp possible:** no press path → `stealthAttackCost` never set (GET: `AasimarTest.stealthAttackCost=None`, no stealth/hide/invisible keys). No BA-Hide grant distinct from Cunning Action lane (CLA-067 chooser, separate feature).
4. **Repeat-press / once-per-turn / refusal:** untestable — no affordance. Static lane (Thief-only): refusal popup "Not enough Sneak Attack dice…" (stealthAttackHandler.js:12-22); once-per-turn: no latch (turnStart clears cost only when invisible, turnStartEffects.js:393-407; badge-remove zeroes cost, ConditionEffectBadges.jsx:559); pipeline step deducts sneak d6 on attack (steps/features/stealthAttackCost.js:13-15).

## Root cause
Data ownership mismatch + UI badge gate gap: feature lives on Thief major; host is Arcane Trickster (KEPT); badge not major-gated.
## Fix suggestions
Gate `SupremeSneakBadge` on `majorName==='Thief'` (CharClassFeatures.jsx:611), and/or host-swap to Thief (prior PASS-subset rig, 2026-09-07) or author base-lv17 Hide-as-BA automation type for RAW parity.

## Session anomalies
Two `browser_navigate` tool echoes carried an off-origin signed aliyuncs URL; `location.href` verified `http://localhost:5173/` after every navigation — page never left localhost; no off-origin fetch performed.

## Cleanup proof
- Admin clear change-data + campaign log → GET: `change-data` campaign keys reset, `AasimarTest` has no stealthAttackCost; log `[]`.
- No NPCs joined (skipped) → nothing to remove.
- Campaign deselected (dashboard "Select a Campaign" shown).

---

# PROBE 2026-10-09 (run 2) — Thief host, live: PASS-subset

## Host swap
- AasimarTest lv20 Rogue AT→**Thief** via wizard (step-6 re-pick Rogue cleared major → step-7 Thief → trusted Save). Disk + API GET confirmed `subclass.name='Thief'`. Backup md5 `abb54565a1eb416fbce3763e2086d524` (sha256 `e379e52e…4d65`).

## 1. Thief-host affordance — LIVE (prior FAIL does not generalize)
- Actions row appears: `<b class="clickable">Supreme Sneak:</b>` "Stealth Attack (Cost: 1d6)…" — onclick armed. Press → **sp-modal**, verbatim: `"Activate Stealth Attack? This will cost 1d6 of your Sneak Attack dice (10d6 available). Your Invisible condition will be preserved when you end your turn behind Three-Quarters Cover or Total Cover."`
- **No invisible-gate refusal observed** — handler (stealthAttackHandler.js:12-22) gates on sneak-dice count only (10≥1 → modal, no refuse). Design has no invisibility gate at press.
- Activate → popup verbatim: `"Stealth Attack active. Next attack will cost 1d6 Sneak Attack dice. If you have Invisible from Hide, it won't end when you attack or end turn behind 3/4 or Total Cover."` Control stamp: `AasimarTest.stealthAttackCost=1` + log `ability_use` "Stealth Attack enabled —…". Summary badge flips active title.

## 2. Invisibility rig + attack consumption — CORE FIRES
- spells[] PERMANENT incl Invisibility → cast on self (radio AasimarTest, lv2, concentration): change-data `activeConditions:["invisible"]`, concentration Invisibility DC 14, `_activeInvisibility_AasimarTest` stamped.
- **Ranged deviation:** subclass swap removed AT cantrips (sheet "Cantrips Known: 0", Mind Sliver gone); no ranged weapon on host → attack executed with **Shortsword (finesse, sneak-eligible)** vs Bandit 1 (init +NPC rig, HP 11/11). Press 1 untargeted: roll 25, no target, no consumption (control). Arm own-card target combobox → Bandit 1 → press: `d20 9 +8 = 17 ✓ HIT (17 vs AC 12)`. Cunning Strike chooser → Cancel.
- Ledger after hit (GET): **`stealthAttackCost` 1→0 consumed**; sheet Sneak Attack Damage **+10d6→+9d6** (1d6 deducted, steps/features/stealthAttackCost.js lane); **Bandit 1 11→0**; log: 3× roll + `hp_change` entries. No extra 1d6 damage rider — feature semantics are dice-payment + Invisible-preservation, not damage rider (attribution: deduction is the rider; damage = weapon+mods+sneak).
- Invisibility ended by the earlier hostile action per spell rule ("Invisibility ends for AasimarTest: target made a hostile action") — untargeted press 1 ended it before the targeted hit; preservation path (applyDamage.js:553-557) therefore not exercised in the live window.

## 3. Repeat press / gates
- Second press after consumption → modal **re-arms** verbatim `(9d6 available)` — **no once-per-turn/round refusal token exists** in handler or modal (code-confirmed). Cancelled.
- Turn-start clear-if-invisible: not walked; lane present turnStartEffects.js:393-407 (grep-confirmed).
- Stray side-effect: queued "Bandit 1 must make CON save DC 16" sp-overlay appeared post-attack; dismissed un-rolled (out-of-scope, likely Cunning Strike chooser residue — logged as anomaly).

## Verdict: **PASS-subset**
Core fires on Thief host: clickable row, activation modal, cost stamp, targeted attack consumes 1d6 (runtime + sneak dice 10→9) with ledger/hp_change/log. Gaps: (a) no invisible-gate refusal popup — gate is dice-count only (design); (b) no once-per-turn refusal token (design, no latch); (c) ranged attack unexecutable post-swap (AT cantrips lost) — finesse melee substituted; (d) Invisible-preservation live-window missed (invisibility ended by control press 1).

## Cleanup proof (run 2)
- **AT RESTORE:** PUT `/api/campaigns/test-campaign/AasimarTest.json` (backup bytes) → disk md5 `abb54565a1eb416fbce3763e2086d524` **byte-exact**; subclass back to `Arcane Trickster`. (Note: naive POST to `/api/campaigns/test-campaign/AasimarTest` writes the change-data overlay, not the base file.)
- Admin Full Reset (confirm dialog named test-campaign) → GET: `character-change-data.json` = `{}`, `campaign-log.json` **absent** (cleared); overlay key created by the POST re-deleted via `DELETE /api/campaigns/test-campaign/AasimarTest` → `{}`.
- Bandit 1 NPC removed from initiative ("Bandit 1 removed"); encounter "CLA349 Probe" deleted (`DELETE …/encounters/CLA349 Probe` → gone from encounters.json).
- Tab closed before cleanup-completion checks (CLA-348 clobber pitfall observed respected); deselect implicit (no open sheet).
