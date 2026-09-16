# Bug MA-0229 — Ancient Green Dragon "Noxious Miasma" (legendary aoe-save)

**VERDICT: FAIL** (2 defects; core save/damage/fail-effect math EXACT)

## Expected (row + monsters.json)
AoE save, DC 21 Constitution, 30-ft-radius Sphere. FAILURE: full 17 (5d6) Poison + target takes −2 AC penalty until end of its next turn. SUCCESS: ZERO damage (no half clause authored). "Failure or Success: The dragon can't take this action again until the start of its next turn" (once-per-turn legendary gate).

## Live evidence (test-campaign, 2026-09-16, EB "Ancient Green Dragon 1" hp402 ac21, picker scoped to 2 targets)
- Cast 1: AberrantSorcerer SUCCESS (nat19+4=23); ElderPaladin FAILURE (nat5+10=15). DC 21 Constitution enforced on prompt+logs ✓.
- FAIL leg EXACT: EP 5d6 rolls [6,1,1,2,3]=20, finalDamage 20, hp −20; te `ac_penalty` {value:2, duration:until_end_of_next_turn, source:dragon} + condition log "−2 AC until the end of ElderPaladin's next turn" + rounds:2 pendingExpirations clock ✓ (MA-0115 chain live). Success target got NO te ✓ (fail-only grant correct).
- **DEFECT 1 — half-on-success damage leak (MV-20/MA-0218 family)**: success log `dcSuccess:"half"` → AberrantSorcerer "Saved — takes 7 Poison damage (rolled 19, halved)" (15→7, hp −7). Row authors NO half clause; success must be ZERO.
- **DEFECT 2 — once-per-turn legendary gate DEAD (MA-0184/0217/0227 family)**: chip clicked AGAIN same window → picker re-opened, cast 2 fired full saves (Ab fail 20, EP fail 19, hp −20/−19), ZERO refusals across log, `monsterLegendaryUses` key NEVER created (still null). Rules: can't take again until start of its next turn.

## Likely Location
- `public/data/monsters.json` ancient-green-dragon legendary_actions: Noxious Miasma row lacks `dc_success:"none"`; header row [0] lacks numeric `uses` field ("Legendary Action Uses: 3" is name-text only).
- `src/components/encounter/MonsterCardModal.jsx:133` `resolveBlockSaveDcSuccess` → `action.dc_success ?? 'half'` (half default applied).
- `src/components/encounter/MonsterCardBody.jsx:54` — `legendaryHeaderAction()` null (requires `rows[0].uses != null`, monsterLegendaryUses.js:156) → plain UNGATED branch, save chip routes straight to handleSaveRoll; cooldown lives only inside `expendLegendaryUse`.

## Fix shape (data-only precedent MA-0030/0070/0115)
Header `uses:3` + Noxious Miasma row `dc_success:"none"`; AC-penalty + recharge/gate machinery already LIVE consumers — no code change needed.

## Notes
- Core-exact: DC 21 CON, type Poison, dice 5d6, fail=full damage, AC−2 te applied fail-only with correct duration + expiry clock. Only defects = (a) success-half leak, (c) legendary once-per-turn gate dead.
- MA-0227 (Adult Green sibling) precedent identical: header no uses, 3× ungated same-window fire.
