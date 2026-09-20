# MA-0594 — Demilich lair action "Unnamed lair actions 1" (tomb trembles, DC 19 Dex prone): nameless save dict with resolvable numeric save renders ZERO affordance — one `name` field from a live save chip

**Verdict: FAIL(b)/DATA** — `lair_actions[0]` carries authored numeric `save_dc:19` + `save_type:"Dexterity"` + prone save prose, yet the name-gate (`monsterLairActions.js:26`) refuses it; renders `<strong>.</strong>` + inert prose, ZERO `.mc-dice-link-lair` chip, no popup, no log delta on fresh-rect click. Fix = single `name` field (named-lair-save template §85 / MA-0378 lineage; twin MA-0584 Death Tyrant "Unnamed lair actions 3", DC 17 Dex walls-grapple).

## Overview

Demilich `lair_actions` is a MIXED array: `[0]` nameless dict with resolvable save (this row), `[1]`/`[2]` raw strings (antimagic field, no-healing — separate rows, separate tickets if any). `isLairRowClickable` (`src/services/encounters/monsterLairActions.js:26`: `if (!row || typeof row !== 'object' || !row.name) return false;`) short-circuits on the missing `name` before `save_dc` is ever consulted; `MonsterCardBody.jsx:340` routes the row to the static-span branch rendering `<strong>{la.name}.</strong>` as a lone bold " ." prefix. MA-0582's hypothesis, confirmed live on Death Tyrant [2] in MA-0584, reproduces byte-shape-identically on the Demilich row.

## Expected (RAW row, verbatim from disk)

`public/data/monsters.json` Demilich `lair_actions[0]`:

```json
{
  "description": "The tomb trembles violently for a moment. Each crea\u00adture on the floor of the tomb must succeed on a DC 19 Dexterity saving throw or be knocked prone.",
  "save_dc": 19,
  "save_type": "Dexterity"
}
```

Keys present: `['description', 'save_dc', 'save_type']`. Missing: `name`, `dc_success`. The U+00AD soft hyphen inside "crea­ture" is cosmetic disk-text noise, NOT a defect.

Expected affordance (template §46/§85/§127; named twins: Beholder "Grasping Walls" DC 15 Dex, Death Tyrant MA-0584 one-name-field twin): with `name`, `lairRowAffordance` returns `'save'` (monsterLairActions.js:42), `MonsterCardBody.jsx:359-370` renders `span.mc-dice-link.mc-dice-link-lair[role=button]` labelled `DC 19 Dexterity`, one click routes `handleLairRow` → `resolveLairRow` → `handleSaveRoll` (authored DC/type enforced; damageless failed-save prone condition via the MA-0017 seam).

## Actual (fresh evidence, test-campaign, :5173)

**Static (STEP 1):** disk dump above; `lair_actions` element types `[dict, str, str]`; `save_dc:19` and `save_type:"Dexterity"` present; NO `name`. Gate: `monsterLairActions.js:26` (`!row.name` → false); static-span branch `MonsterCardBody.jsx:340`; chip render only at `:363` behind the gate.

**Live (STEP 2):** campaign header verified `test-campaign`; initiative carries `Demilich 1` + `Bandit 1` (avatar alts enumerated); card opened (residual open `.mc-overlay` from stalled prior attempt audited directly — Demilich 1, AC 20 confirmed).

Fresh lair-row enumeration (evaluate, full innerText + parent HTML):

```
<div class="mc-action"><strong>.</strong> <span>The tomb trembles violently for a moment. Each crea­ture on the floor of the tomb must succeed on a DC 19 Dexterity saving throw or be knocked prone.</span></div>
```

- Lone bold " ." prefix rendered as predicted; row textLen 149; soft hyphen visible in live DOM.
- `interactiveKids: 0` (zero a/button/[role=button] descendants in row).
- `span.mc-dice-link-lair` count in whole overlay: **0**. All card dice links audited: only attack "+17"/"+11", "20d6", save "-5/+5/+0/+5/+3" ability mods, and 3× `mc-dice-link-save-clickable` "DC 19 Constitution" (the `trapped_soul`/legendary save rows — actions section, NOT lair).
- Fresh-rect click at center (843, 366; viewport 727 — scrollIntoView'd, no clipping): `popups: []`, `cardOpen: true`, chips still 0 — truly inert (no interactive element to absorb).
- Log: len 3 before AND after click — `encounter` + 2 `roll` join-noise baseline (§131); zero delta: no `ability_use`, no `lair_action_refused` (refusal path upstream-blocked by the gate), no save entries, no hp_change.

## Steps

1. Confirm campaign header `test-campaign`; initiative shows `Demilich 1` + `Bandit 1`.
2. Open Demilich card → Lair Actions section → row[0] renders lone bold "." + inert prose; "DC 19 Dexterity" exists only as plain TEXT inside the span; query `.mc-dice-link-lair` → 0.
3. Click row[0] region at fresh rect (scrollIntoView first) → nothing: no popup, no log delta.
4. `GET /api/campaigns/test-campaign/log` → len 3, join-noise-only.

## Likely Location

`public/data/monsters.json` — DATA fix. Demilich `lair_actions[0]` missing the `name` field. One-field fix, anchor on monster-unique "tomb trembles violently" (§22); suggested value "Tomb Trembles" + add `dc_success:"none"` (condition-only save, else MV-20 half-leak on honest copy). §46/§110 nuance: unlike header-swallow rows[1+] (MA-0567) or the row-level `save_dc`-never-renders Spellcasting XOR (MA-0532), here the lair NAME gate itself is the sole blocker — the numeric save is fully resolvable and reaches no renderer only because `name` is absent. Gate context (do NOT relax): `monsterLairActions.js:26` intentionally keeps ~600 legacy monsters static; `MonsterCardBody.jsx:340` mirrors it — defect is purely the missing data field.

**Mechanic ceiling (document honestly, §46/§70):** even named+chipped, the row degrades to a GM-clicked SINGLE-target save approximation:
- RAW "each creature on the floor of the tomb" AoE: no multi-target lair seam; generic save-shell picks one victim (§127 analogue).
- Initiative-count-20 timing and lair-recurring semantics: ZERO consumers app-wide (§46/§69/§70 — advisory residual).
- Prone grant lands via the MA-0017 damageless failed-save condition seam; that is the honest adjudication ceiling.

## Notes

- Soft hyphen U+00AD in disk description = cosmetic, byte-level text noise only; do not ticket, do not gate-fix on it.
- Demilich lair set: rows [1] antimagic field (raw string, init-20 duration) and [2] no-healing (raw string) are MA-0582-class raw-string siblings — same name-gate inertness family (§6 raw-string fingerprint); this ticket covers row [0] only.
- Twin: `.opencode/plans/bug-mon-MA-0584-death-tyrant-lair-walls.md` (MA-0584) — same fingerprint, same one-field fix; MA-0582/0583 filed for the mixed-array siblings.
- 26-row nameless-dict family (per MA-0584 census: Demilich, Kraken, Lich, Mummy Lord, young-dragon rows) rides this same gate; Demilich evidence here is the second live confirmation of the family fingerprint.
- Verdict policy §10: resolvable numeric save mechanic rendered inert + zero affordance = FAIL(b)/DATA, never PASS.
- No te registration needed for the name fix (failed-save condition seam, MA-0017, not te).
