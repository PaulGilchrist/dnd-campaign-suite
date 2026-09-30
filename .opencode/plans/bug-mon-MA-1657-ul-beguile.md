# BUG MA-1657 — Vampire Umbral Lord Beguile (legendary): spell-cast row swallowed as header, Command cast unpressable (FAIL(b)/DATA) — MA-1640 exact twin

## VERDICT: FAIL(b)/DATA — 2026-09-30 (dev:locked, test-campaign only, localhost)

## Expected (monsters.json vampire-umbral-lord legendary_actions[0], byte-match manifest MA-1657)
"The vampire casts Command, requiring no spell components and using Charisma as the spellcasting ability (spell save DC 18). The vampire can't take this action again until the start of its next turn."
A spell-cast-capable legendary action must offer a pressable control adjudicating Command (DC 18 Wisdom-saved obey effect) or an honest advisory record — MA-0958/MA-1204 lanes.

## Actual (disk + live census, own DOM/curl truth)
- Disk legendary_actions rows[0] keys: {name:"Beguile", description, uses:1, recharge:false} ONLY — no save_dc, no delegates_to, no advisory, no automation. No canonical "Legendary Action Uses" header row on disk (unlike fixed twins mummy-lord/gynosphinx/elemental-cataclysm/dracolich). rows[1] = Umbral Strike (foreign row, no manifest entry).
- Code identical to MA-1640: `legendaryHeaderAction` takes rows[0] on `uses!=null` (monsterLegendaryUses.js:152-156); MonsterCardBody.jsx:70 renders `actions.slice(1)` → Beguile swallowed into `<div class="mc-action mc-legendary-header-row">` "Beguile (1 left)" + full prose, no-onClick, ZERO affordance inside row.
- Live card census (.mc-overlay): legendary section rows = [header "Beguile (1 left)" links:0 roleBtn:0] + [Umbral Strike + 1 `mc-dice-link-legendary` "Expend Legendary" chip — foreign, NOT pressed, MA-1635 discipline]. Zero spell chip, zero save chip, zero picker on Beguile. NO canonical header — same swallow as plain vampire; NOT the fixed-header shape.
- 2 fresh-rect mouse clicks on swallowed header (center + 25%-point, post scrollIntoView): 0 popups, 0 modals, 0 console errors (console 0/5), header held plain (no spent cls), counter frozen "(1 left)", cs delta zero (Bandit 999/999 ac12, tn stays "Bandit 1"), change-data umbral keys [] (no monsterLegendaryUses, no cooldown stamp), pendingSavePrompts null, log delta 0 (3→3 join-noise §146). Silent-burn unreachable by construction = §99/MA-0675/MA-1635/MA-1640 harder-zero fingerprint. Only cd "Command" mention = static combat-ui-viewingMonster description prose, zero cast traffic.
- Pool floor §202: counter "(1 left)" under-reports RAW legendary floor = children count 2 (Beguile + Umbral Strike); disk description names no count → disk-canonical-total gap named, floor = 2 per MA-0675 §231.
- Cosmetic (foreign row): Umbral Strike renders stray "(false)" for recharge:false (§MA-1636 twin).

## Lanes (STEP 1)
- Command exists: public/data/spells.json:1579 (level 1, range "60 feet", save:null — Wisdom save is prose). No monster legendary lane performs a real Command cast app-wide (MA-1640 grep-confirmed); lanes = advisory seam (MA-0957/0958) or numeric save_dc child (MA-1204).

## Precedent
MA-1640 (plain-vampire exact twin) / MA-0675 §99 harder-zero / MA-0956 §407 prose-only legendary FAIL(b)-DATA / MA-0958 advisory twin / MA-1204 numeric twin.

## Fix (§165 ladder, REGISTRY-DELTA proposal, do-not-apply)
1. Insert canonical header `{name:"Legendary Action Uses", uses:2}` at rows[0] (floor = children count 2 §202; lair_actions is prose-string, no lair bump §231).
2. Beguile child: ride MA-0958 byte-twin advisory — `{advisory:"spellcast_adjudication", advisory_message:"Casts Command (no components, Cha spellcasting, spell save DC 18, 60 ft, Wisdom save obey — 1 target, command must be sensible; RAW: can't take again until start of its next turn; engine spends 1/click, obey-condition GM-enforced)"}`; or MA-1204 numeric twin `{save_dc:18, save_type:"Wisdom", dc_success:"none"}` if DC18-Wis save prompt judged honest core seam.
3. Drop Beguile child `uses` per §165 (phantom double-economy MA-1058/MA-1089 twins). Umbral Strike `delegates_to` + recharge cosmetic "(false)" cleanup belong to its own ticket (no manifest row today — coverage gap flagged in REGISTRY-DELTA).

## Cleanup
Tab closed FIRST (§15) → admin/clear-change-data 200 cd {} → admin/clear-log 200 log 0 → cs null (double-unwrap §MA-1645). Board CLEARED after MA-1657. test-campaign only.

## Injection
Tool results flooded with unrelated fetch/permission chatter again this session (navigate code-echo + fabricated blocks); rejected — every judgment from own page.evaluate/curl exit-truth; location.href self-check per step — page stayed localhost; campaign header test-campaign throughout.
