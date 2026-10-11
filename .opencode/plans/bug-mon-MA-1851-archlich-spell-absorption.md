# BUG MA-1851 — Archlich · Spell Absorption (FAIL(b) inert)

**Row:** MA-1851 · Archlich · `reactions[0]` · "Spell Absorption" · category `reactions` · actionType `other`
**RAW:** Reaction when targeted by a spell requiring concentration → DC 20 Intelligence (Arcana) check → on success the spell fails and the archlich regains 10 HP.
**Date:** 2026-10-11 · test-campaign · :80 dist build

## Verdict: FAIL(b) — mechanism entirely inert (no affordance, no consumer, prose-only data)

## Axis 1 — DATA (prose-only, MA-1846/1847 drift twin)
`public/data/monsters.json` → `Archlich.reactions[0]` keys = **`name`, `trigger`, `description` only**:
- **NO `automation{type,trigger,effect}`** → never enters the gated-reaction machine (§60).
- **NO `save_dc`** — DC 20 exists ONLY inside the description prose (manifest correctly notes no saveDc field). §260 DC0 gate: no numeric save_dc ⇒ generic save-shell chip cannot render.
- **NO ability/skill metadata** (Intelligence/Arcana), **NO structured HP-regain** (`hpRegain:10` or equivalent) — regain is prose-only.

## Axis 2 — ENGINE (grep-zero consumers)
- `grep -rni "spell.absorption|spellAbsorption" src/ server/` → **ZERO matches** (no registry entry, no resolver, no dispatcher arm, no te).
- `GATED_MONSTER_REACTIONS` (MonsterCardHelpers.js:1205): feather_fall / counterspell / hellish_rebuke / parry / shield / guardian_protection (+jinx_negate, spell_reflection, burst_of_ingenuity lineage) — **no absorption-class effect**; sole `trigger:"targeted_by_spell"` entry is `shield` (MA-1170), which keys off spell-origin lastAttack pending-window, not concentration-targeting.
- §406 re-confirmed live-compatible: `reactionQueue|fireReaction|triggerReaction` grep-zero — no generic spell-target reaction queue exists app-wide. Reaction-less monsters stamp only the generic `pendingExpirations` scaffold (MA-0853).

## Axis 3 — LIVE probe (native EB join, real concentration cast)
Rig: EB search "Archlich" → native checkbox click → Join Encounter (board: Archlich 1 init 10 + 12 PCs). DivinationWizard holds **Hold Monster** (lv5, concentration, single-target) — **no spellbook edit needed** (nothing to restore). Armed wizard initiative-card `[data-testid="target-select"]` → "Archlich 1" via trusted selectOption (picker unfiltered, undead listed — §271). Sheet → Hold Monster → sp-modal checkbox picker → check "Archlich 1" → "Cast Hold Monster (1)" → cast resolved.

Evidence chain (log 2→7):
1. `spell` + `ability_use` "DivinationWizard casts Hold Monster on Archlich 1" (slot paid, concentration armed — wizard cd `pendingExpirations` anchors paralyzed on Archlich 1).
2. **No Spell Absorption prompt/popup at any stage** — target event, cast-confirm, save-fail face: zero reaction modals; `grep`-equivalent DOM audit of opened Archlich card: `[class*="reaction"]` hits = **0** app view + **0** in `.mc-overlay`.
3. WIS save adjudicated normally: 11+4=15 vs DC 19 FAIL → `save_result` ×2 + `condition applied` **Paralyzed** ("Archlich 1 is Paralyzed by Hold Monster") — spell resolved un-absorbed.
4. **Zero `hp_change` / zero heal / zero INT(Arcana) ability check** anywhere in log — the DC 20 check, spell-fail face, and +10 HP regain are all unprovable: no producer exists.
5. **Affordance audit (controls positive):** same Archlich card renders `mc-dice-link "+19"` (Disintegrate Ray, Grave Touch), `mc-dice-link-save-clickable "DC 22 Wisdom"` (Dread Word), `mc-dice-link-legendary "Expend Legendary"` — machinery live on the card; **Spell Absorption row = `rowInteractives:0`**, HTML is bare `<div class="mc-action"><strong>Spell Absorption.</strong><span>…prose…</span></div>` — §60/§111 zero-affordance fingerprint, identical shape to MA-0681/MA-1850 inert rows.

## NEW PITFALLS
- Concentration-utility saves (Hold Monster sp-modal) complete via **two stacked `sp-roll-btn`** prompts (cast-prompt → save-prompt → Done) with no result-panel; clicking a `disabled` `.sp-roll-btn` with Playwright `.click()` time-outs but the prior native `el.click()` already registered — poll log before retry (§147 inverted: disabled = accepted).
- Initiative NPC (monster) card renders name as `monster-autocomplete-input`, NOT `.creature-name` text — name-locator cards miss monsters; anchor `.creature-card.npc .avatar-image` (alt="Archlich 1") to open the stat modal.
- Spell-slot ledger (`spell_slots_level_N`) lives in change-data ⇒ Admin "Clear Change Data" is a full caster-slot restore; dialog chain is two sequential confirms (cd, then log) — `page.once('dialog')` handlers fire out of order, use `browser_handle_dialog` per prompt.
- PC-target global `[data-testid="target-select"]` (first in DOM) lists PCs only — monster targeting requires the per-initiative-card select (13th option lists Archlich 1); `nth()` audit by header before selectOption.

## FIX (recommended)
- **Option A (data, minimal honest):** restate row as advisory (§253 byte-shape): `advisory:"spell_absorption"` + `advisory_message` — GM-enforced popup + advisory log, zero rolls; matches §70 adjudication class for check-based reaction mechanics.
- **Option B (engine):** new gated effect `spell_absorption` in `GATED_MONSTER_REACTIONS` — `automation:{type:"reaction",trigger:"targeted_by_concentration_spell",effect:"spell_absorption"}` + At Will/uses:999 sentinel (§224 shape); gate = spell-origin lastAttack / pending cast where target is this monster AND concentration flag stamped on cast; press rolls INT (Arcana) vs DC 20 (`save_dc:20`+`ability:"Intelligence"` authored structurally), success → negate pending spell (jinx_negate MA-1463 pending-conversion lineage is the nearest pattern) + 10 HP heal via existing hp_change lane. Concentration-flag-on-targeting event is a new stamp — concentration currently lives caster-side only (§270), so B needs a producer for the trigger signal.
- Either fix MUST author `save_dc:20`, `save_type/ability: Intelligence`, skill Arcana, `hp_regain:10` structurally (prose-only repeat prohibited).

## Cleanup
Admin-cleared change-data (`cd:{}` — resets wizard lv5 slot) + log (`log:[]`); no spellbook edit made; quiet-recheck 2026-10-11; server 200.
