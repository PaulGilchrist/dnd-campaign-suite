# Bug — MA-0013 Aberrant Cultist · Counterspell (2/Day) — FAIL

**Verdict: FAIL (flavor b — reactive counterspell for monsters, zero affordance, zero auto-trigger, grep-zero consumers).**

## Row
- id MA-0013 · stableKey `aberrant-cultist|reactions|0` · category reactions · actionType other.
- Expected: cultist casts Counterspell in response to a spell trigger, same spellcasting ability as Spellcasting, 2/Day.

## Static evidence
- `public/data/monsters.json` aberrant-cultist `reactions[0]`: `{name:"Counterspell (2/Day)", description}` ONLY —
  no `uses`, no `automation`, no `trigger`, no `save_dc`, no `attack_bonus`, no damage dice.
  "(2/Day)" is name-only text → MV-6 ungated-uses drift; no counter exists anywhere to spend or check.
- `MonsterCardBody.jsx:28` renders `monster.reactions` read-only; `MonsterAction.jsx` affordance gate:
  `ActionSaveRoll` null (save_dc==null), `ActionDamageLinks` null (no dice), no attack link (no attack_bonus)
  → row renders zero clickable elements (MV-6 rule).
- Grep `counterspell` consumers: `reaction_counterspell` exists only in
  `automationInfoBuilder/reaction.js:198` (PC reaction row builder) + `automation/index.js:517` HANDLER_MAP →
  `counterSpellHandler.js` which is PC-scoped (`playerStats` spell slots, `_Counterspell_usedRound` on
  `playerStats.name`, CON save listener on the attacker). No producer ever builds this row for a monster;
  automationCollector reads PC character features only. No `spell_cast`-time hook scans monster reactions
  (grep `spell_cast|reaction_trigger`: only PC infoBuilder token + arcaneWard abjuration hook).

## Live evidence (test-campaign, 2026-09-13)
- EB Join "Aberrant Cultist" → cs `Aberrant Cultist 1` hp 137 ac 14 (loglen baseline 2).
- Option A: `.mc-overlay` Counterspell row outerHTML = `<div class="mc-action"><strong>Counterspell (2/Day).</strong> <span>…</span></div>`
  — `.mc-dice-link`: 0, `button`: 0, `[role=button]/.clickable`: 0, inline-onclick: 0.
  Forced `el.click()` on row + every inner strong/em/span → 0 overlays, 0 log/change-data deltas.
- Option B (real trigger built): DivinationWizard armed target-select → "Aberrant Cultist 1" (cs.targetName confirmed),
  sheet Fire Bolt → SpellDetailPopup → Cast Spell. First cast hit FT-087 known `activeConditions` throw
  (pitfall 40); hydrated `activeConditions:[]` + reload, recast resolved:
  roll Fire Bolt 15→26 vs AC 14 HIT, `hp_change` cultist 137→111.
  During and after the PC spell cast: NO counterspell offer/prompt/popup, NO `counterspell*` log entry,
  `pendingSavePrompts`/`pendingSaveListenerPrompts` null, zero counterspell keys in change-data,
  cultist char store has no keys at all (no 2/Day counter, no usedRound latch).
- 2/Day probe: moot — no affordance and no counter exist (zero affordance = nothing to re-fire).

## Notes
- CLA-325 advisory precedent covers monster RECAST-block only, not Counterspell — no recorded GM decision
  here, so per strict policy unimplemented = FAIL, not advisory.
- Fix would need: monsters.json `automation` (e.g. `uses:2` + trigger) + a monster-path reaction dispatcher
  at PC spell-cast time (offer row on monster card or auto-prompt) + `reaction_counterspell` consumer keyed
  by monster cs name + round/uses latch.

## Cleanup
- Admin clear change-data + log via POST `/api/campaigns/test-campaign/admin/*` with `-H "Host: localhost"`; browser closed.
- PC spell data untouched (only runtime `activeConditions:[]` hydration on DivinationWizard, erased by change-data clear).
