# Bug MA-0036 — Adult Black Dragon · Spellcasting (MV-5: block save, spell names inert)

**Verdict: FAIL** (as expected). Spellcasting is rendered as a block-save affordance; no per-spell casting exists. PASS would require per-spell cast — not present.

## Evidence

### 1. Block-save, not spellcasting
- `public/data/monsters.json` Adult Black Dragon `actions.Spellcasting` authors only `save_dc: 17`, `save_type: "Charisma"` — a single block save on the action. Spell list lives solely in free-text `description` ("At Will: Detect Magic, Fear, Melf's Acid Arrow (level 3 version); 1/Day Each: Speak with Dead, Vitriolic Sphere", "+9 to hit with spell attacks"). No `spells` array, no per-spell level/save/usage fields.
- `src/components/encounter/MonsterAction.jsx`: `ActionSaveRoll` renders one `span.mc-dice-link-save-clickable` "DC 17 Charisma" when `save_dc != null`; `ActionDamageLinks` returns null when `save_dc != null` (line 11). Spell names are emitted via `dangerouslySetInnerHTML` on the description (line 70) → inert `<em>` text nodes.
- E2E (test-campaign, `.mc-overlay` on Initiative card): Spellcasting row affordances enumerated = exactly one link (`mc-dice-link mc-dice-link-save mc-dice-link-save-clickable`, "DC 17 Charisma") + inert `<em>` nodes (Detect Magic, Fear, Speak with Dead, Vitriolic Sphere). No spell buttons/chips; "+9 to hit" attack bonus not actionable (no `attack_bonus` authored → no attack link).
- Clicked block link once: `popup-modal` "CHA … DC Unknown — no success or failure"; log shows dragon self-rolled CHA save (`saveDc: 17`, `saveResult: failure`, `dcSuccess: "half"`), no spell context, no damage, no PC effects — zero-damage path as predicted. (Popup said "DC Unknown" despite saveDc 17 in payload — secondary defect.)

### 2. Named-spells grep-zero
- `rg -i "melf|acid_arrow|acidArrow|vitriolic" src/components/initiative src/services/combat src/services/runtime server` → zero matches. Whole-repo hits only `src/services/automation/handlers/class-other/elfishLineageHandler.js` and `src/components/char-sheet/CharSpecialActions.jsx` (PC high-elf feature, not monster consumers). No handler maps the dragon's spell names to castable spells; nothing to look up, gate, or automate.

### 3. 1/Day ungated
- No usage structure anywhere: usage exists only inside the description prose ("At Will", "1/Day Each"). `action.usage` is absent on the Spellcasting entry; the UI would print it as an `<em>` suffix only if authored (MonsterAction.jsx line 71). No uses counter, no reset logic, no consumption on the block-save click — "1/Day Each" is decorative text; Speak with Dead / Vitriolic Sphere are indistinguishable from At Will spells and unenforceable.

## Forced-click confirmation
- Forced programmatic `.click()` on the "Vitriolic Sphere" `<em>` and "Melf's Acid Arrow" `<strong>`/`<span>` nodes inside the row: zero popups, zero modals, zero log entries, HP unchanged — inert text confirmed.

## FAIL criteria met
Block save instead of spellcasting UI; named spells grep-zero in monster consumers; 1/Day usage ungated prose.
