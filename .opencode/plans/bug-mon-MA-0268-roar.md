# Bug — MA-0268 Androsphinx · Roar (actions[2], save DC 18 WIS, per day ×3)

VERDICT: FAIL (stage-inert staged-clause save + inert 3/Day gate + roar-1 over-application)

## Expected (canonical, public/data/monsters.json androsphinx actions[2] description)
- Three escalating roars per long rest; each creature within 500 ft hears, DC 18.
- First Roar: fail DC 18 WIS → "is frightened for 1 minute. A frightened creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success." No damage.
- Second Roar: fail DC 18 WIS → "deafened and frightened for 1 minute", repeat saves. No damage.
- Third Roar: DC 18 Constitution ("Each creature makes a DC 18 Constitution saving throw") — fail → 44 (8d10) thunder + prone; success → half damage, not prone.
- Stage escalation + 3/day spend required.

## Actual (live probe, test-campaign, live Androsphinx 1 cs idx2 init 2)
Row affordance: `8d10` chip + `DC 18 Wisdom` chip + display-only `(3/Day)` emphasis. No stage/uses counter.
- **Stage click 1 (AberrantSorcerer, WIS −1, 41hp) → SAVE FAILURE total 17 vs DC 18:**
  - `save_result` DC 18 WIS success:false (DC/type enforced — ONLY exact part).
  - `roll save-damage name:Roar formula:8d10` total 37 → `hp_change −37` (41→4). Roar 1 canonical = zero damage.
  - `condition applied: "Deafened, Frightened, Prone"` (runtime `activeConditions:["deafened","frightened","prone"]`). Roar 1 canonical = Frightened only.
  - `activeConditionMeta` = `{source}` only — no duration, no repeat-save-at-EOT arming.
- **Stage click 2 (second roar, same day, DraconicDragon WIS −1, 165hp) → SAVE SUCCESS total 18:**
  - Identical prompt text incl. "Half damage on successful save" — no stage label, no escalation, no remaining-uses.
  - Success applied `hp_change −28` (8d10 halved). Roar 2 success canonical = nothing. Confirms every click = conflated third-roar math.
- **Stage click 3:** prompt opens normally, zero refusal; uses still uncounted. Never refuses (no counter).
- Runtime store after 2+ resolutions: `monsterSpellUses: null`, zero roar/stage/uses keys on sphinx.
- Repeat-save seam: absent (meta lacks any repeatSave/duration stamp; no EOT prompt automation).

## Extraction / grep results
- `extractConditionsFromSaveEffect` (MonsterCardHelpers.js:181) is a flat word-boundary scan of CONDITIONS over the WHOLE save_effect → staged text yields `['deafened','frightened','prone']` identically at every stage (no clause/stage parsing). Consumers: MonsterAction.jsx:81, MonsterCardModal.jsx:264/527/750.
- Uses gate EXISTS (MA-0020 `monsterAbilitySaveUsesGate`, monsterAbilityUses.js:19-29) but reads `action.maxUses ?? action.uses`; Roar authors only `usage:{type:'per day',times:3}` → `abilitySaveMaxUses` null → gate inert. `'per day'` occurs only in `formatActionUsage` display (MonsterCardHelpers.js:708 → "(3/Day)" is cosmetic).
- `roarCount|roar_stage|roarStage`: zero hits in src/ and server/. No stage state anywhere.
- `dc_success` absent on row → defaults `'half'` (MonsterCardModal.jsx:134/526) → 8d10 half-on-success armed on ALL clicks incl. roars 1-2 (canonical: no damage until third roar).

## Likely Location
- MonsterCardHelpers.js:181 `extractConditionsFromSaveEffect` — clause parser cannot handle staged "First Roar:… Second Roar:… Third Roar:…" text (MA-0090 precedent family; here non-empty-but-conflated extraction rather than []).
- MonsterCardModal.jsx save-row path (`handleSaveRoll` → `executeBlockSaveRoll`) — `saveDamageFormula`/`dcSuccess` armed regardless of stage; no roar-stage state; `resolveAbilityUsesGate`/`abilitySaveMaxUses` field-name mismatch (`usage.times` never read).

## Notes
- Condition consumers for Frightened/Deafened/Prone DO exist (§7 registry/CreatureBadge/condition pipeline) — fix needs a stage-aware clause parser + roar-stage/uses state (per-long-rest counter), not new condition plumbing.
- Canonical data mismatch on the row itself: `save_type:"Wisdom"` but third roar is DC 18 CON on disk; app cannot resolve CON leg even with stages fixed.
- 500 ft gridless: no auto-includer; single-target via tracker Target combobox only — area leg advisory (prior sphinx rows precedent).
- Victims left in combat-changed state: AberrantSorcerer 4/41 + Df/Fr/Prone; DraconicDragon 137/165. GM cleanup advisable.
