# Bug MA-0759 — Galib Duhr / Animate Boulders — FAIL(b)/DATA (zero-affordance inert row, MA-0757 twin)

**Verdict: FAIL(b)/DATA** — usage-only OTHER-type summon row with no `automation` struct arms ZERO affordance in `MonsterAction.jsx`; honest-inert text row. Grep-proved + live zero-delta ×2. Galib-duhr twin of MA-0757 (galeb-duhr, same adjudication); twin discriminator: this row carries a `usage` DICT so a cosmetic "(1/Day)" renders (§187), whereas MA-0757's `uses:"1/Day"` STRING rendered NOTHING (§240). Neither is gated; neither resolves anything per description (animation/spawn machinery absent).

## Row (manifest MA-0759, monsterIndex galib-duhr, actions[1])
> The galeb duhr magically animates up to two boulders it can see within 60 feet of it. A boulder has statistics like those ofa galeb duhr, except it has Intelligence 1 and Charisma 1, it can't be charmed or frightened, and it lacks the galeb duhr maintains concentration, up to 1 minute (as if concentrating on a spel1). — category: actions, actionType: condition, conditions: [charmed, frightened]

## Disk (public/data/monsters.json galib-duhr actions[1], entry index L24437) — quoted
```json
{
  "name": "Animate Boulders",
  "description": "The galeb duhr magically animates up to two boulders it can see within 60 feet of it. A boulder has statistics like those ofa galeb duhr, except it has Intelligence 1 and Charisma 1, it can't be charmed or frightened, and it lacks the galeb duhr maintains concentration, up to 1 minute (as if concentrating on a spel1).",
  "usage": { "type": "per day", "times": 1 }
}
```
Row-vs-disk: name + description byte-match. Fields present: `name`, `description`, `usage` dict. **NO** `automation`, **NO** attack_bonus / damage dice / save_dc / zone / legendary / numeric uses/maxUses / conditions.

## Data-quality notes (§23 typo family + inverted extraction)
1. **OCR mangling ON DISK** (fix = canonical prose restamp, §219 data hygiene): "ofa" → "of a"; "spel1" → "spell"; truncated run-on "…and it lacks the galeb duhr maintains concentration…" — canonical 5e text is "…and it lacks this action. The boulder takes its turn immediately after the galeb duhr… remains animate for 1 minute or until it or the duhr dies". Canonical galeb-duhr twin (MA-0757) carries the clean prose; galib variant prose was OCR-sliced.
2. **INVERTED conditions[] manifest label**: manifest harvests `conditions:[charmed,frightened]` from "it CAN'T be charmed or frightened" — negation inverted; prose forbids granting these conditions to the boulders. Disk authors no conditions field; runtime never grants them (live-proved below). Manifest actionType:"condition" is likewise a mislabel — the row's RAW mechanic is summon/animate, not condition application. Fix = drop conditions[] + retype to summon once MA-0648 rides this row.

## Static evidence
1. **Chip-arm inventory** `src/components/encounter/MonsterAction.jsx` (disk today): chips arm ONLY off `legendaryGate` (LegendarySpendLink), `zone` dict (ZoneAuraLink), `automation.type:"monster_summon"` (SummonLink `isMonsterSummonRow`), self-buff automation (SelfBuffLink), `attack_bonus != null`, dice formula from description (ActionDamageLinks — no NdM pattern in this prose), `save_dc` (ActionSaveRoll), name==`Spellcasting` markup (SpellCastLinks). **All false ⇒ zero `.mc-dice-link`** (§187/§194 fingerprint, §60).
2. **Cosmetic "(1/Day)"** — `formatActionUsage` (MonsterCardHelpers.js:1973-1982): `usage.type==='per day' && times!=null` → "1/Day" rendered as `<em> (1/Day)</em>`; the ONLY usage.type/times readers app-wide are this formatter — no gate consumer (§162/§169); `monsterAbilitySaveUsesGate` (services/encounters/monsterAbilityUses.js) reads `abilitySaveMaxUses` numeric `uses`/`maxUses` ONLY ⇒ gate null even if a link armed. §187 cosmetic-counter fingerprint CONFIRMED live; distinct from §240 galeb-duhr total-silence variant.
3. **Zero consumers** — grep `animate.boulders` (-i) across `src/` + `server/`: zero hits. No summon automation ⇒ MA-0648/§219 monster_summon seam (`src/services/encounters/monsterSummon.js`, live since MA-0648/0651) unreached.

## Live proof (test-campaign, dev :5173, header verified "test-campaign", fresh admin-cleared board)
- Baseline log len 0 pre-join. EB join exact td-text "Galib Duhr" → cs creatures[0] "Galib Duhr 1", monsterIndex `galib-duhr` ✓ distinct from galeb-duhr twin (§MA-0758 recipe); init 10, hp 85/85.
- Post-join log len 2 (encounter + initiative roll = join noise §146, excluded).
- Card open (avatar → `.mc-overlay`, title "Galib Duhr 1"): Animate Boulders `.mc-action` — `.mc-dice-link` count **0**, interactive elements **0**, "(1/Day)" text **PRESENT** (cosmetic, via usage dict — twin-discriminator vs MA-0757).
- Fresh-rect `<strong>` mouse-click ×2 → popup overlays **none** (.popup-overlay/.sp-overlay/.sp-modal/.mc-prerequisite-refusal all absent); **log delta 0** (len 2→2); no rolls, no summons, no refusal; card survived both clicks; tabs: single localhost tab (§143); console errors 0 (§158 fake-chip non-extension re-confirmed).
- **charmed/frightened NEVER granted**: change-data full-walk → sole "charmed|frightened" occurrence is the prose description inside `combat-ui-viewingMonster.actions[1].description` snapshot; no `activeConditions`/`activeConditionMeta` on any char, top-level `targetEffects` ABSENT, `lastAttack` ABSENT (null). Inverted manifest extraction is cosmetic-only — runtime never fires it (and granting would violate RAW anyway).
- Cleanup: POST admin/clear-change-data + admin/clear-log 200/200 → verified `change-data {}` `log []`.

## Fix design (§219 MA-0648 monster_summon template, now live app-wide)
```json
"automation": {
  "type": "monster_summon",
  "options": [{ "monster": "galib-duhr" }],
  "count": 2,
  "range_ft": 60,
  "duration_minutes": 1
},
"uses": 1,
"maxUses": 1
```
- Numeric `uses:1 + maxUses:1` replaces/in-parallel-of the `usage` dict for the MA-0020 gate refusal (§169 pattern); `usage` may stay for RAW display or be dropped at fixer's discretion.
- **Boulder self-reference caveat (same as MA-0757):** `options.monster:"galib-duhr"` re-spawns the full duhr block including this action + the OCR-mangled twin problem; resolver needs an option-level stat-modifier field (Int/Cha set 1, strip `actions[1]`) else animated boulders could re-animate boulders (RAW forbids). Int/Cha-1, obeys-duhr chain, concentration-mode and 1-minute despawn = spawn-semantics depth §70 advisory unless resolver grows the modifier field; adjudicable axis = chip + gate + count + range.
- Prose restamp (canonical 5e text, fixing "ofa"/"spel1"/truncation) MUST ride the same pass (§23).

## Notes (§70 advisory)
- 1-minute concentration clock / obeys-duhr command chain / same-initiative-after ordering: no summon-token expiry clock app-wide (§84/MA-0757 residual).
- Inverted `conditions:[charmed,frightened]` + actionType:"condition" manifest labels: orchestrator-owned manifest hygiene — data note, not a runtime defect (runtime reads disk only, disk authors neither).

## Recipe / pitfall (NEW)
- **TWIN DISCRIMINATOR — cosmetic vs silent usage on summon twins:** same-named row across galeb-duhr (`uses:"1/Day"` STRING → formatActionUsage receives `action.usage`=undefined → NOTHING renders, §240) vs galib-duhr (`usage:{type:"per day",times:1}` DICT → "(1/Day)" renders cosmetically, §187). Enumerate `rowTextHas1Day` live before assuming zero-affordance fingerprint details; the counter text difference is diagnostic of WHICH field carries the count and changes only cosmetics, never affordance/gating.
- **RECIPE — prose-word condition-grant audit:** when manifest conditions[] were harvested from negated prose, audit change-data with a recursive walk matching the condition words and assert every hit lands ONLY on `*.description` strings (`path` endsWith "description"); any hit on activeConditions/activeConditionMeta/targetEffects keys would prove a live (wrong) grant. Solo inert-row probe needs no victim (§MA-0757 recipe reused).
