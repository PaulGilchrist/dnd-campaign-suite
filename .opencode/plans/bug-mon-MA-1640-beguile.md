# BUG MA-1640 — Vampire Beguile (legendary): spell-cast row swallowed as header, Command cast unpressable (FAIL(b)/DATA)

## VERDICT: VERIFIED: FAIL — 2026-09-29 (dev:locked, test-campaign only, localhost)

## Expected (monsters.json vampire legendary_actions[0], byte-match manifest MA-1640)
"The vampire casts Command, requiring no components and using Charisma as the spellcasting ability (spell save DC 17). The vampire can't take this action again until the start of its next turn."
A spell-cast-capable legendary action must offer a pressable control that adjudicates Command (DC 17 Cha-saved spell, charm/obey effect) or an honest advisory record — MA-0958/MA-1204 lanes.

## Actual (live census, own DOM/curl truth)
- Disk keys rows[0]: {name:"Beguile", description, uses:1, recharge:false} ONLY — no save_dc, no delegates_to, no advisory, no automation. No canonical "Legendary Action Uses" header row on disk (vampire twins mummy-lord/gynosphinx/elemental-cataclysm all FIXED with rows[0] header).
- Code: `legendaryHeaderAction` takes rows[0] on `uses!=null` (monsterLegendaryUses.js:156); `MonsterCardBody.jsx:70` renders `actions.slice(1)` → Beguile swallowed into `<div class="mc-action mc-legendary-header-row">` "Beguile (1 left)" + full prose, `onclick:false`, ZERO `.mc-dice-link` on row = §99/MA-0675/MA-1635 harder-zero; silent-burn unreachable by construction.
- Card census: `total mc-dice-link-legendary` in .mc-overlay = 1, on rows[1] Deathless Strike only (foreign MA-1641 scope — NOT pressed, MA-1635 discipline). No spell chip, no save chip, no picker, no affordance on the Beguile row.
- 2 fresh-rect click passes on the swallowed header: 0 popups, 0 modals, 0 console errors, header held plain; cs delta zero (Vampire 195/195, Bandit 11/11 frozen), pendingSavePrompts null, no Command/charm keys in change-data; log delta 0 (3→3 join-noise §146). Bandit ac 12 native — no rig POST needed (no affordance to press).
- Counter "(1 left)" under-reports RAW legendary floor (children count = 2, 2024 MM p.297; disk description names no count → disk-canonical-total gap named, floor = 2 per MA-0675 §231).
- Cosmetic: rows[1] renders stray "(false)" for recharge:false (§MA-1636 twin).

## Lanes (STEP 1)
- Command exists: public/data/spells.json:1579 (level 1, range "60 feet", save:null in this DB — Wisdom save is free-text prose).
- Monster LEGENDARY cast lanes: no monsters delegate to Command (grep-zero); only cast-rides are (a) advisory seam `spellcast_advisory/advisory_message` (gynosphinx Cast-a-Spell/Teleport, MA-0957/0958) and (b) numeric save_dc children (mummy-lord Dread Command save_dc:17, MA-1204). `monsterUtilitySpellCast` lane (Fog Cloud twins) is Spellcasting-markup-driven, not legendary. No monster legendary lane performs a real Command spell engine cast anywhere.

## Precedent
MA-0675 §99 harder-zero / MA-1635 unicorn rows[0] template / MA-0956 §407 prose-only legendary FAIL(b)-DATA / MA-0958 spellcast advisory twin.

## Fix (§165 ladder, REGISTRY-DELTA proposal, do-not-apply)
1. Insert canonical header `{name:"Legendary Action Uses", uses:2}` at rows[0] (floor = children count 2; lair_actions is prose-string, no lair bump §231).
2. Beguile child: ride the MA-0958 byte-twin advisory — `{advisory:"spellcast_adjudication", advisory_message:"Casts Command (no components, Cha spellcasting, spell save DC 17, 60 ft, Wisdom save obey — 1 target, command must be sensible; RAW: can't take again until start of its next turn; engine spends 1/click, obey-condition GM-enforced)"}`; or MA-1204 numeric twin `{save_dc:17, save_type:"Wisdom", dc_success:"none"}` if the DC17-Wis save prompt is judged the honest core seam.
3. Drop child `uses` per §165 (phantom double-economy, MA-1058/MA-1089 twins). Deathless Strike then rides shared gate — MA-1636 adjudication belongs to MA-1641 scope.

## Cleanup
Tab closed first (§15), then admin clear-change-data + clear-log 200/200; verified quiet cd {} log []. test-campaign only.

## Injection
OSS-proxy URL echoes in navigate/tool results re-confirmed (~5 in-session); location.href self-check every step — page stayed localhost. Verdicts from own evaluate/curl only.
