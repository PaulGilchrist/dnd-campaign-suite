# MA-0595 — Demilich lair action "Unnamed lair actions 2" (antimagic field on target, moves with it): raw-string row renders zero affordance; antimagic-from-monster mechanic unbuilt app-wide

**Verdict: FAIL(b)/DATA** — `lair_actions[1]` is a RAW STRING (MA-0582 twin fingerprint): fails `isLairRowClickable`'s `typeof` guard (`src/services/encounters/monsterLairActions.js:26`), renders a bare inert `<span>` with ZERO `.mc-dice-link-lair` chip, zero popups, zero log delta on fresh-rect click. Deeper ceiling than MA-0582: even after the known zone-dict conversion, there is NO registered antimagic lair te and NO consumer for a monster-granted antimagic field — and RAW "moving with it" (attached-to-target movement) has zero consumers (§70 grid-token-move advisory family).

## Overview

Demilich `lair_actions` is the same MIXED array documented in MA-0594: `[0]` nameless save dict (MA-0594, DC 19 Dex prone), `[1]` RAW STRING antimagic field (this row), `[2]` RAW STRING no-healing (separate sibling). Row [1] is byte-shape-identical in kind to Death Tyrant `lair_actions[0]` (MA-0582): a plain string that the renderer can never arm. Unlike MA-0582's obscured/difficult-terrain zone (where a new `lair_spectral_eyes` te + §85 zone conversion is a known full fix), this row's mechanic — an antimagic field ON A TARGET that MOVES with it — has no producing seam anywhere in the app.

## Expected (RAW row, verbatim from disk)

`public/data/monsters.json` Demilich `lair_actions[1]`:

```json
"The demilich targets one creature it can see within 60 feet of it. An antimagic field fills the space of the target, moving with it until initiative count 20 on the next round."
```

Type: `str` (no dict). Keys: N/A — there is no `name`, no `zone`, no `save_dc`, no `automation` block; per §46 raw-string lair rows are inert by construction.

Expected affordance if converted per §46/§85 (MA-0378 zone-dict template) would be: `{name, description, zone:{radius_ft,no_save,noun,effect_key,advisory}, duration}` → `span.mc-dice-link-lair[role=button]` → zoneOnly picker → arms registered Lair-group te + record log. That template is NOT applicable here without new mechanics (see Likely Location / Notes).

## Actual (fresh evidence, test-campaign, :5173)

**Static (STEP 1):** disk dump above; `lair_actions` element types `[dict, str, str]` — row[1] confirmed raw string, description byte-matches manifest row MA-0595 verbatim.

`rg -i "antimagic" src/` is NOT grep-zero — 33 files hit — but ALL consumers are PC-cast seams for the `antimagic_field` te:
- `src/services/combat/conditions/targetEffectDefinitions.js:500` — te `antimagic_field`, **group `'Spells'` (not Lair)**, fields `['source']`.
- PRODUCER: `src/services/automation/handlers/spells/antimagicFieldHandler.js` only (`{ ...auto, effect: 'antimagic_field' }`:21) — registered in `automation/index.js` as `antimagic_field` and gated by `hooks/combat/spellGates.js` `'antimagic field'` spell gate + metamagic pending flows. This fires when a PC casts Antimagic Field.
- CONSUMERS: `automation/contextBuilder-sync.js` (blocks non-weapon attacks when attacker-or-target carries the te), `initiative/ConditionEffectBadges.jsx` (badge), `char-sheet/useInitiativeEffects` clearing, `rules/effects/restRules-shortRest.js` cleanup.
- **`rg -in "antimagic" src/services/encounters/` = grep-zero; monster card components = grep-zero.** No monster/lair producer path exists: no `effect_key: 'antimagic_field'` lair precedent, no `hit_target_effect` producer wired for lair rows to this te, and the te is keyed to a STATIC area (`range: spell.range || 'Self (10-foot radius)'` in spellGates) — the RAW field here is target-attached and MOVES.

**Live (STEP 2):** campaign header verified `test-campaign`; EB joined exact "Demilich" + exact "Bandit" (Bandit checkbox required 3 attempts incl. aria-label click per §152/§153; cs verified `Demilich 1` hp180 init25 + `Bandit 1` hp11 init16 + lv-placeholder PCs, §93/§128). URL-bar nav to /initiative deselected campaign (§95) — re-selected, nav-button route. Card opened via `img.avatar-image[alt="Demilich 1"]`: AC 20, HP 180 (72d4).

Full `.mc-action` row enumeration (14 rows; lair rows at DOM idx 8/9/10 = `lair_actions[0]/[1]/[2]`):

```
idx 8  strong="."       → MA-0594 nameless save dict, inert (twin, already ticketed)
idx 9  strong=null      → THIS ROW. innerHTML: <span>The demilich targets one creature it can see within 60 feet of it. An antimagic field fills the space of the target, moving with it until initiative count 20 on the next round.</span>
idx 10 strong=null      → raw-string no-healing sibling
```

- Row[1]: firstChild `SPAN`, `kids: 0` (zero a/button/[role=button] descendants), `spans: []` (no `mc-dice*` classes), textLen 176. Pure inert raw text — even the MA-0594 lone-bold-"." prefix is absent (that's the nameless-DICT fingerprint; raw strings render bare).
- `span.mc-dice-link-lair` count in whole overlay: **0**.
- Fresh-rect click at center (858, 368.5; scrollIntoView'd, fresh getBoundingClientRect immediately before click): `popups: 0`, `cardOpen: true`, chips still 0 — truly inert, nothing to absorb.
- Campaign log: len **3** before and after — `encounter` + 2 `roll` join-noise baseline (§131/§146). Zero delta: no `ability_use`, no `lair_action_refused` (refusal path upstream-blocked by the string guard), no save/hp_change entries.

## Steps

1. Confirm campaign header `test-campaign`; EB join exact Demilich + exact Bandit; initiative board shows `Demilich 1` + `Bandit 1`.
2. Open Demilich card → Lair Actions section → row[1] renders as bare inert span (no bold prefix, no chip); query `.mc-dice-link-lair` → 0.
3. Click row[1] at fresh rect → nothing: no popup, no log delta.
4. `GET /api/campaigns/test-campaign/log` → len 3, join-noise-only.

## Likely Location

`public/data/monsters.json` — DATA fix, but the fix is DEEPER than a field-add. Three-layer gap:

1. **Row shape (MA-0582 twin, one-row fix):** convert raw string to §46/§85 structured dict with `name` (e.g. "Antimagic Shroud") so `isLairRowClickable` (`monsterLairActions.js:26` `typeof row !== 'object' || !row.name` → false) arms any affordance at all. Anchor on monster-unique "antimagic field fills the space of the target" (§22).
2. **No suitable te (§36):** §85 Lair-group registered keys are `lair_darkness/lair_fog_cloud/lair_spike_growth/lair_slimy_ground/lair_mud/lair_insect_cloud/lair_sand_cloud/lair_volcanic_gas/lair_dream_plane` — NO antimagic lair key exists. Reusing PC `antimagic_field` (group 'Spells', targetEffectDefinitions.js:500) from a monster lair row has no producer seam and no precedent; a new Lair-group registration (e.g. `lair_antimagic_field`) + fields-whitelist test update is required.
3. **No monster-grant consumer:** the only `antimagic_field` producer is `antimagicFieldHandler.js` via the PC spell-cast automation gate (`spellGates.js` 'antimagic field'); `src/services/encounters/` is grep-zero for antimagic. The zone picker arms te on a STATIC area; the attack-block consumer (`contextBuilder-sync.js`) does read `te.target`, so a target-attached te could theoretically block non-weapon attacks against the target — but nothing in the lair row pipeline can grant it, and "moving with it" (attached movement) has no consumer app-wide (§70 grid token move). Honest ceiling even after all three layers: GM-clicked chip arms a record-only te + badge; full suppression adjudication on the affected creature's rolls rides only the existing PC-seam consumer if the te shape matches.

## Notes

- **MA-0582 twin, with lower ceiling:** MA-0582's fix is a pure data conversion because a zone te could at least arm a badge/area record. Here the conversion alone changes nothing mechanically — the raw-string inertness is the SHALLOWEST of three stacked gaps (row shape → missing te → missing producer/consumer). Fold into any lair initiative-20 ticket cluster.
- **"Moving with it" + initiative count 20:** both §70 no-consumer advisories (grid token move, initiative-20/lair-recurring cadence). Even a perfectly authored zone dict expires/anchors GM-enforced (§46/§85 accepted residuals).
- Demilich lair set census: `[0]` nameless save dict = MA-0594 (one `name` field from live); `[1]` THIS ROW (raw string, antimagic); `[2]` raw-string no-healing sibling — note te `no_healing` IS registered with a producer seam (`hit_target_effect`, §113/MA-0556), so [2] is a strictly shallower fix than [1]; separate ticket.
- Rows DOM idx 11–13 (regional effects: entry necrotic damage, charm/fright advantage, teleport ward) are separate raw-string regional-effect rows, outside this ticket.
- Verdict policy §10: inert raw row + zero affordance + unbuilt mechanic = FAIL(b)/DATA; never PASS/incomplete.
- Do NOT relax `monsterLairActions.js:26` gate (keeps ~600 legacy monsters static, MA-0594 note); fix is data (+ te registry §36 if a lair antimagic te is ever sanctioned).
- No src edits made this session; manifest `verified` owned by orchestrator; no git writes.

## Evidence (verbatim command outputs)

- Disk: `lair_actions` types `['dict', 'str', 'str']`; row[1] repr = `"The demilich targets one creature it can see within 60 feet of it. An antimagic field fills the space of the target, moving with it until initiative count 20 on the next round."` (type `str`).
- `rg -i "antimagic" src/`: 33-file PC-seam consumer set (handler/spellGates/metamagic/contextBuilder-sync/badges/restRules/registry@500 group 'Spells'); `rg -in "antimagic" src/services/encounters/` zero hits; lair te keys: 8 `lair_*` + lair_dream_plane, none antimagic.
- Live join: cs `[('Demilich 1',180,'25'),('Bandit 1',11,'16'), …PC placeholders…]`, round 1, active None.
- Live row[1]: `{"firstChild":"SPAN","kids":0,"spans":[],"textLen":176,"html":"<span>The demilich targets one creature it can see within 60 feet of it. An antimagic field fills the space of the target, moving with it until initiative count 20 on the next round.</span>"}`; `lairChipCount: 0`.
- Click (858, 368.5): `{"popups":0,"cardOpen":true,"lairChips":0}`; log len 3 (`encounter`, `roll`, `roll`) before AND after — zero delta.
