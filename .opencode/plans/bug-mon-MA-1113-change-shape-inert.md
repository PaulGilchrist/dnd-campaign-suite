# BUG MA-1113 — Lizardfolk Shaman "Change Shape (Recharges after a Short or Long Rest)": zero-affordance inert row (FAIL(b)/DATA)

## Overview
Row MA-1113 (`lizardfolk-shaman|actions|3`) is an "other"-type self-transformation
prose row. On disk it authors **only `name` + `description`** — no `automation`, no
numeric fields, no structured keys of any kind. Per the codified §60/§195 fingerprint,
such rows arm ZERO affordance in `MonsterAction.jsx`: every chip lane keys off
`attack_bonus` / `save_dc>0` / rollable dice / `Spellcasting` markup / `automation.effect`
/ `automation.type` predicates / `zone` dict / `rays[]` — none present. Live probe on the
test-campaign board confirmed: the row renders as plain `<div class="mc-action"><strong>…</strong>
<span>…</span></div>` with **zero interactive elements**; two fresh-rect real-pointer clicks
on the row produced **zero popups, zero log delta, zero mechanical change-data**.

Unlike pure §70 never-built advisories, the sanctioned fix seam NOW EXISTS: MA-1020
authored the 4th monster automation `monster_shape_shift` (imp Shape-Shift) with
`ShapeShiftModal` chooser + `resolveMonsterShapeShiftRow` consumer. This is therefore a
**one-field DATA fix candidate** (MA-0658/MA-0780/MA-1019 self-transformation family),
not a code-gap ticket.

## Expected (RAW, quoted from disk description)
> "The lizardfolk magically polymorphs into a crocodile, remaining in that form for up to
> 1 hour. It can revert to its true form as a bonus action. Its statistics, other than its
> size, are the same in each form. Any equipment it is wearing or carrying isn't transformed.
> It reverts to its true form if it dies."

The row should arm a clickable affordance that shifts the combatant into crocodile form
(state stamp + log), with a revert lane, an hour-duration note, and (per the name)
short/long-rest rearm economy.

## Actual
- Row DOM (live, `.mc-overlay` on initiative avatar "Lizardfolk Shaman 1"):
  `<div class="mc-action "><strong>Change Shape (Recharges after a Short or Long Rest).</strong> <span>…description…</span></div>`
  — interactive elements inside row: **0** (no `.mc-dice-link*`, no button, no `role=button`);
  whole-overlay `[role=switch]/[role=radiogroup]/[role=tablist]` audit: **0/0/0** (§150 proof-of-no-toggle).
- Control click ×2 at fresh boundingClientRect: card stayed open, **0 popups**, log count
  2→2 (join-noise only), change-data gained only cosmetic `combat-ui-viewingMonster[+CreatureName]`
  view-state keys. Combatant entry carries **no `shapeShiftForm`** (or any shape/form/recharge) keys.
- Initiative walk ×5 turn-starts: zero new log entries, zero passive shape/state machinery for the shaman.
- Console errors: **0** (silent inert, consistent with MA-0658/§195 twin fingerprint).
- Even the cosmetic recharge note never renders: `rechargeDisplayText`/`rechargeUsageOf`
  read `action.recharge`/`usage` only (monsterRecharge.js, MA-0663) — absent, so
  "Recharges after a Short or Long Rest" is pure NAME text; and rest-rearm keys have
  **no consumer app-wide** (§70 line 70: "monster rest-rearm of spell/recharge keys") —
  noted, not chased (§57/§162 family).

## Steps (repro, test-campaign)
1. `npm run dev:locked` rig already up; select `test-campaign` (header verify).
2. Encounters → search "Lizardfolk Shaman" → exact-td row → native `cb.click()` (checked=true verified) → **Join Encounter** (judged by cs poll: `Lizardfolk Shaman 1`, monsterIndex `lizardfolk-shaman`, hp 27 lands idx 0).
3. Initiative → click avatar → card opens.
4. Locate `.mc-action` whose `<strong>` startsWith "Change Shape" → enumerate inner interactive elements → **0**.
5. Real-pointer click the row text ×2 (fresh rect each) → no popup, no log delta, no change-data mechanics.
6. Walk initiative → no passive shape machinery; cs shaman never gains shapeShiftForm/form/recharge keys.

## Static evidence
- Disk `public/data/monsters.json` `lizardfolk-shaman.actions[3]` verbatim keys: `["description","name"]` — **no automation field at all** (verified via JSON dump; also no 2024 monsters twin file — shared data path).
- `monster_shape_shift` census across monsters.json: **exactly 1 hit** — `imp` `actions[2]` "Shape-Shift" (automation line 35445) = the MA-1020 fix row and the byte-shape fix template.
- `monster_self_buff` census: 6 hits (duergar Enlarge/Invisibility, empyrean Bolster, ghost Ethereality, green-hag Invisible Passage, imp Invisibility) — self-state fix family (MA-0655/0658/0780/0919/1019).
- `src/components/encounter/MonsterAction.jsx` chip-arm audit vs this field set: `ShapeShiftLink` :290 requires `automation.type==='monster_shape_shift'`+`forms[]`; `SelfBuffLink` :249 requires `monster_self_buff`; attack chip :361 requires `attack_bonus!=null`; `ActionDamageLinks` :50/:53 requires rollable dice (description has none, `ATTACK_ROW_WORDING` /\b(?:melee|ranged)\s+(?:spell|weapon)\s+attack\b/i does not match "polymorphs into"); `ActionSaveRoll` :115 requires `save_dc>0`; `SpellOrSaveLinks`/`isUtilitySpellCastRow` (Helpers :385) requires `spell_save_dc`/`spellcasting_ability`; `GatedReactionSlot` :165 requires `automation.effect`; `ZoneAuraLink` :207 requires `zone`; `LegendarySpendLink` :188 requires `legendaryGate` (row is in actions[]). **Every lane returns null → zero chips.**
- Monster-side polymorph machinery: `grep -i polymorph src/components/encounter/ src/services/encounters/` → **0 hits** (all 336 repo hits are PC-cast sheets: PolymorphSelectionModal/Wild Shape flow — PC-only, MA-0286 summon-fold class). `crocodile` and `change shape|changeShape` → **0 hits app-wide** in src/+server/.
- `shapeShiftForm` consumers: 5 hits, all inside `src/services/encounters/monsterShapeShift.js` (MA-1020). Per MA-1111 note (§240 line 440): `shapeShiftForm` has **zero attack-gating consumers** — Bite's crocodile-form conditional rider (MA-1111 ticket) never reads it.

## Likely Location
**Layer: monsters.json DATA drift** — `lizardfolk-shaman.actions[3]` lacks the
`automation:{type:"monster_shape_shift", effect:"shape_shift", forms:[…]}` block that the
live consumer chain requires. Fix template = **imp MA-1020 byte-shape** (`imp.actions[2]`:
`automation:{type:"monster_shape_shift", effect:"shape_shift", forms:[{name,speed,…},…,{name:"True Form"}]}`)
→ would-be crocodile form e.g. `forms:[{name:"Crocodile", …},{name:"True Form"}]`;
`isMonsterShapeShiftRow` (monsterShapeShift.js:30) then arms `ShapeShiftLink`
(MonsterAction.jsx:289) → `ShapeShiftModal` chooser → `resolveMonsterShapeShiftRow`
(one merged cs POST stamping `shapeShiftForm` + speed dict + logs, §431).

Deeper §70 residuals the seam does NOT close (advisory, do not chase):
- **Statistics-inheritance / size change**: RAW "statistics, other than its size, are the
  same in each form" + crocodile size/stat swap — no stat-merge machinery for monster
  self-polymorph (MA-1020 stamps Speed dict only; bite-damage swap and size legs stay inert;
  MA-1111's crocodile Bite grapple rider stays ungated — shapeShiftForm zero attack consumer).
- **Revert-on-death**: zero consumer (death hooks don't scan shape state).
- **Revert-as-bonus-action**: revert rides a re-click of the "True Form" chooser row
  (MA-1020 RAW-until-shift-back model, no clock); no bonus-action economy exists on
  monster cards (§123 line 123: "NO bonus-actions section on monster card").
- **1-hour duration**: MA-1020 seam is clock-less by design ("until shift back"); an
  `addExpiration` rounds:600 clock (§37 hours×600) would be a design decision for the fix.
- **Rest-rearm** of the "(Recharges after a Short or Long Rest)" economy: §70 residual —
  no consumer for monster rest-rearm keys; the name text stays cosmetic even post-fix.

## Notes
- Family: MA-0658 (duergar Invisibility, §195 — self-transformation prose FAIL(b)/DATA),
  MA-0780 (ghost Ethereality → migrated onto monster_self_buff), MA-1019 (imp Invisibility
  lane-b), MA-1020 (imp Shape-Shift — the shape-shift lane this row should have ridden),
  MA-0648/0655 (summon/self-buff automation family). Same monster: MA-1111 (Bite, filed)
  — its crocodile-form grapple rider and MA-1113's form gate share the shapeShiftForm
  gating gap (§440).
- Trichotomy: RAW effect unresolvable, row inert, consumers DO exist for twins via the
  monster_shape_shift/monster_self_buff seam ⇒ FAIL(b) with one-field DATA fix candidate,
  not §70-never-built advisory, not PASS (no affordance resolves it — verified live),
  not INCOMPLETE (card opened and probed cleanly).
- Live session: board re-staged post-admin-clear, join landed exactly-td, `cb.click()`
  checked first try, 0 console errors all session.
