# Bug MA-0658 — Duergar "Invisibility" inert (FAIL(b) / DATA)

**Monster:** Duergar (`duergar`, AC 16) · **Row:** actions[3] "Invisibility", actionType condition · **Campaign:** test-campaign (header-verified) · **Date:** 2026-09-20

## Expected (canonical, disk description verbatim)
> "The duergar magically turns invisible until it attacks, casts a spell, or uses its Enlarge, or until its concentration is broken, up to 1 hour (as if concentrating on a spell). Any equipment the duergar wears or carries is invisible with it."

Payoff expected live: row fires → self Invisible condition on the duergar for up to 1 hour (concentration-style), enders on attack/cast/Enlarge/concentration break.

## Actual — affordance audit
Disk row carries ONLY `description` + `usage:{type:"recharge after rest",rest_types:["short","long"]}`. No `automation`, no numeric fields, no condition-grant structure. Manifest `conditions:[invisible]` is manifest metadata only — §114: te pre-registered ≠ monster producer (and here no invisibility te is even registered).
- Card DOM audit (Duergar 1 `.mc-overlay`, EB join, cs idx 0, HP 26/26, init 3): Invisibility row renders `<strong>Invisibility.</strong>` + plain prose. **Interactive elements in row: 0** (no `a`, `button`, `[role=button]`, `.mc-dice-link*`, no chip). Document-wide toggle audit (`[role=switch]/radiogroup/tablist`): 0 (§147/§163).
- Click-probe on row prose (fresh rect, in-viewport): **zero popups** (`.popup-overlay`/`.sp-modal`/`.dsp-overlay`/`.ea-overlay` all absent), card stayed open, **zero log delta** (log held at 2 join entries: `encounter` + `roll Initiative`). No `ability_use`, no `invisib*`, no `automation`, no `*_refused`.
- State probe: change-data top-level has NO `targetEffects`/`expirations`/invisib* keys; cs `Duergar 1` entry has NO `conditions`/`activeConditions` keys. Zero state written.
- §60/§114 renderer fingerprint confirmed in source: `MonsterAction.jsx` arms chips solely off `attack_bonus` (:211), rollable damage dice (:41-45), numeric `save_dc` (:88-89), Spellcasting markup (:202/:217), `automation.effect`-keyed gated reaction (:138-141), legendary gate (:161-172), zone dict self-aura (:179-190). A description+usage-only row arms **nothing**. No `actionType` consumer exists in MonsterAction.jsx/MonsterCardModal.jsx (grep).

## Grep — monster-side self-condition/invisibility producer: GREP-ZERO
- `self_target`, `grantCondition`, `self_condition` in src/+server/: **zero matches**.
- te registry `targetEffectDefinitions.js`: 114 effect keys, **zero** invisibility/cloak/hide/stealth te (sole text hits are forcecage/faerie_fire descriptions mentioning the word "invisible").
- All invisibility machinery is **PC-side**: `automation/handlers/buffs/invisibilityHandler.js`, `greaterInvisibilityHandler.js`, `invisibilityShared.js`, `rules/features/invisibilityService.js`, `concentrationService.js` (`_activeInvisibility_` caster flags) — PC spell-cast/buff routes only, no monster-row entry point.
- `monsterLegendaryUses.js:245-266` (Dragon Cloaked Flight): monster self-invisibility explicitly documented as **advisory/GM-enforced — "no invisibility/movement-distance consumer" (CLA-325)** — the sanctioned precedent that this capability is unbuilt app-wide.
- `"recharge after rest"` usage is NOT the d6 recharge shape (`monsterRecharge.js:33`, test-pinned MA-0655 §: gate null) → cosmetic usage text at most, economy never engages (§61/§162/§187/§544).

## Twin fingerprints
- **MA-0655 Enlarge (SAME monster, verified TODAY):** byte-same disk shape (description+usage only), zero affordance, click zero popup/log, recharge-after-rest test-pinned null — `.opencode/plans/bug-MA-0655-enlarge.md`.
- **MA-0648/MA-0651:** automation-less no-affordance rows arm zero chips; usage renders cosmetic only.
- **§60:** monster no-affordance rows are inert unless `{type,trigger,effect}` automation authored.

## Steps to reproduce
1. `test-campaign`, Encounters → search "Duergar" → checkbox → Join Encounter (lands cs idx 0, "Duergar 1", init 3).
2. Open card (`img.avatar-image[alt="Duergar 1"]`) → Invisibility row = prose only, zero interactive elements (§27, §116 renderer keys disk fields only).
3. Click row prose → nothing: zero popup, zero log delta, zero state written.

## GM Add-modal note (§76)
CONDITION display side NOT probed this session (§76 Add-modal rig is unrelated machinery — row automation verdict does not depend on it; logged unused to keep session minimal).

## Likely location
- Renderer: `src/components/encounter/MonsterAction.jsx` — every chip arms off numeric/markup/automation/zone fields; condition-only row arms nothing.
- Producer: none exists — grep-zero app-wide.

## Fix options
1. **Self-condition automation + te consumer:** author `automation:{type:"self_condition", effect:"invisible", duration:"1 hour", enders:["attack","cast","enlarge"]}` on the row + register te `invisible` in `targetEffectDefinitions.js` + new producer in the monster-row dispatcher granting on self with ONE `addExpiration` clock **`rounds:600`** (1 hour × 600, §37 clock pattern; hours×600 analog acceptable; no anchor leg for long buffs §38; single merged write §39).
2. **Spell-linkage:** route the row to the 5e Invisibility spell reusing the live PC machinery (`invisibilityHandler.js:89/127` grants invisible + starts concentration) via a monster-spell-link seam — needs a new row-level spell-link field + wiring (SpellCastLinks today only parses Spellcasting-row markup, MonsterAction.jsx:202).
3. **Enders = design ticket (§70-class):** attack-ender, cast-ender, Enlarge-ender and concentration-break on a MONSTER self-state are sustained-state-machine territory — zero consumers app-wide (concentrationService flags are PC-caster-scoped; §70 no-consumer list incl. sustained states/rest-rearm). Needs design: hit-resolution + spell-cast hook + enlarge-hook consulting attacker's own `invisible` te and dropping it with a log entry.
4. **Rest-economy:** "recharge after rest" spend/regain currently ungated-by-design (test-pinned null, MA-0655); an authored automation row needs `monsterSpellUses`-style spend keys + rest-rearm — §70 advisory residual.

## Cleanup verified
Admin clear change-data + log → 200/200; GET log `[]`; combatSummary `{value:null}`; browser tab closed (no resurrection window §15).

## Verdict
**FAIL(b) — inert, grep-zero producer, zero affordance.** DATA fix required (self_condition automation dict + registered `invisible` te + rounds:600 clock + ender design §70-class), else design ticket.
