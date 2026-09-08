# Bug CLA-359 — The Third Eye: no campaign log entry on use (2024-09-08)

**Verdict: FAIL (logging gap; core benefit machinery live)**

Manifest: CLA-359, Wizard, "The Third Eye". App level **lv10** Diviner major (`public/data/2024/classes.json` [11]/majors[1]/features[3]; canonical lv6 — divergence noted §2). Host: DivinationWizard lv20, subclass swapped Abjurer→**Diviner** via Edit wizard (step-6 Sorcerer→Wizard rebuild + step-7 Diviner; disk `class.subclass.name:"Diviner"`, major null).

## Live E2E (what WORKS)
- Bonus Actions row "The Third Eye:" renders (automationRouter.js:653 → bonusActions; core-handlers.js:584). Click → ThirdEyeModal chooser with exactly 3 radios (Darkvision 120/Greater Comprehension/See Invisibility) → "Use Bonus Action".
- Spend/latch: 1st use writes single activeBuffs entry `{name:'The Third Eye', effect:'see_invisibility', duration:'short_or_long_rest', seeInvisibleRange:10}`; 2nd click while active → refusal popup "currently active: See Invisibility", zero writes (thirdEyeHandler.js:14–27). ONE benefit at a time proven (single-entry buffs both times; swapped only across rest).
- Sense surfaces: See Invisibility flag in sheet Senses line (charSummaryCalc.js:357 → CharSummary.jsx:355); after short rest re-arm, Darkvision pick → reload shows "Senses: … Darkvision 120 ft." (senseUtils.applyThirdEyeDarkvision live via rules-senses.js). Buff badge "The Third Eye: See Invisibility" / "Darkvision 120 ft." live.
- Rest gating: short rest modal → "Complete Short Rest" clears buff (restRules-shortRest.js:236-240 keep-Mage-Armor-only); row re-arms, 2nd benefit selectable. Long rest (instant) clears; post-LR reload senses clean (control ✓).
- No uses counter modeled (bonus-action-only spend) — accepted.

## FAIL clause — mandatory log never written
Both uses produced **zero** campaign-log entries (`GET /api/campaigns/test-campaign/log` stayed `[]` until the short_rest system entries; no "The Third Eye: …" row ever appeared). Root cause: `applyThirdEye` returns `logEntries:[{type:'action', text:'The Third Eye: <benefit>'}]` (thirdEyeHandler.js:95-99) but its ONLY live caller `ThirdEyeModal.handleApply` (ThirdEyeModal.jsx:16-22) just `setResult` — never POSTs them. The generic flusher (`useCharActionsAutomation.js:249-250` addEntry) only sees handler `handle()` results, and thirdEye's handle returns `{type:'modal'}` (no logEntries). ThirdEyeModal has no addEntry/log import. Violates AGENTS.md "Every automation must log … when triggered" (playbook: popup-only automation = logging gap).

Secondary nit: handler log type is `'action'` where siblings (arcaneWardHandler.js:125) use `'ability_use'` — when wiring the flush, use `ability_use` shape with abilityName+description.

## Fix recipe
ThirdEyeModal.handleApply: after applyThirdEye resolves, POST each `result.logEntries` via `addEntry(campaignName, entry)` (import from log service used at useCharActionsAutomation.js:250) — or lift log flushing to the modal onClose payload. Change log entry type to `ability_use` with abilityName `The Third Eye`.

## State left
change-data cleared via Admin (incl. log); char LEFT **Diviner lv20** (permanent — registry previously said Abjurer; name now matches subclass). Server up.
