# Bug MA-0673 — Elemental Cataclysm "Cataclysmic Event" (actions[2]) — VAR-shell mis-adjudication, no 1d4 variant chooser

## Verdict
VERIFIED: FAIL — class (a)+(b) hybrid: row fires a generic MA-0031/§50 VAR save-shell picker that invents a hybrid "60-ft Cone", pools a wrong multi-type 13d6, and over-grants four conditions from cross-event prose; ZERO of the four canonical events is adjudicated; the 1d4 random-event chooser has no producer anywhere.

## Automation under test
- ID: MA-0673, Monster: Elemental Cataclysm (`elemental-cataclysm`, CR 22)
- Row: actions[2] "Cataclysmic Event", aoe-save
- Canonical: roll 1d4 → one of FOUR <strong>-marked sub-events:
  1. Clinging Flames — Dex DC23, 60-ft-radius Sphere ≤150 ft, fail 45 (13d6) fire / half; Failure or Success: target starts burning.
  2. Freezing Waves — Str DC23, 90-ft Cone, fail 22 (5d8) bludgeoning + 22 (5d8) cold + Prone / half; Failure or Success: Speed 0 until end of next turn.
  3. Raging Storm — 60-ft-radius Sphere cloud ≤150 ft, 1 minute; Blinded+Deafened+no-verbal inside; Dex DC23 enter-first/turn-start 18 (4d8) lightning + 18 (4d8) thunder / half.
  4. Swallowing Earth — Str DC23, 90-ft Cube ≤150 ft, fail 18 (4d8) bludgeoning + 18 (4d8) acid + Prone + buried (Restrained/Total Cover/suffocate); DC18 Athletics escape action; half on success.

## Disk state (public/data/monsters.json, elemental-cataclysm.actions[2])
- `name`, full-markup `description`, `save_dc: 23`, `save_type: "See description"`, `save_effect` multi-event prose summary.
- NO `rays[]`-style structured rows (§88 picker precondition), NO row-level range/shape field, NO automation dict, NO per-event sub-dicts. Byte-shape authoring template = MA-0374/0383 (§88).

## Live evidence (test-campaign, :5173, 2026-09-20)
- EB-joined `Elemental Cataclysm 1` (cs idx 0, init 33) + `Bandit 1` (cs idx 1, AC12, resistances []); Bandit maxHp 999 dual-stamped full-store cs POST (§119/§120/§181). Header verified test-campaign; campaign-lock lockdown respected; injection re-confirmed: navigate/type/click tool ARGS echoed off-site aliyuncs proxy URL, page self-verified localhost:5173 throughout (§90/§97).
- Row surface rendered = GENERIC SINGLE-SAVE SHELL riding the MA-0590 AoE-picker seam. DOM audit of `.mc-action` row: TWO chips — `span.mc-dice-link` "13d6" + `span.mc-dice-link-save.mc-dice-link-save-clickable` "DC 23 See description"; buttons 0, selects 0, inputs 0, role=button 2 (= the two chips). All 17 sub-event `<strong>` markers (Clinging Flames./Freezing Waves./Raging Storm./Swallowing Earth./Sphere/Cone/Cube/Prone/Restrained/…) render as INERT text — zero clickable event affordance (§57: mid-prose emphasis is decoy, §158 fake-chip pattern extends to event names). Whole-overlay `[role=switch]/radiogroup/tablist/radio` = 0 = no chooser (§147/§190).
- Click probe "DC 23 See description" (Bandit 1 armed on EC OWN initiative-card target-select, fresh rect §28/§148/§149): opened SaveAttackAoeModal `.sp-modal` titled **"60-ft Cone (GM positions tokens; selection advisory)"** — HYBRID shape fabricated by description-regex scrape (radius "60-foot" harvested from Clinging Flames Sphere, shape "Cone" harvested from Freezing Waves — MonsterCardModal.jsx:43/91/375; canonical shapes are 60-ft Sphere / 90-ft Cone / 90-ft Sphere / 90-ft Cube — none matches). Body: "Each must make a **See description** saving throw (DC 23). On a failed save, target takes **13d6 Acid/Bludgeoning/Cold/Fire/Lightning/Thunder** damage" — §50 fingerprint: save_type "See description" printed verbatim, all six damage types pooled onto one 13d6 formula (event-1 dice only, wrong type label).
- Adjudication (confirm, 1 selected target): results `.sp-modal` "Bandit 1: Failed — takes 47 … damage (rolled 18)". Log machine-truth: `ability_use` "Cataclysmic Event: Selecting 1 target(s) for save (DC 23 See description)"; ONE `roll` rollType save-damage formula 13d6 total 47, saveType "See description", saveDc 23, dcSuccess "half", saveResult failure, saveRoll 18, mode normal, finalDamage 47; `hp_change` -47 == finalDamage exact (§140/§181 unclamped maxHp999). **Zero d4 rolls in whole log; zero event-name entries; no 1d4 picker stage** (§107: random-rider chooser absent — MA-0575 template needed).
- Condition over-grant: one `condition` entry on Bandit 1 "Blinded, Deafened, Prone, Restrained" (sourceAbility Cataclysmic Event, 1 minute repeat-save, GM-enforced note) + change-data `activeConditions` = all four, `activeConditionMeta.*.ability: "see"` (§117 extractor over-grant sharpened: scrape harvests conditions from ALL four sub-events and stamps the nonsense save ability "see"). No "burning"/buried/Total Cover/suffocating/Speed-0 states — zero producers app-wide.

## Per-event adjudication status
| Event | DC/type | Dice | Shape | Conditions | Status |
|---|---|---|---|---|---|
| 1 Clinging Flames | Dex | 13d6 fire | 60-ft Sphere | burning (both outcomes) | NOT adjudicated — dice count coincidentally 13d6 but type multi-label, shape Cone not Sphere, save type "see", no burning te (§157 marker missing in save_effect) |
| 2 Freezing Waves | Str | 5d8+5d8 B/C + Prone | 90-ft Cone | Speed 0 to EOT | NOT adjudicated — never selectable; Prone sprayed cross-event unconditionally on any fail |
| 3 Raging Storm | Dex turn-start | 4d8+4d8 L/T | 60-ft Sphere cloud, 1 min zone | Blinded+Deafened ambient, no-verbal | NOT adjudicated — no zone/cloud object, no enter/turn-start recurring save (§70/§87 recurring zero-consumer); Blinded/Deafened granted as one-shot fail-conditions |
| 4 Swallowing Earth | Str | 4d8+4d8 B/A + Prone + buried | 90-ft Cube | Restrained/Total Cover/suffocate, DC18 Athletics | NOT adjudicated — Cube NOT in shape parse list (§62/§159 Cylinder-class non-parse); buried/cover/suffocation machinery grep-zero |

## Grep evidence
- `cataclysm` in src/: 2 hits, both inert — MonsterCardHelpers.js:158 (comment "…Cataclysm… legendaries"), useTravelManagement.test.js:340 (weather label "Cataclysmic"). NO consumer of Cataclysmic Event machinery.
- `Clinging Flames|Freezing Waves|Raging Storm|Swallowing Earth` — grep-zero across src/ + server/.
- `variantChooser|randomRoll|random_pick|randomChoice` — grep-zero src/. 1d4-random machinery exists ONLY as eye-rays: `parseEyeRays` requires AUTHORED `action.rays` array (MonsterCardHelpers.js:1880-1883), armed in MonsterCardModal.jsx:1739 (`Array.isArray(stageAction.rays) && stageAction.rays.length > 0`) + picker-fire `pickEyeRay` len(rays)-inferred die (:408, §88). Confusion-handler direction d4 unrelated.
- Description-scrape mis-parse roots: `sphereRadiusFeet` (:43), shape scrape `/\bcone\b/i.test(description) ? 'Cone' : 'Line'` (:91), picker title/damageType assembly (:375 `pickerPrimaryDamageType` collects ALL types).

## Likely Location
- `src/components/encounter/MonsterCardModal.jsx` — save-chip routing: rows with numeric `save_dc` fall through to generic executeBlockSaveRoll (:320/:375); description-regex shape scrape (:43/:91) fabricates the hybrid "60-ft Cone"; Cube never parsed (§62/§159); no variant/rays gate hit because `rays` absent (:1739 byte-inert).
- `src/components/encounter/MonsterCardHelpers.js` — `extractConditionsFromSaveEffect`/extractors over-grant cross-event conditions (§117); `save_type "See description"` never rejected → §50 VAR shell ("see" ability stamped).
- DATA: `public/data/monsters.json` elemental-cataclysm.actions[2] — no authored structured sub-event rows; §88 requires byte-shape `rays[]`-style authoring (MA-0374/0383 template).
- `SaveAttackAoeModal` picker grants + condition-duration notes: no per-event discrimination; `dc_success` default half applied blindly.

## Design options
1. PREFERRED — variant-chooser producer modeled on MA-0275 template (§80) fused with §88 eye-ray picker data-shape: author `events:[{key,name,shape,radius_ft,cone_ft,cube_ft,save_type,damage:[{dice,type}]…,te_grants,clock_rounds}]` byte-shape dict on the row; generic N-way chooser modal (d4 roll auto-stamped, event name + its own DC/dice/shape shown, reuse `.sp-modal`/AnimalSpiritVariantModal chrome); per-event save contexts threaded into executeBlockSaveRoll; conditions granted per-event only.
2. Register new te keys for `burning`, `speed_zero` (exists MA-0146), buried `restrained+total_cover+suffocating` composite (§70: cover/suffocation consumers must be explicitly built — recurring zone for Raging Storm needs own consumer like infernalWoundService seam §37/§87).
3. Interim data-only mitigation: split into 4 real rows ("Cataclysmic Event: Clinging Flames" etc.) each with own numeric save_dc+save_type+shape range+damage_dice — selectable by GM, loses the 1d4 randomness but adjudicates honestly; Cube still requires §62/§159 shape-parser extension or Sphere-radius approximation advisory.
- Both-outcomes riders ("Failure or Success: burning / Speed 0") need save_effect byte-marker "Failure or Success:" on the PER-EVENT save_effect to arm parseBothOutcomesClause (§157) — not present in current merged save_effect.

## Cleanup
- Card closed; POST admin/clear-change-data + admin/clear-log both 200; GET verify log=0, combatSummary creatures=0 quiet state. Screenshot: ma-0673-cataclysmic-event-row.png (card open, Cataclysmic Event row, two chips visible).
