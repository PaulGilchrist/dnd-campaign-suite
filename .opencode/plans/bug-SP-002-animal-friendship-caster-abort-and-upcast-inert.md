# bug-SP-002 — Animal Friendship: caster-state abort burns slot; upcast multi-target inert

Verdict context: SP-002 E2E on test-campaign (Wild_Sage_Druid lv20 2024, GM :5173), 2026-10-01. Core single-target loop PASSES live (see checkpoint-SP-002.md); two defects force FAIL-subset→FAIL on the full bundle.

## Defect A (blocker): cast aborts + slot burned when caster has no `activeConditions` runtime key

### Overview
After a sanctioned Admin clear (or on any caster whose `<Caster>.activeConditions` change-data key has never been created), clicking Cast → confirm on Animal Friendship burns a spell slot, stamps the `spell` log entry, then silently throws in `executeSpellCast`. No save prompt fires, no inline NPC save, no condition, only a console error for the GM.

### Expected (canonical)
Spell resolves: WIS save vs DC 17, Charmed on fail. A missing optional runtime key must never abort casting (or must not consume a slot when it does).

### Actual
Console: `[spellCast] casterConditions: activeConditions is not an array` → `Error: activeConditions must be an array for caster` (spellCastService/execution/index.js:109-122, called unconditionally at :603 before all triggers; caught+swallowed in useSpellCastExecutor.js:58). Live ledger: lv1 slots 4→…→0 with one adjudicated-or-aborted cast each, log holds `spell` stamp but zero `ability_use`/`save_result`/`condition` entries; `pendingSavePrompts` null.

### Steps
1. test-campaign, GM. Admin-clear change-data + log (leaves caster keys absent).
2. Add Animal Friendship to Wild_Sage_Druid if missing (wizard step 14 tick + Save).
3. EB Join Wolf → Join Encounter.
4. Druid sheet → Animal Friendship → Cast Spell → tick Wolf → Cast Animal Friendship (1).
5. Observe: slot spent, no adjudication, console throw. (Reproduced 1/1.)

### Likely Location
`src/services/rules/spells/spellCastService/execution/index.js:109-122` — `resolveMagicalAmbushInvisible` throws instead of treating missing/null caster `activeConditions` as `[]`. Cross-cutting: every spell cast hits :603.

### Workaround (used to continue SP-002 E2E)
Initiative → Druid card `.effect-add-btn` → EffectAdder conditions tab → Deafened → Apply → remove badge (badge ×) → `activeConditions: []` seeded → casting works.

## Defect B: 2nd-level+ upcast targets +0 Beasts; slot ledger drifts

### Overview
Popup upcast radio advertises "Level 2 — 2 targets", lv2 slot IS paid, but only ONE target is ever adjudicated and the picker caps selection at 1.

### Expected (canonical)
Animal Friendship 2024: "one additional Beast for each spell slot level above 1" — lv2 = up to 2 Beasts, each gets its own WIS save.

### Actual
Live lv2-radio cast (2 Beasts in combat): picker enabled exactly one checkbox (2nd stayed `disabled` even before selection-filtering could apply to the other — gate never passes `maxTargets`, spellGates.js:535-546 → picker default cap 1). Runner hardcodes `isUpcast: false` and never forwards `pending.spell.upcastLevel` (useSimpleSpellHandlers.js:162-172), so `prepareSpellCast` resolves `effectiveSpellLevel=1` → handler `slotLevel=1` → `maxTargets=1` → exactly one `ability_use` + one save. Slot ledger across the session: 2 adjudicated lv1 casts + 1 lv2-radio cast produced lv1 −4 AND lv2 −1 (expected lv1 −2, lv2 −1; extra lv1 drains unexplained — logged honestly, not chased).

### Steps
1. Join Wolf 1 + Wolf 2. Druid opens Animal Friendship → select Level 2 radio ("2 targets") → Cast → picker shows both wolves, one checkbox disabled after ticking the other.
2. Confirm → log carries ONE `ability_use` ("on Wolf 2 … DC 17") + ONE save; lv2 slot decremented too.

### Likely Location
- `src/hooks/combat/spellGates.js:535` — `gateAnimalFriendship` makePending omits `maxTargets` (cf. `extractMaxTargets` used by Aid/Bane); should pass `upcastLevel+1` from the popup radio.
- `src/hooks/combat/useSpellMetamagicFlow/useSimpleSpellHandlers.js:162` — `runAnimalFriendship` `isUpcast:false` hardcoded, upcastLevel never threaded (MA-0127 Aid family twin).
- `src/services/automation/handlers/spells/animalFriendshipHandler.js:150-152` — consumes `action.spellSlotLevel` which is always base 1 through this lane.

## Notes / advisories (not defects per se)
- 24h duration modeled as `expiryRounds: Infinity` (animalFriendshipHandler calls addExpiration with no clock); duration text appears only in log note + popup. No charmed expiry clock.
- `endAnimalFriendshipEarly`/`isAnimalFriendshipActive`/`_animalFriendship_<caster>_<target>` tracker: grep-ZERO callers outside the handler file — RAW "ends on damage" outcome IS enforced engine-wide (live: `condition removed … reason: "took damage (Charm)"` + `activeConditions: []`), but the spell-specific tracker/orphan-expiration cleanup is dead code and its dedicated log never fires; pendingExpirations entry orphans after charmed-clear.
- Victim machine truth on grant: `Wolf 1.activeConditions:["charmed"]` correct; per-condition `meta.source` NOT written by handler (attribution lives in condition log `reason:"Animal Friendship spell"` only).
- EB-NPC badges: charmed badge on monster initiative card not rendered for save-grants (§191 precedent); machine truth = change-data.
- "Skip" in the target picker still stamps a `spell` cast log entry (no slot consumed) — cosmetic ledger noise.
