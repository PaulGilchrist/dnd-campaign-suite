# BUG MA-1502 — Sphinx of Valor "Roar" launcher row is inert (DATA)

## Row (verbatim)
`{"id":"MA-1502","stableKey":"sphinx-of-valor|actions|2","monsterIndex":"sphinx-of-valor","monster":"Sphinx of Valor","actionIndex":2,"actionType":"other","uses":"3/Day","description":"The sphinx emits a magical roar. Whenever it roars, the roar has a different effect, as detailed below (the sequence resets when it takes a Long Rest)","verified":"not verified"}`

## VERDICT: FAIL(b)/DATA
Zero affordance + zero live delta + grep-zero reachable path. MA-1483 dead-launcher fingerprint (§67 MA-0268 fix template applies).

## Evidence — STATIC (disk)
- `public/data/monsters.json` sphinx-of-valor.actions[2] keys = **['name','description','uses'] ONLY**. `uses:"3/Day"` string; NO `staged_roar`, NO `maxUses`, NO `save_dc`/`save_type`/`save_effect`, NO damage dice, NO automation. Plain prose launcher.
- Stage mechanics live on SEPARATE sibling rows: First Roar / Second Roar / Third Roar (each save_dc 20 + save_type + range + save_effect; Third adds 8d10 thunder chip) — sequence enforcement (Nth-click-resolves-Nth-stage) structurally impossible from the launcher.

## Evidence — GREP (code)
- Staged-roar machinery exists and is live (MA-0268 Androsphinx): `roarService.js` `isStagedRoarAction` (:70 `action?.staged_roar === true`) + seam `MonsterCardModal.jsx:2067` `resolveRoarStageAction({action, usesGate})`. Valor row lacks `staged_roar:true` → resolver byte-inert null; stage-swap picker (ROAR_STAGES incl. per-stage description swap — §67 "swap description too or re-extraction wrong dice") unreachable.
- Uses counter dead two ways: (1) gate + roar seam live ONLY inside `handleSaveRoll` (ability-save-row click path, needs `save_dc>0`); Roar row has none → path never runs. (2) `abilitySaveMaxUses` = `Number(action.maxUses ?? action.uses)`; `Number("3/Day")` = NaN → `monsterAbilitySaveUsesGate` returns null (`!Number.isFinite`). No "N/Day"-string parser exists on this path app-wide (grep zero).

## Evidence — LIVE (test-campaign, 2026-09-28)
- Header test-campaign ✓; initiative LIVE: Sphinx of Valor 1 199/199 init15, Sphinx of Secrets 1 136/136 init12, Bandit 1 929/11 init6; log baseline 24.
- Card via `img[alt="Sphinx of Valor 1"]`.click() → 11 `.mc-action` rows. Roar row outerHTML = `<div class="mc-action"><strong>Roar.</strong><span>prose…Long Rest</span></div>` — **0 chips, 0 buttons, cursor:auto**; even the "3/Day" text does not render (no uses badge on non-spell prose rows).
- Press Roar row ×2 (container el.click, 800/900ms settle): mid+after `.popup-overlay` 0, `.sp-modal` 0, `.dsp-overlay` 0, overlays 1→1, window errors 0, console errors 0.
- Post: log 24→24 (zero delta, no `ability_use`, no `roar_refused`); change-data `Sphinx of Valor 1.monsterSpellUses` = **null** (no counter key created, nothing spent).
- Control (same card): First/Second Roar DC 20 Wisdom chips + Third Roar 8d10 + DC 20 Constitution chip all render clickable — stages are live only as ungated independent chips; no sequence, no launcher, no uses enforcement.
- Screenshot: `ma1502-roar-row-zero-affordance.png`.

## Expected (RAW)
Roar is one 3/Day launcher whose Nth use resolves only the Nth stage sequence, resetting on a Long Rest. App delivers: press → nothing. Sequence enforceable only by GM manually picking sibling chips in order (ungated).

## FIX = MA-0268 staged_roar template (DATA, code-zero)
Rework sphinx-of-valor.actions[2] to the androsphinx byte-shape (`public/data/monsters.json:5008` family):
`staged_roar:true`, `maxUses:3`, `uses` numeric or dropped, `save_dc:20` (Valor siblings are DC 20 — NOT androsphinx 18), `save_type`, `save_effect`, `damage_dice_primary:"8d10"`, `damage_type_primary:"Thunder"`, `usage:{type:'per day',times:3}` — plus stage-canonical ROAR text/`save_effect` per stage with Valor DC 20 prose in `roarService.js` ROAR_STAGES (currently hardcoded to androsphinx DC 18 copy — verify stage prose parameterized or forked before reusing; §67 description-swap rule applies). Long-rest reset residual stays GM-enforced (MA-0215 precedent, dawn reset).

## State left
Initiative LEFT RUNNING for MA-1503+ (Valor 199/199, Secrets 136/136, Bandit 929/11, round 1 active Sphinx of Secrets 1). Card closed; zero overlays; log 24 untouched. No manifest/git writes; no POSTs.
