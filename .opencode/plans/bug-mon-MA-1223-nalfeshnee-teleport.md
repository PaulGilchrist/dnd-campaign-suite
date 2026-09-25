# bug-mon-MA-1223-nalfeshnee-teleport

## Title
Nalfeshnee "Teleport" (MA-1223): junk "+0" attack chip adjudicates a bogus to-hit roll for a pure relocation action; zero teleport advisory/log/consumer

## Overview
MA-1223 (nalfeshnee actions[2], "Teleport") is a zero-number utility row: RAW it is pure self-relocation (up to 120 ft to an unoccupied space the nalfeshnee can see) — no attack roll, no save, no dice. Disk ships `attack_bonus: 0` (not null/absent), which arms the same "+0" junk attack chip documented in the MA-1212/MA-1220 junk-chip family (MonsterAction.jsx:338 `actionHasAttack = action.attack_bonus != null`). First press of this chip on this monster (MA-1221/MA-1222 explicitly left it unpressed) confirms the worst shape: every press adjudicates a full wrong-model d20+0 attack versus the armed target's AC, logs `roll/rollType:"attack" name:"Teleport"` hit/miss entries, and pollutes `lastAttackRoll`, `_lastRollContext`, AND the top-level `lastAttack` map (even tagging it `weaponType:"ranged"`). Meanwhile the sanctioned effect — a teleport advisory record — never fires: no `ability_use`, no te marker, no movement affordance, no popup advisory text.

## Expected (quote)
Manifest/disk description verbatim:

> "The nalfeshnee teleports up to 120 feet to an unoccupied space it can see."

There is no attack roll and no saving throw in RAW. Per the MA-1212 fix shape, `attack_bonus` must be null or absent so the row cannot arm a "+0" to-hit chip, and the row needs a sanctioned record path (§6 "At Will" sentinel → recording-only `ability_use` advisory log, or an advisory resolver like the sphinx legendary `sphinx_teleport` precedent at MonsterCardModal.jsx:581). PASS would require a sanctioned advisory record/advisory log firing on press with zero rolls.

## Actual
- Disk `public/data/monsters.json` nalfeshnee actions[2]: `{name:"Teleport", attack_bonus:0, save_dc:0, save_type:"", save_effect:"", range:"", reach:"", recharge:""}` — NO automation, NO effect key, NO zone dict, NO usage/uses sentinel, NO advisory field.
- Grep consumers: ZERO monster-side consumers for plain `teleport`. All teleport machinery is PC-feature-keyed (see Notes). The only monster-side teleport advisory (`sphinx_teleport`) rides the legendary `action.advisory` field — this row has none, so nothing arms.
- Live (test-campaign, header verified; full re-join per MA-1222 "board EMPTY" note): cs Nalfeshnee 1 AC18 HP184 init9 monsterIndex nalfeshnee disk-exact; Bandit victim AC12 TRUSTED currentHp 999 (max stays authored 11); armed targetName=Bandit server-confirm. Board gridless: `__map__={activeMapName:null}` (no grid map exists → lenient advisory expectation applies; advisory still absent).
- Card census (Teleport row): sole "+0" `span.mc-dice-link` junk chip; ZERO DC chip (`save_dc:0` never arms — MA-1071 `Number(save_dc) > 0` gate re-confirmed on nalfeshnee), ZERO advisory/teleport/move affordance, ZERO "At Will" sentinel.
- Press ×2 (real pointer, fresh rect + scrollIntoView inline:center per press, re-tag each press MA-112): popup-modal each press "Teleport … d20 … ✓ HIT (18 vs AC 12)" then "✗ MISS (7 vs AC 12)" — pure attack chrome, no teleport advisory text.
- §488 tail-count: log-delta exactly 2 (1:1 landed, zero absorbed): `roll/attack name:"Teleport" bonus:0 rolls:[18,1] total:18 hit:true damageType:null` and `rolls:[7,3] total:7 hit:false` vs Bandit AC12.
- Pollution: `Nalfeshnee 1.lastAttackRoll = {attackName:"Teleport", bonus:0, hit:false}`, `_lastRollContext = {type:"attack", attackName:"Teleport", damageFormula:null}`, top-level `lastAttack = {attackerName:"Nalfeshnee 1", attackName:"Teleport"…, weaponType:"ranged", bonus:0, hit:false}`.
- Zero `ability_use` anywhere; Bandit change-data store = {} (no teleport te); Bandit HP held 999; zero relocation (no map, and no advisory to GM-move either).
- Console: 0 errors (2 pre-existing benign warnings).

## Steps
1. `npm run dev` (dev already running on :5173/:80 → 200, no restart); open http://localhost:5173, select test-campaign, header verified.
2. Admin → Clear Change Data + Clear Campaign Log (auto-accept dialogs); board EMPTY per MA-1222 note → full re-join required.
3. Encounters → search Nalfeshnee → exact `td[1]==='Nalfeshnee'` sole row → native cb.click() checked 1/try → Join Encounter (auto-navigate Initiative; Nalfeshnee 1 AC18 HP184 init9 cs-confirmed).
4. Initiative → +NPC → autocomplete `.monster-autocomplete-input` idx1 → Meta+A, type Bandit, click `li.textContent==='Bandit'`, Escape+blur (§487/MA-1192) → TRUSTED current HP 999+Enter (server 999/11 AC12).
5. Arm via Nalfeshnee own-card `select[data-testid=target-select]` → Bandit; cs targetName=Bandit server-confirm.
6. Open Nalfeshnee card (avatar click) → Teleport row: sole clickable "+0" chip, no sanctioned affordance.
7. Press "+0" ×2 (fresh rect each press): popup HIT then MISS attack chrome; log gains exactly two bogus `roll/attack "Teleport" bonus:0` entries; lastAttackRoll/_lastRollContext/lastAttack polluted; zero ability_use/advisory/te/relocation; console 0 errors.
8. Cleanup: card ×, Admin → Clear Change Data + Clear Campaign Log → `log=[] cd={} cs null`, 15s quiet.

## Likely Location
- `public/data/monsters.json` nalfeshnee actions[2] — `attack_bonus: 0` should be null/absent (MA-1212 fix shape); missing sanctioned record sentinel (§6 At Will + uses:999) or advisory field.
- `src/components/encounter/MonsterAction.jsx:338` — `actionHasAttack = action.attack_bonus != null` treats authored `attack_bonus: 0` as a real attack (DC0 `>0` convention MA-0551/MA-1071 applied to save_dc but not to attack_bonus).
- `src/components/encounter/MonsterCardModal.jsx` — normal-action press path rolls a full attack adjudication (rolls, hit vs AC, lastAttack pollution) for a row with no numeric mechanic; no normal-action advisory fork exists (the `action.advisory` fork at :581 is legendary-row-only).

## Notes
- PC-vs-monster teleport consumer distinction (grep evidence): every app-wide teleport consumer is PC-side and feature-keyed — `src/components/char-sheet/modals/TeleportModal.jsx` (PC Teleport spell picker), `handlers/class-sorcerer/psychicTeleportationHandler.js` + `arcaneChargeHandler.js` + `warpingImplosionHandler.js`, `handlers/class-warlock/mistyWandererHandler.js` + `tempTeleportHandler.js`, `handlers/class-other/giantAncestry*.js` (cloud jaunt), `StrideOfTheElementsModal.jsx`, `HurlThroughHellModal.jsx`, plus te markers `warping_implosion_teleport`/`teleport_swap_with_illusion` in targetEffectDefinitions.js. None dispatch from a monster actions[] row. Monster-side: `monsterLegendaryUses.js`/MonsterCardModal.jsx:581 advisory fork covers ONLY legendary rows carrying `action.advisory` ("sphinx_teleport", MA-0957/0958); CLA-320 comment (warpingImplosionHandler.js:187-188) confirms "no grid-position consumer app-wide — teleport relocation stays GM-enforced". Monster-row "Teleport" therefore has NO consumer: FAIL(b) confirmed.
- Fix shape A (§6 sanctioned, MA-1212 twin): `{ "usage": "At Will", "uses": 999 }` + `attack_bonus: null` → recording-only `ability_use` advisory ("teleports up to 120 ft … GM moves token, CLA-320 no position consumer").
- Fix shape B: `advisory: "monster_teleport"`-style field extended to normal actions reusing the sphinx advisory popup/log resolver (heavier: generalizes the legendary-only fork).
- Bonus pollution detail: `lastAttack.weaponType:"ranged"` is fabricated for a fiend teleport — downstream riders gated on lastAttack (smite-family, marked-by, opportunity logic) could mis-fire off a "ranged Teleport attack".
- Manifest not edited; no git writes; test-campaign only. Board end state: log=[] cd={} cs null, 15s quiet confirmed.
