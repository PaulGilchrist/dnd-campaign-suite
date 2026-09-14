# Bug MA-0114 — Adult Green Dragon "Mind Invasion": inert legendary row; underlying Mind Spike cast rolls BASE 3d8 not authored lv3 4d8; no legendary economy

**Verdict: FAIL** (action unreachable/inert — 0 affordances, forced click zero popup/log; reachable Spellcasting seam rolls base 3d8 not lv3 4d8; DC/save-type correct; no uses gate)

## Row
- MA-0114 · Adult Green Dragon (`adult-green-dragon`) · `legendary_actions[1]` · category: legendary_actions · actionType: other.
- monsters.json (:2285, read 2026-09-14): `{name:"Mind Invasion", description:"The dragon uses Spellcasting to cast <em>Mind Spike</em> (level 3 version)."}` — **prose-only**: no `automation`, no `delegates_to`, no `save_dc`, no `spell`, no `uses`. Same "uses Spellcasting to cast X" shape as Copper "Mind Jolt" (MA-0094).
- Expected per text + spells.json (Mind Spike lv2 3d8, +1d8/slot): **4d8 Psychic, WIS save, DC 17** (Spellcasting row `save_dc:17`), once as a legendary action gated by the uses economy.

## Static grep (pre-probe)
- `rg -i 'mind.?invasion' src server` → **zero hits**. `rg -il 'mind.?spike' src server` → **zero hits**. No handler/automation/consumer anywhere — inert by construction (MA-0094 fingerprint, playbook §8 "legendary/lair inert fingerprint").

## Live probe (test-campaign, :5173, 2026-09-14)
Baseline clean: log `[]`, change-data keys `[]`. EB Join → cs idx 0 `Adult Green Dragon 1` (npc, init 20). Armed target on dragon card → server-verified `targetName:"DivinationWizard"`. Card opened via `img.avatar-image.click()` → `.mc-overlay` visible.

### FAIL 1 — Mind Invasion row is INERT (cannot be triggered)
- Row DOM: `DIV.mc-action` with `innerHTML = "<strong>Mind Invasion.</strong> <span>The dragon uses Spellcasting to cast <em>Mind Spike</em> (level 3 version).</span>"` — **zero clickable children** (`clickableChildren:[]`): no `.mc-dice-link`, no `.mc-dice-link-spell`, no `.mc-dice-link-legendary`, no `[role=button]`.
- Forced click on row AND its `<strong>`: **zero new log entries** (log stayed at 2 join/initiative baseline), **zero new overlays** (only `.mc-overlay` card remains), no `lastAttack`, no `pendingSavePrompts`, no `spawn`. The action cannot fire.

### FAIL 2 — No legendary economy (MA-0113 fingerprint)
- `.mc-legendary-counter` absent, `.mc-legendary-header-row` absent — header lacks `uses` → `legendaryHeaderAction` null → generic fallback branch, no `legendaryGate`. `monsterLegendaryUses` never created in change-data (pre or post probe).

### FAIL 3 — KEY CLAUSE: reachable cast resolves BASE 3d8, not lv3 4d8
Control-probe via the Spellcasting row's `span.mc-dice-link-spell` "Mind Spike" (engine alive proof; same target armed):
- Prompt verbatim: "DivinationWizard must make a WIS saving throw. DC 17. Half damage on successful save".
- `save_result` log: saveDc **17**, saveType **WIS**, success true, roll 15, total 21.
- `save-damage` log: **`formula:"3d8"`**, rolls `[3,5,1]`, total 9 → half **4**, damageType Psychic → `hp_change` −4 (82→78).
- **3 dice = BASE lv2. Row authors "(level 3 version)" ⇒ expected 4d8.** Upcast clause wrong even at the reachable seam (MA-0112 residual: `spellCastLevelFromSpellcasting` wired only on the spell-ATTACK branch, save branch `spellDamageFormulaAtBaseLevel`).

## PASS subset (correct at the reachable seam)
- Save type **WIS** enforced ✓ · Save DC **17** enforced ✓ · Damage type **Psychic** ✓ · Half-on-success math (`dcSuccess:"half"`, 9→4) ✓ · `save_result` + `save-damage` + `hp_change` logging present ✓ · Spellcasting links render/clickable (control) ✓.

## Root cause / fix shape
1. **Inert row (primary):** legendary row with prose-only "uses Spellcasting to cast X" has no affordance producer (`MonsterAction.jsx` emits links only for rows with authored `attack_bonus`/`save_dc`/dice; no `delegates_to` consumer). Give Mind Invasion a resolvable mechanic — delegate to Spellcasting Mind Spike with cast level (MA-0094 fix shape).
2. **Economy:** author `uses: 3` (+lair note) on header row so counter/gate/latch/regain activate (MA-0113/MA-0021 recipe).
3. **Upcast:** route save-spell branch through `spellCastLevelFromSpellcasting` + `spellDamageFormulaAtLevel` (MonsterCardModal.jsx:639-641, MA-0033/MA-0112 shape) so lv3 → 4d8.

## Cleanup
- Page closed; POST `/api/campaigns/test-campaign/admin/clear-change-data` + `/admin/clear-log` (Host localhost); re-verified change-data `{}` + log `[]`. Only `test-campaign` touched; no manifest `verified` edits.
