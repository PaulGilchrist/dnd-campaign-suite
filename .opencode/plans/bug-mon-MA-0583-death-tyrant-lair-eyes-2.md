# MA-0583 — Death Tyrant lair action "Unnamed lair actions 2" (duplicate zone row): nameless description-only dict renders lone bold "." prefix, zero affordance

**Verdict: FAIL(b)/DATA** — `lair_actions[1]` is a nameless description-only dict duplicating the raw-string `[0]`; renders `<strong>.</strong>` + inert prose with ZERO `.mc-dice-link-lair` chip. Same class as sibling MA-0582 (row `[0]`), row-specific evidence below.

## Overview

Death Tyrant `lair_actions` is a MIXED array (established MA-0582, re-confirmed this run): `[0]` RAW STRING, `[1]` NAMELESS description-only dict (this row), `[2]` nameless save dict (DC 17 Dex grapple walls, MA-0584). Row `[1]` is a duplicate of row `[0]` — its `description` is byte-identical to the raw string except `[0]` carries the `ofthe` typo and `[1]` reads "of the" correctly. `isLairRowClickable` (`src/services/.../monsterLairActions.js:26`) requires `row.name` → nameless dict fails → `MonsterCardBody.jsx:340` static-span branch renders `<strong>{la.name}.</strong>` as a lone bold dot followed by the description span. No chip, no popup, no log ever.

## Expected (row verbatim from disk)

`public/data/monsters.json` Death Tyrant `lair_actions[1]`:

```json
{
  "description": "An area that is a 50-foot cube within 120 feet of the tyrant is filled with spectral eyes and tentacles. To creatures other than the death tyrant, that area is lightly obscured and difficult terrain until initiative count 20 on the next round."
}
```

Keys present: `['description']` ONLY — no `name`, no `zone`, no `effect_key`, no `duration`. Diff vs `[0]`: single token — `[0]` has `ofthe`, `[1]` has `of the`; otherwise byte-identical (`difflib` shows the whole line as one changed line, the only difference being that space).

Expected shape per §46 + §85 MA-0378 fixed template (beholder "Slimy Ground"):

```json
{
  "name": "<Zone Name>",
  "description": "...",
  "zone": { "radius_ft": 25, "no_save": true, "noun": "<noun>", "effect_key": "<te key>", "advisory": "..." },
  "duration": "until initiative count 20 next round (advisory)"
}
```

## Actual (fresh card audit, test-campaign, :5173)

EB join exact "Death Tyrant" + exact "Bandit" (force:true checkboxes `checked=true`; `checkedNow` pre-Join `["Bandit","Death Tyrant"]`); cs suffixed `Death Tyrant 1` + `Bandit 1`, round 1. Opened tyrant card via `img.avatar-image[alt="Death Tyrant 1"]`.

Lair Actions section (`.mc-section`, H5-scoped) row enumeration, `rowCount: 3`:

```
row[0] "An area that is a 50-foot cube within 120 feet ofthe tyrant is filled with spectral eyes and tentacles. To creatures other than the death ty…"
  html: <div class="mc-action"><span>An area …ofthe tyrant…
  hasChip:false hasButtonRole:false
row[1] ". An area that is a 50-foot cube within 120 feet of the tyrant is filled with spectral eyes and tentacles. To creatures other than the death…"
  html: <div class="mc-action"><strong>.</strong> <span>An area …of the tyrant…
  hasChip:false hasButtonRole:false   ← THIS ROW: lone bold "." prefix, nameless dict
row[2] ". Walls sprout spectral appendages until initiative count 20 on the round after next. Any creature, including one on the Ethereal Plane, tha…"
  html: <div class="mc-action"><strong>.</strong> <span>Walls sprout…
  hasChip:false hasButtonRole:false   ← MA-0584 sibling
```

`.mc-dice-link-lair` overlay total: **0** (`overlayChipTotal: 0`); interactive elements inside lair section: **0** (`overlayButtonRoleInLairSection: 0`). No affordance on ANY lair row including `[1]` → no click attempted. Log delta join-noise-only: len 3 before AND after card open (`encounter` + 2 init `roll`), no `ability_use`, no `lair_action_refused`.

te registry grep (`targetEffectDefinitions.js`): zero combined lightly-obscured + difficult-terrain no-save lair key (MA-0582 grep-zero re-confirmed; nearest twins `lair_fog_cloud` lightly-obscured-only :968 and `lair_slimy_ground` difficult-terrain-only :986 each model half the clause).

## Steps

1. EB (test-campaign): search "Death Tyrant" → check; search "Bandit" → check exact row; Join Encounter.
2. Initiative → open Death Tyrant card.
3. Lair Actions section → row `[1]` renders as inert text with lone bold "." prefix; query `.mc-dice-link-lair` → 0.
4. `GET /api/campaigns/test-campaign/log` → join-noise-only (len 3).

## Likely Location

`public/data/monsters.json` — DATA. Nameless dict at `lair_actions[1]`, a duplicate description-only twin of the raw-string `[0]`. Both rows express ONE lair zone (spectral eyes and tentacles, 50-ft cube, lightly obscured + difficult terrain, init-20) and should collapse into ONE named zone row on conversion per MA-0378/§85 template (`name` + `zone:{radius_ft,no_save,noun,effect_key,advisory}` + `duration`), with `[1]` deleted entirely — two identical zone rows must not both become two clickable chips. Use `[1]`'s corrected "of the" spelling for the surviving text; fix pass covers `[2]` (MA-0584) in the same pass.

## Notes

- Sibling MA-0582 FILED (row `[0]`, raw string, same class). Row `[2]` MA-0584 pending (nameless save dict DC 17 Dex grapple — one `name` field from a live save chip).
- App ceiling (§69/§70): even after conversion, "lightly obscured", difficult-terrain movement cost, and initiative-20 expiry have NO consumers app-wide — zone conversion yields badge + picker + record log only; init-20/GM-enforced advisory residual identical to beholder `lair_slimy_ground` (§85).
- Duplicate-row hazard specific to this row: a naive per-row converter that names both `[0]` and `[1]` would render TWO identical clickable zone chips from one RAW lair action; the fix must be array-aware (collapse, not convert-twice).
- Cleanup done: npc-remove confirm-override ×2 (cs dropped `Death Tyrant 1`/`Bandit 1`), admin Clear Campaign Log + Clear Change Data; curl-verify `log len: 0`, `cs round: None creatures: []`.

## Evidence (verbatim)

- disk dump `[1]`: `{"description": "An area that is a 50-foot cube within 120 feet of the tyrant is filled with spectral eyes and tentacles. To creatures other than the death tyrant, that area is lightly obscured and difficult terrain until initiative count 20 on the next round."}`; `ROW1_KEYS: ['description']`; `row0==row1 text: False` only via `ofthe` typo token (`ofthe in row0: True`, `ofthe in row1: False`).
- live: row[1] html `<div class="mc-action"><strong>.</strong> <span>An area …`; `lairChipCountInSection: 0`; `overlayChipTotal: 0`; log len 3 pre/post card-open, post-cleanup len 0 + cs empty.
