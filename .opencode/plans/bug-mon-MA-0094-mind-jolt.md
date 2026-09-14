# Bug MA-0094 — Adult Copper Dragon "Mind Jolt": inert legendary row + underlying Mind Spike casts at BASE 3d8, not the authored level-4 5d8; once-per-turn gate absent

**Verdict: FAIL** (action unreachable/inert; key clause "(level 4 version)" wrong — rolls base 3d8; DC/save/type correct; no once-per-turn gate)

## Row
- MA-0094 · Adult Copper Dragon (`adult-copper-dragon`) · `legendary_actions[2]` · category: legendary_actions · actionType: other.
- monsters.json `adult-copper-dragon.legendary_actions[2]`: `{name:"Mind Jolt", description:"The dragon uses Spellcasting to cast <em>Mind Spike</em> (level 4 version). The dragon can't take this action again until the start of its next turn."}`. **No `delegates_to`, no `save_dc`, no `spell`, no `uses`.**
- spells.json (2024) Mind Spike: level 2, `dc:{dc_type:"WIS", dc_success:"half"}`, `damage.damage_at_slot_level {2:"3d8", 3:"4d8", 4:"5d8", …}`, damage_type Psychic. Base lv2 → **3d8**; lv4 → **5d8**. Row explicitly authors "(level 4 version)" ⇒ expected **5d8 Psychic, WIS save, DC 17**.

## Live probe (test-campaign, :5173, 2026-09-14)
Setup verified: header campaign = test-campaign (`window.location.href` = http://localhost:5173/; the OSS-proxy URL echoed in some navigate tool output is a harness artifact, ignored per playbook SP-111/CLA-326). Log baseline captured. EB Join → cs `Adult Copper Dragon 1` (npc, init 15, hp 184/184, ac 18). Armed target on dragon's initiative card → cs.targetName = `DivinationWizard` (verified via change-data). Dragon card overlay opened (`img.avatar-image.click()` → `.mc-overlay`).

### FAIL 1 — Mind Jolt legendary row is INERT (cannot be triggered)
- Row DOM inspection: `Mind Jolt` row has **zero clickable children** — no `.mc-dice-link`, no `.mc-dice-link-spell`, no `.mc-dice-link-legendary`, no "Expend Legendary" span, no `[role=button]`. `clickableChildInRow:false`.
- No legendary economy on this dragon (MA-0092 fingerprint): `.mc-legendary-counter` / `.mc-legendary-header-row` **absent**; header has no `uses` ⇒ `legendaryHeaderAction` returns null ⇒ `MonsterCardBody.jsx:57` generic fallback branch ⇒ no `legendaryGate`.
- Clicking the row `<strong>` label directly: **zero new log entries** (log 7→7), **zero overlays**, no lastAttack/spell_use. The action cannot fire at all as a legendary action.
- grep `mind.?jolt` app-wide → only `public/data/monsters.json` (:1992, :3628). **Zero handler/automation/consumer references in `src/` or `server/`.** Inert by construction.

### FAIL 2 — KEY CLAUSE: underlying Mind Spike rolls BASE 3d8, NOT lv4 5d8
Only reachable path to the spell Mind Jolt invokes is the Spellcasting row's At-Will "Mind Spike" link (`mc-dice-link-spell`, text "Mind Spike"). Clicking it (target armed) → save prompt → Roll Save → Done:
- Save prompt verbatim: "DivinationWizard must make a WIS saving throw. DC 17. Half damage on successful save".
- `saveResult-DivinationWizard`: `{success:false, roll:10, total:16, saveBonus:6, mode:"normal"}` — SAVE FAILURE 16 < DC 17.
- `save_result` log: saveDc **17**, saveType **WIS**, success false.
- **`save-damage` log: `formula:"3d8"`, rolls `[5,1,2]` (THREE dice), total 8, damageType "Psychic", finalDamage 8, saveSuccess false, dcSuccess "half"** → `hp_change` delta −8.
- **3 dice = 3d8 = BASE level. Row authors "(level 4 version)" ⇒ expected 5d8.** WRONG dice.

Root cause: `MonsterCardModal.jsx:639 executeMonsterSaveSpellCast` → `handleSaveRoll(action, spellDamageFormulaAtBaseLevel(spell), …)` (:641). `spellDamageFormulaAtBaseLevel` (MonsterCardHelpers.js:106) resolves `damage_at_slot_level[base level 2]` = 3d8. The MA-0033 authored-upcast parser `spellCastLevelFromSpellcasting` (MonsterCardHelpers.js:132 — parses "…(level 4 version)" → 4 → 5d8 via `spellDamageFormulaAtLevel`) is wired **ONLY** to the spell-**attack** branch (`resolveSpellAttackPlan` :591). The save-forcing spell branch (this row) never calls it ⇒ upcast level discarded ⇒ 3d8. (Same residual recorded on MA-0091 checkpoint: "Mind Spike rolls base 3d8 not lv4 5d8".)

### FAIL 3 — once-per-turn gate absent
- Mind Jolt's "can't take this action again until the start of its next turn" is unenforceable: no consumer, no latch, no `legendaryGate`, no `*_refused` producer (row inert, FAIL 1).
- The reachable At-Will Spellcasting Mind Spike refires freely same-turn (no `uses` limit authored on the at-will spell) — correct for the at-will row, but confirms no once-per-turn clamp exists for the Mind Jolt clause.

## Re-run confirmation (2026-09-14, second live run after Admin clear)
Fresh EB Join (`Adult Copper Dragon 1`, init 11, hp 184) → armed `DivinationWizard` → card open:
- Mind Jolt row `joltLinks:[]` (zero clickable children), `.mc-legendary-counter` absent — **inert again**.
- Spellcasting "Mind Spike" cast → `saveResult-DivinationWizard` `{success:false, roll:1, total:7, saveBonus:6}` (nat 1, WIS DC 17 fail) → `save-damage` **`formula:"3d8"`, rolls `[1,3,3]` (3 dice), finalDamage 7, damageType Psychic** → `hp_change −7`. Base 3d8 again, NOT lv4 5d8. Reproduces FAIL 2 exactly.

## PASS subset (math/type/DC that ARE correct)
- Save type **WIS** enforced (from `spell.dc.dc_type`). ✓
- Save DC **17** enforced (from Spellcasting row `save_dc`). ✓
- Damage type **Psychic** correct in save-damage log + popup. ✓
- Half-on-success math present (`dcSuccess:"half"`). ✓
- Logging present at the reachable seam: `save_result` + `save-damage` + `hp_change`. ✓

## Fix shape
1. **Upcast on save-spell casts (data+code):** route the save branch through the level parser too — in `executeMonsterSaveSpellCast` (MonsterCardModal.jsx:639) compute `castLevel = spellCastLevelFromSpellcasting(action.description, spellName, spell)` and use `spellDamageFormulaAtLevel(spell, castLevel)` instead of `spellDamageFormulaAtBaseLevel(spell)` (mirror :591). This lifts the Spellcasting at-will Mind Spike AND any future lv-version save spell to 5d8. MA-0033 precedent (attack branch already does this).
2. **Delegated legendary row:** give Mind Jolt a resolvable mechanic — `delegates_to:"Spellcasting"` + a spell cast, or the MA-0022 delegate seam; and author `uses:3` on the header (MA-0092 fix) so `legendaryGate` + round/turn latch + once-per-turn clamp activate. Without a consumer there is nothing to click and nothing to gate.

## Cleanup
- Only `test-campaign` touched. Closed page (quiet state, no snapshot resurrection), then POST `/api/campaigns/test-campaign/admin/clear-change-data` + `/api/campaigns/test-campaign/admin/clear-log` (Host localhost); re-verified change-data `{}` + log `[]` via GET. No manifest `verified` field edits.
