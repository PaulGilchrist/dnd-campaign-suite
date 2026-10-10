# CLA-354 Tamed Surge — FAIL (post-cast trigger unwired; manual-row lane works)

## Data (2024 classes.json, Sorcerer → Wild Magic Sorcery majors[3].features[4])
> "Immediately after casting Sorcerer spell with spell slot, create effect of your choice from Wild Magic Surge table instead of rolling. Can choose any effect except final row. Once per Long Rest."
automation: `{ type: "wild_magic_tamed", trigger: "after_sorcerer_spell_slot", recharge: "long_rest", uses: 1 }` — **Wild Magic-major, lv18** → subclass swap performed per protocol (Aberrant→Wild Magic, md5-restored).

## What works (manual-row lane, verified live in test-campaign)
- Special Actions row "Tamed Surge:" is interactive (`INTERACTIVE_HANDLER_TYPES`, automationService.js:35) → `handleTamedSurge` (wildMagicSurgeHandler.js:113) opens tamed chooser modal.
- Chooser lists 24 options from `/data/wild-magic-surge.json` (25 rows) minus final wish row (`slice(0,-1)`, WildMagicSurgeModal.jsx:18) — final row excluded ✓.
- Confirm → `onTamedSurgeSelected` (handler:246): records `wildMagicSurgeEffects` entry with `roll:"tamed"` (NO random d100 ✓), spends `tamedSurgeUses` 1→0 (persisted to change-data ✓), logs ability_use "AberrantSorcerer used Tamed Surge to select: …" naming feature+choice ✓.
- Decline (Cancel): no effect, no spend ✓ (verified: empty effects, uses untouched).
- Gate: second activation → popup "Tamed Surge has no uses remaining. Recharges after a Long Rest." ✓; long-rest recharge key registered (restRules-constants.js:239, trackedResources.js:59).
- Consumer exists for record lane: CharSummary.jsx:288 renders "Tamed — {effect}" badge.
- Slot-gate by grep: `triggerWildMagicSurge` gates on `usesSpellSlot` (wildMagicSurgeService.js:82) → cantrips excluded (shared machinery with CLA-389 lane; not tested there).

## FAIL core: trigger `after_sorcerer_spell_slot` never dispatches tamed lane
- **Empirical** (lv20, Burning Hands cast @lv1 slot, "Cast Without Metamagic"): slot 4→3 spent, spell logged, but NO chooser, NO popup, NO d20-log, NO surge of any kind post-cast.
- Code: post-cast seam `runPostCastTriggers` → `triggerWildMagicSurge` (spellCastService/execution/index.js:533) filters passives by `wild_magic_surge` only (wildMagicSurgeService.js:19,84) → dispatches `handle` (random d100 roll lane = CLA-389 machinery, shared file). There is **no branch consulting `getTamedSurgeFeature`** anywhere outside tests (`getTamedSurgeFeature` zero prod callers). `handleTamedSurge` is reachable ONLY via the manual row click (index.js:472).
- Manifest says "instead of rolling" — casting still runs the roll lane (here it was silent, likely passive-collection gap: no `wild_magic_surge` passive surfaced either, since no "Rolled N" log occurred).

## Verdict: FAIL
Primary manifested trigger (post-cast chooser replacing the roll) is unwired; feature is decorative at the spellCast seam. Manual row + chooser + spend/gate/log are functional, but the automation never fires "immediately after casting".

## Fix pointer
In `triggerWildMagicSurge` (or a sibling post-cast trigger): if `getTamedSurgeFeature(playerStats)` exists and `tamedSurgeUses > 0`, dispatch `wild_magic_tamed` chooser instead of (or offering precedence over) the d20 roll lane; spend via existing `onTamedSurgeSelected`.

## Verification trail
Host: AberrantSorcerer lv20, subclass swapped to Wild Magic Sorcery. Header verified `test-campaign`. Surge table runtime = `/data/wild-magic-surge.json` (dataLoader.js:599), NOT classes.json majors table (25 vs 20 rows).
