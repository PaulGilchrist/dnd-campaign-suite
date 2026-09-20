# MA-0582 — Death Tyrant lair action "Unnamed lair actions 1" (lightly obscured / difficult terrain zone): raw-string row renders zero affordance

**Verdict: FAIL(b)/DATA** — bare-string lair row renders inert text with ZERO `.mc-dice-link-lair` chip; §85 MA-0378 fixed-shape conversion is the known fix.

## Overview

Death Tyrant `lair_actions[0]` in `public/data/monsters.json` is a RAW STRING. Per §46 and the live-gated renderer (`MonsterCardBody.jsx` → `MonsterLairAction`), legacy plain-string rows and nameless dicts never become clickable (`monsterLairActions.js` `isLairRowClickable` returns false for non-objects and objects without `name`). The card therefore shows the spectral-eyes/tentacles zone clause as inert prose with no chip, no popup, no log — the exact MA-0378 (beholder) pre-fix fingerprint. Beholder's lair row was fixed via the MA-0043 save-less zone-dict conversion (§85); Death Tyrant's sibling rows were never converted.

## Expected (RAW row, verbatim from disk)

`public/data/monsters.json` Death Tyrant `lair_actions[0]`:

```json
"An area that is a 50-foot cube within 120 feet ofthe tyrant is filled with spectral eyes and tentacles. To creatures other than the death tyrant, that area is lightly obscured and difficult terrain until initiative count 20 on the next round."
```

Manifest row: `{"id":"MA-0582","stableKey":"death-tyrant|lair_actions|0","actionName":"Unnamed lair actions 1","category":"lair_actions","actionType":"other","verified":"not verified"}` (description byte-matches the raw string, including the `ofthe` typo).

§46 clickable shape + §85 MA-0378 fixed twin (`lair_actions[0]` "Slimy Ground", live-verified fixed pass):

```json
{
  "name": "Slimy Ground",
  "description": "...",
  "zone": { "radius_ft": 25, "no_save": true, "noun": "slimy ground", "effect_key": "lair_slimy_ground", "advisory": "..." },
  "duration": "until initiative count 20 next round (advisory)"
}
```

Expected post-fix: `name` + `zone:{radius_ft,no_save,noun,effect_key,advisory}` + `duration` row → `.mc-dice-link-lair` chip → zoneOnly area picker (`MonsterCardModal.jsx:55/91/1768-1785`, `handleLairZone`) → arms registered te + record log.

## Actual

**Disk (STEP 1):** lair_actions is a MIXED array: `[0]` RAW STRING (MA-0582), `[1]` nameless description-only dict duplicating `[0]` text (MA-0583), `[2]` nameless save dict, DC 17 Dex grapple walls (MA-0584). NONE has `name` → all three fail `isLairRowClickable` (`monsterLairActions.js:26`: `!row.name` → false; strings fail the `typeof` guard). No `zone` key anywhere on the tyrant's rows.

**te registry grep:** `targetEffectDefinitions.js` Lair group (lines ~928-1009) contains `lair_darkness`, `lair_fog_cloud` (lightly obscured), `lair_spike_growth` (difficult terrain), `lair_slimy_ground` (difficult terrain, beholder §85 twin), `lair_mud`, `lair_insect_cloud`, `lair_sand_cloud`, `lair_volcanic_gas`, `lair_dream_plane`. NO combined lightly-obscured + difficult-terrain key for spectral eyes/tentacles — grep-zero for any `lair_spectral*` key.

**Renderer:** `MonsterCardBody.jsx:340` — `typeof la === 'string' || !isLairRowClickable(la)` → static `<span>` branch, no chip, no `role=button`. Nameless dict rows render `<strong>{la.name}.</strong>` as a lone bold dot.

**Live (STEP 2, test-campaign, :5173):** EB join exact "Death Tyrant" + exact "Bandit" (force-clicked checkboxes, `checked=true`, clip y≈865 §26); cs shows suffixed `Death Tyrant 1` + `Bandit 1` (§128). Opened tyrant card (`img.avatar-image[alt="Death Tyrant 1"]` → `.mc-overlay`). Lair Actions section renders 3 inert rows:

```
Lair Actions
An area that is a 50-foot cube within 120 feet ofthe tyrant ... initiative count 20 on the next round.
. An area that is a 50-foot cube within 120 feet of the tyrant ... initiative count 20 on the next round.
. Walls sprout spectral appendages until initiative count 20 on the round after next. ... DC 17 Dexterity saving throw or be grappled ...
```

Row 1 = raw string verbatim (`ofthe` typo proves raw provenance); rows 2/3 = lone bold dot + description (nameless dicts). **`.mc-dice-link-lair` chip count in overlay: 0.** Zero affordance → no chip click attempted/possible; campaign log stayed join-noise-only (`encounter` + 2 init `roll` entries, baseline §131/§146) — no `ability_use`, no `lair_action_refused`, no popup.

## Steps

1. EB (test-campaign): search "Death Tyrant", check row; search "Bandit", check exact row; Join Encounter.
2. Initiative page → open Death Tyrant card.
3. Scroll to Lair Actions section → observe inert prose; query `span.mc-dice-link-lair` → 0 results.
4. `GET /api/campaigns/test-campaign/log` → join-noise-only.

## Likely Location

`public/data/monsters.json` — DATA fix. Convert `lair_actions[0]` bare string to the MA-0378/§46 zone-dict template (`name`, `zone:{radius_ft,no_save,noun,effect_key,advisory}`, `duration`). Anchor on monster-unique "spectral eyes and tentacles" + `ofthe` typo (§22 prose anchors not monster-unique; JSON.parse + git diff after). Square→radius: 50-ft cube modeled as ~25-ft radius picker like beholder's Slimy Ground. te decision: register a new Lair-group key (e.g. `lair_spectral_eyes`) covering BOTH lightly obscured AND difficult terrain — nearest registered twins `lair_fog_cloud` / `lair_slimy_ground` each model only half the clause; registration + fields-whitelist test update required (§36).

## Notes

- **App ceiling (honest residual):** even after conversion the mechanic is advisory-record-only. Light/vision levels and grid token movement (difficult-terrain movement cost) have NO consumers, and initiative-20/lair-recurring cadence has NO consumer app-wide (§46/§69/§70; grep confirms initiative-20 hits are comments only in `monsterLairActions.js`/`saveProcessing.js`). The te can arm a badge + picker, but "lightly obscured", "difficult terrain", and the init-20 expiry stay GM-enforced — same accepted residual as beholder `lair_slimy_ground` (§85). Still FAIL per instructions: number/effect inert + zero affordance today, fix shape known via MA-0378 precedent.
- Data defect is a TRIPLE: `[0]` raw string (MA-0582), `[1]` nameless duplicate description-only dict (MA-0583), `[2]` nameless save dict with authored DC 17 Dex grapple (MA-0584). `[2]` even carries a resolvable save mechanic that the renderer refuses to arm solely because `name` is missing (`isLairRowClickable:26`) — one `name` field away from a live save chip; fix all three rows in one pass.
- Fix pass should also correct the `ofthe` typo in whatever text survives conversion.
- Death Tyrant siblings OPEN: MA-0577 (Multiattack), MA-0579 (Eye Rays — §154 VAR-shell fingerprint), MA-0580 (Chomp), MA-0581 (Glare) — all "broken" in manifest; MA-0578 (Bite) verified.
- Live twin comparison was static-only (no Beholder joined this session); beholder `lair_actions[0]` structured dict on disk + live zoneOnly picker consumers (`MonsterCardModal.jsx:1768`) constitute the positive-control evidence.

## Evidence (verbatim command outputs)

- monsters.json dump: `[0]` = raw string `"An area that is a 50-foot cube within 120 feet ofthe tyrant is filled with spectral eyes and tentacles. To creatures other than the death tyrant, that area is lightly obscured and difficult terrain until initiative count 20 on the next round."`; `[1]` = `{"description": "...of the tyrant..."}`; `[2]` = save dict DC 17 Dexterity.
- te grep: no lightly-obscured+difficult-terrain combined key; `lair_spike_growth`/`lair_slimy_ground`/`lair_mud` present (registered §85 twins).
- Live card audit: `lairChipCount: 0`, `chips: []`, `hasLairSection: true`; log len 3 (join noise) before and after card open.
