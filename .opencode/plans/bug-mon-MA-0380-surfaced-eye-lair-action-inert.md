# Bug — MA-0380 Beholder "Unnamed lair actions 3" (lair_actions[2]) — zero-affordance inert

## Verdict: FAIL (MA-0378/0379 zero-affordance class — expected inert)

## Scope
- Campaign: `test-campaign` only (header verified before every action; URL localhost:5173 throughout)
- Monster: Beholder (monsterIndex `beholder`), EB exact select "Select Beholder", Joined
- Row: `lair_actions[2]`, category `lair_actions`, actionType `other`

## Data evidence (curl/python truth, public/data/monsters.json)
`beholder.lair_actions[2]` keys = `['description', 'save_type', 'save_effect']` ONLY.
- NO `name` key → synthetic label "Unnamed lair actions 3"; rendered name is empty → "."
- NO `save_dc` key (DC 15 exists only inside `save_effect` prose)
- NO `attack_bonus`, `advisory`, `zone`, `damage_dice_primary`
- Metadata MISMATCH: `save_type: Dexterity` + `save_effect: "DC 15 Dexterity saving throw or be grappled..."` is wall-grapple prose (belongs to a lair_actions[1]-style row), while `description` is the surfaced-eye random-eye-ray text. Random eye rays are unparseable (MA-0374) — no eye-ray engine consumer exists.

## Gate evidence (code cites)
- `isLairRowClickable` — src/services/encounters/monsterLairActions.js:25-30
  - :26 `if (!row || typeof row !== 'object' || !row.name) return false;` → **FALSE** (hard name-gate, MA-0222 fingerprint)
  - :27 save_dc/attack_bonus/advisory → unreachable; all absent anyway
  - :28 zone / :29 damage → absent → false
- `lairRowAffordance` — monsterLairActions.js:38-46 → `isLairRowClickable` false → returns `null`
- Render gate — src/components/encounter/MonsterCardBody.jsx:340
  `typeof la === 'string' || !isLairRowClickable(la)` → TRUE → static branch (:342-352): `<div class="mc-action"><strong>{la.name}.</strong>` + prose. Clickable `mc-dice-link-lair` branch (:363-369) never renders.
- No initiative-20 lair scheduler anywhere in production code (grep: monsterLairActions is click-driven only; matches elsewhere are tests/comments) — MA-0378/0379 family residual.

## UI evidence (Playwright, localhost:5173)
- combatSummary after Join (curl): `{"name":"Beholder 1","monsterIndex":"beholder","ac":18,...}` ✓
- Card modal (portrait click) → "Lair Actions" heading; row [2] DOM dump:
  `<div class="mc-action"><strong>.</strong> <span>An eye opens on a solid surface within 60 feet...</span></div>`
  - tagName DIV, role null, tabIndex -1, cursor auto, clickableChildren: [] → ZERO affordance
- Forced clicks ×2 (row.click() + dispatched bubbling MouseEvent): no popup, no `.mc-prerequisite-refusal`, no save prompt, no modal, row HTML unchanged → inert

## cs/log audit (post-clicks, curl)
- change-data keys: AasimarTest, __campaign__, __map__, activeCreatureName, combat-ui-viewingMonster*, combatSummary
- Beholder `targetName: null`, no conditions/grapple/targetEffects/eye-ray keys → zero effect
- campaign log: 2 join-era entries, 0 lair/eye-ray/grapple hits → no automation fired, no refusal logged (row never reaches resolveLairRow — render gate excludes it)

## Cleanup (verified)
- Admin → Clear Change Data (native confirm, test-campaign) → accepted
- Admin → Clear Campaign Log (native confirm, test-campaign) → accepted
- Post-clear curl truth: change-data `{}`, log `[]` ✓

## Conclusion
Behavior is per-design inert for nameless lair rows (MV-24 legacy-protection comment, monsterLairActions.js:17-19), but the row is non-functional as authored: unclickable, unscheduled, and carries mismatched grapple save metadata against an unparseable random-eye-ray description. FAIL, consistent with MA-0378/MA-0379.
