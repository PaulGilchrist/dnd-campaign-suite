# Bug CLA-374 — Use Magic Device (Rogue Thief, classFeature, 2024) — inert row, zero mechanical consumers

**VERDICT: FAIL** (inert automation — verified live 2026-09-09, test-campaign, host AasimarTest lv20 Rogue Thief 2024, INT 11/+0, PB+6).

## Data (canonical vs app)
- `public/data/2024/classes.json` Rogue → `majors[3]` (Thief) → features lv13 "Use Magic Device", automation `{type:'use_magic_device', attunementLimit:4, chargeReroll:'1d6', chargeRerollSuccess:6, scrollAbility:'INT', scrollCheckDC:'10 + spell_level', scrollDisintegratesOnFail:true, casting_time:'passive'}`. Matches canonical 2024 PHB Thief lv13. Host lv20 qualifies.

## Clause-by-clause evidence

### 1) Row dispatch — INERT (root cause)
- `automationRouter.js:515` pushes `use_magic_device` to BOTH passives and specialActions.
- `CharSpecialActions.jsx:753-758`: row clickable only if `isInteractiveAutomation()` → `INTERACTIVE_HANDLER_TYPES` (`automationService.js:14-69`) — **`use_magic_device` is NOT in the set** (cf. pitfall 42l for `extra_action`, identical failure mode).
- Live DOM: `<b class="">Use Magic Device:</b>` in `.char-special-actions` — no `clickable` class, no onClick. Forced `el.click()` → **popup 0, change-data delta 0 (`activeBuffs` absent), campaign log lines 0** (loglen 0 before and after).
- `handleUseMagicDevice` (`handlers/class-fighter-rogue/useMagicDeviceHandler.js`) exists and is mapped (`automation/index.js:452`) but is **UI-unreachable**: even if invoked it only toggles an `activeBuffs` entry with a prose popup — no dice roll, no resource spend, no log line (AGENTS.md logging gap baked in).

### 2) Attunement ≤4 — broken for 2024, wizard-only
- Sole consumer: `WizardStepMagicItems.jsx` `calculateAttunementLimit` — base 3, +1 if `subclass.class_levels[].features` contains "Use Magic Device".
- 2024 wizard maps `subtypes = cls.subclasses || cls.majors` (`useWizardData.js:27-30`); 2024 Thief major keys = `[name, subtitle, description, features, spells]` — **no `class_levels`** → `subclass.class_levels?.some` → undefined → bonus never fires.
- LIVE PROOF: Edit wizard → Magic Items step → ticked 4 requiresAttunement items on lv20 Thief → warning printed exactly: "You have selected 4 items requiring attunement, but a character can only attune to a maximum of **3** items." (+1 not applied.)
- No runtime/sheet attunement counter anywhere: grep `attunement` consumers = wizard validation + `WizardStepMagicItems` + Elemental Attunement (unrelated feature) only. activeBuff `use_magic_device` has no attunement consumer (`turnStartEffects.js:392 applyUseMagicDeviceTurnStart` is an explicit no-op stub).

### 3) Charges 1d6-on-6 — ZERO consumers
- `chargeReroll/chargeRerollSuccess` appear ONLY in info-builder passthrough (`core-handlers.js:379-380`) and popup prose (`useMagicDeviceHandler.js:45`). No magic-item charge-expense system exists to intercept: magic-items.json carries static `charge` fields (85 items) but no runtime charge pool writer/consumer was found in src/services (grep `chargeReroll` = display-only).

### 4) Scrolls (any-class, INT spellcasting, reliable lv1, Arcana DC 10+lvl, disintegrate) — ZERO consumers
- `scrollAbility/scrollCheckDC/scrollDisintegratesOnFail`: passthrough + popup prose only (same files). No scroll-use producer: no "use scroll" action, no INT (Arcana) check automation, no scroll-destruction effect (grep `disintegrat` = Resilient Sphere prose + this popup only).
- LIVE: added canonical "Spell Scroll" to `inventory.magicItems` (persisted to disk, 5 items) → sheet Inventory section renders only "Equipped: Shortsword" — **no Magic Items section at all** for a 2024 character. Root cause: `App.jsx:120` selects `effectiveMagicItems = magicItems2024`, but `useAppData.js` never returns `magicItems2024` (undefined) → `rules-magicItems.js getMagicItems` early-returns `[]` for 2024. 2024 characters cannot even SEE magic items, let alone use scrolls. (Secondary data bug.)
- Free-text backpack "Scroll of Fireball" does not persist through the inventory textarea on this path (wizard save dropped it — fill/native-setter pitfall confirmed) and would in any case parse as plain backpack text (CharInventory `renderItems` = text only).

### 5) Phantom bonus (extra-rules, dead code)
- `automationModifiers.js:149`: UMD contributes `{target:'ability_check', effect:'advantage', abilities:['INT']}` to `saveModifiers` — 2024 UMD grants no such advantage, and it never fires anyway: consumers (`CharAbilities.jsx:321,327`) filter `target==='saving_throw'` only. Dead + wrong-by-rules if ever wired.

## Summary
Row renders as plain text; clicking does nothing (no handler reachable). The only functional fragment — the wizard attunement cap +1 — silently fails on the 2024 ruleset (structural data mismatch). Charges and scroll clauses have zero consumers; scroll inventory doesn't even render for 2024 characters.

## Fix sketch
1. Add `'use_magic_device'` to `INTERACTIVE_HANDLER_TYPES` (automationService.js) so the row dispatches the handler, OR make it a pure passive (remove specialActions push at automationRouter.js:515-517).
2. `calculateAttunementLimit`: also scan 2024 shape `subclass.features[]` (and honor `formData.class.major`) so Thief lv13+ raises cap to 4.
3. Expose magic items for 2024: return `magicItems2024` (aliases `/data/magic-items.json` — no 2024 file exists) from useAppData, else 2024 sheets stay blind to `inventory.magicItems`.
4. Charges/scrolls need real subsystems (charge pool on item instances; a "Use Spell Scroll" flow with INT(Arcana) check DC 10+lvl + scroll removal + automation log). Until then, expectedBehavior should be marked display-only.

## Cleanup done
- change-data + campaign log cleared via curl -H "Host: localhost"; AasimarTest JSON restored from pre-run backup (`inventory.magicItems` back to `[]`, backpack `[]`, equipped `["Shortsword"]`); servers left running.
