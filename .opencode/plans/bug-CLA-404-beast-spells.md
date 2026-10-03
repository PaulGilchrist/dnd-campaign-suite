# Bug CLA-404 — Beast Spells (Druid lv18 passive): NOT IMPLEMENTED — blanket "No Spellcasting" Wild Shape block stays enforced at lv18+, and refused casts still burn slots

## Title
CLA-404 Beast Spells (Druid passive, 2024 lv18) — zero consumers; live probe proves Wild Shape categorically refuses ALL spellcasting (including component-free spells) for a lv20 druid, with no Beast Spells allowance and no material-cost discrimination.

## Overview
Manifest row CLA-404 claims "unimplemented" and verification was required to prove it cheaply. Grep shows the `passive_rule`/`beast_spells` automation declared in class data has **no consumer anywhere** in `src/` or `server/`, and is not registered in the passive-rule handler map. The live control probe then showed the app does the *opposite* of the canonical rule: the shape_shift Wild Shape buff stamps `blocksSpellcasting: true`, and a generic execution-seam check refuses **every** spell while shape-shifted — byte-identical refusal for a component-free cantrip (which lv18 Beast Spells should allow) and a costly-material spell (which it should refuse for the material reason, not the form reason). The refusal additionally consumes the spell slot.

## Expected (canonical 2024 quote)
> "While using Wild Shape, you can cast spells in Beast form, except for any spell that has a Material component with a cost specified or that consumes its Material component."

(2024 classes.json lv18 Beast Spells description; app data carries this exact text verbatim as a display-only row.)

## Actual (live + code evidence)

### Grep evidence
- `beast_spells` occurrences, whole repo (excluding data): **0 in `src/`, 0 in `server/`**.
  - Only occurrences are data declarations: `public/data/2024/classes.json:3776` (lv18, `{type:"passive_rule", effect:"beast_spells"}`) and `public/data/classes.json:4219` (5e twin lv18).
- `src/services/automation/index.js:287-294` — `PASSIVE_RULE_EFFECTS` registry = {abjuration/divination/evocation/illusion_savant, persistent_rage, superior_defense}. **No `beast_spells`.** `resolveHandler` (:667) returns falsy for unregistered passive_rule effects → the collected feature is inert at dispatch.
- lv18 gate scan: `rg "Beast Spells|level >= 18" src/` → only Fighter superiority-dice hits (unrelated). **No lv18/druid casting exception exists in the spell pipeline.**
- `beast_spells` also appears 0× in the Wild Shape implementation files (`buffHandler.js`, `wildShapeCreatureBuilder.js`, `blockChecks.js`, `spellResolution.js`).

### Live probe results (test-campaign, Wild_Sage_Druid lv20 2024 Circle of the Sea)
1. **Humanoid baseline** — Guidance cast: log `spell` entry (lv0, concentration:true), cast succeeded, no refusal.
2. **Wild Shape ON (Wolf CR 0.25)** — committed state verified: `wildShapeUses 4→3`, `tempHp 20`, root `te {effect:"wild_shape", beastName:"Wolf"}`, cs creature marked `wildShapeSource/beastName`, `activeBuffs [{effect:"shape_shift", blocksSpellcasting:true}]`, log `ability_use "activated Wild Shape as Wolf (CR 0.25)"`. Spell table remains fully visible/clickable in beast form.
3. **Probe A — Guidance (V/S, no Material) in beast form**: REFUSED. Popup: "Wild Shape — Guidance cannot be cast while Wild_Sage_Druid is under Wild Shape — no Spellcasting is allowed." Log: `automation/shape_shift_refused`. **Canonical lv18 expectation: ALLOWED.** Observable humanoid-vs-beast delta for the same spell: success → refusal = the passive's allow-half is absent.
4. **Probe B — Summon Beast (lv2, V/S/M, "gilded acorn worth 200+ GP") in beast form**: REFUSED with **byte-identical popup/log chrome** (`shape_shift_refused`, same "no Spellcasting is allowed" description; only the spell name differs). **Canonical expectation: refused, but because of the Material cost** — the app's refusal carries zero material-cost reasoning, and a spell *without* costly materials (Probe A) is treated identically → **zero discrimination between the two canonical branches**. Additionally the refusal **burned the lv2 spell slot (3→2)** with no spell cast (blockChecks.js comment admits "keeps the paid slot §4 convention") — compounding defect.

### Verdict rationale
STRICT trichotomy: the passive is not implemented (grep-zero consumers, not in PASSIVE_RULE_EFFECTS) and the live differential confirms the canonical lv18 allowance is not honored — a lv20 druid is locked out of all beast-form spellcasting, while material-cost spells that should be refused for a *different* reason are refused by a form-wide block and still pay the slot. FAIL flavor (b), actively misenforcing.

## Steps to reproduce
1. `npm run dev`, open http://localhost:5173, select **test-campaign** (header check).
2. Open Wild_Sage_Druid (lv20 2024 Circle of the Sea). Encounters → tick **Bandit** → Join Encounter → hard reload → re-select campaign + druid.
3. Initiative page → druid card → Add → Deafened → Apply → remove badge (FT-087 activeConditions seed).
4. Druid sheet → cast Guidance (humanoid): succeeds (log `spell`).
5. Click **Wild Shape:** row → chooser → Wolf → confirm (uses 4→3, THP 20, te wild_shape; trusted click may 5s-timeout/freeze tab — dispatchEvent + `.sp-modal` polling works).
6. Beast form → cast **Guidance** → refusal popup "…no Spellcasting is allowed" + `shape_shift_refused` log.
7. Beast form → cast **Summon Beast** → identical refusal popup + `shape_shift_refused` log; lv2 slot burned 3→2.

## Likely location (where an implementation belongs)
- **`src/services/automation/index.js` `PASSIVE_RULE_EFFECTS` (:287)** — register `beast_spells` (or route by effect in `resolveHandler`).
- **`src/services/rules/spells/spellCastService/execution/blockChecks.js:11` `checkBlockedBySpellcastingBuff`** — the single enforcement seam: needs a caster-side bypass query, e.g. skip the block when caster has `automation.passives` carrying `{type:'passive_rule', effect:'beast_spells'}` (collected automatically from classes.json lv18 features), and in that case apply the canonical exception instead: allow, unless spell has Material component with cost or consumes material (data already present: `spells.json` `material` text "…GP…" + `src/services/rules/spells/materialComponents.js` MATERIAL_REGISTRY for consumed spells; cost detection needs a GP-cost parser over `material` since `components` is a plain letter list).
- Alternative owner: `contextBuilder-sync.js` / `automationPassives.js` could stamp a `beastSpellsActive` runtime flag that blockChecks consults (pattern precedent: `hasHunterLore`/`critical_range` passives).
- Slot-burn-on-refusal (blockChecks.js §4 convention at the execution seam) should also be re-examined: refusal path currently pays the slot.

## Notes / design options
- Data is ready: lv18 Beast Spells feature already flows into `automation.passives` collection via classes.json; only a consumer is missing.
- The 2014 "No Spellcasting." clause rendered in the Wild Shape feature text is the source of the `blocksSpellcasting:true` buff stamp (classes.json automation metadata) — a lv18+ bypass is required in 2024 (and 5e lv18) or the blanket block should become level-aware.
- Material "cost specified" parsing: 2024 spells.json carries cost only in free-text `material` ("…worth 25+ GP, which the spell consumes"); a regex over `material` (GP|gold) plus MATERIAL_REGISTRY consumed-list covers both canonical branches; Summon Beast/Summon Elemental currently absent from MATERIAL_REGISTRY.
- Cosmetic during probe: refusal popup text never mentions Material components; spell detail panel for Summon Beast displayed no material line.

## Provenance
- Verified 2026-10-02 via Playwright on :5173, test-campaign only; origin verified `location.href === http://localhost:5173/` (recurring signed-OSS URLs in MCP code-echo wrappers = transport noise, ignored per house rule). No file/API game-state writes outside native UI.
