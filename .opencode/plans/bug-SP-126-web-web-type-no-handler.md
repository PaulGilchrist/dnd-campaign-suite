# Bug SP-126 — Web: cast pays slot + concentration but DEX save never fires; Restrained never applied

**Verdict: FAIL** (core save/apply legs inert — live probe + grep, 2026-09-09)

## Host / rig
- DivinationWizard lv20 Wizard 2024, spell save DC 19 (sheet-verified; registry FT-099 ASI INT 20).
- Web PERMANENTLY PREPARED via Edit wizard tab-14 tick + trusted ✓Save (disk `public/campaigns/test-campaign/DivinationWizard.json` spells[] 44→45, strings array).
- EB exact "Zombie" joined via "Join Encounter" → cs `Zombie 1` init 18, hp 15, DEX −2 (deterministic fail vs DC 19 — branch never reached).

## Live evidence (self-issued fetches/logs only)
1. Sheet `Web` row → SpellDetailPopup "Slots Remaining: 3 slots" → trusted "Cast Spell".
2. AoE picker `.sp-overlay` ("Each creature in the area must make a DEX save or become Restrained…") — unfiltered, all 15 combatants offered (SP-111 family). Trusted-tick Zombie 1 → "Cast Web (1)".
3. After confirm: change-data `DivinationWizard.spell_slots_level_2` **3→2 (slot paid ✓)**; cs `concentration {spell:'Web', dc:19}` **written by generic `useConfirmableFlow.createConfirmHandler → prepareSpellCast` ✓**; NO save prompt anywhere (`pendingSavePrompts` absent); `Zombie 1.activeConditions` never written ✗; ZERO overlay.
4. Campaign log gained exactly ONE generic `type:'spell'` cast row — ZERO `ability_use`, ZERO `save_result`, ZERO `condition` entries (AGENTS.md every-automation-must-log gap for the effect legs).
5. Zero console errors — deterministic clean null return, not a crash.

## Root cause (code seam)
- LIVE route: spellGates.js `'web'` → `gateWeb` (:514) → picker → confirm bound to `handleWebConfirm` from **useSimpleSpellHandlers.js:625**, which stamps `automation:{type:'web', saveDc:<real>, saveType:'DEX'}`.
- `executeHandler` (automation/index.js:666): `HANDLER_MAP['web']` is **UNDEFINED** (map has only `web_area_save: handleWebAreaSave` at :549) → `if (!handler) return null` → entire Web effect body (DEX saves, Restrained, per-target logs) never executes. Slot+concentration already paid upstream = wasted cast.
- The ONLY stamp of `type:'web_area_save'` (the reachable type) is `useAreaEffectHandlers.js:130 handleWebConfirm`, but `useSpellMetamagicFlow/index.js` destructures only Globe/Forcecage/AntimagicField from `areaHandlers` (:95-99) — the web confirmer there is **dead code**.
- `automationRouter.js:679 case 'web_area_save'` pushes the automation-info row to specialActions only; the spells.json `save_attack` entry never routes (gateWeb pre-empts generic save handling).
- `processWebAreaSave` (webAreaSaveHandler.js:198): ZERO callers anywhere; tracking key `_web_<caster>` (:199): ZERO producers → per-turn STR re-save permanently inert.

## Secondary canonical clauses (§7 gaps — grep, zero consumers)
- Difficult Terrain / Lightly Obscured: comment + popup prose only; only `difficult_terrain` consumer is the unrelated Speedy feat passive (automationPassives.js:225).
- STR (Athletics) break-free action: popup summary text only; no producer/modal/check consumer.
- Anchoring/collapse clause: zero code.
- Flammability / 2d4 fire / burn-away: zero code.
- Zone persistence: no `_web_*` writer in the live path; top-level `targetEffects` stayed absent live.

## Fix direction
Point useSimpleSpellHandlers handleWebConfirm at `type:'web_area_save'` (or register `web` → handleWebAreaSave in HANDLER_MAP); wire or delete the duplicate dead confirmer; register `_web_<caster>` tracking + a turn-start caller (SP-109 `pendingTurnStartEffects`/expireStaleEffects Phase-4 is the only proven recurring-save seam, playbook :189 — roll saves directly, NOT via calculateSpellDamage, to avoid phantom concentration checks); add te/zone + expiry per targetEffectDefinitions registry.

## Retest
Here post-fix: lv2 Web prepared + DC 19 vs EB Zombie 1 (DEX −2 fail leg) + a +0 DEX target (Thug) for the success leg; judge slot ledger 3→2, save prompts/auto-rolls, Restrained persist+expire, logs.

Cleanup: runtime + log admin-cleared by this run; Web stays PREPARED (permanent, disk 45).
