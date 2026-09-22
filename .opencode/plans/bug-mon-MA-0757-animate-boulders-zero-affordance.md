# Bug MA-0757 — Galeb Duhr / Animate Boulders — FAIL(b)/DATA (zero-affordance inert row)

**Verdict: FAIL(b)/DATA** — usage-only OTHER-type summon row with no `automation` struct arms ZERO affordance in `MonsterAction.jsx`; the row is honest-inert text with a silently-ignored `uses:"1/Day"` string. Grep-proved + live zero-delta ×2.

## Row (manifest MA-0757, stableKey `galeb-duhr|actions|1`)
> The galeb duhr magically animates one or two boulders it can see within 60 feet of itself. Each boulder uses the Galeb Duhr stat block, except it has Intelligence and Charisma scores of 1 and lacks this action. The boulder takes its turn immediately after the galeb duhr on the same initiative count, and it obeys the galeb duhr. A boulder remains animate for 1 minute or until it or the galeb duhr dies. — category: actions, actionType: other, uses: "1/Day"

## Expected (per row)
A clickable summon mechanism that spawns 1–2 boulder combatants (Galeb Duhr stat block, Int/Cha 1, no Animate Boulders) at same-initiative-after-duhr, obeying the duhr, 1-minute duration, gated 1/Day.

## Disk (public/data/monsters.json galeb-duhr actions[1]) — quoted
```json
{
  "name": "Animate Boulders",
  "description": "The galeb duhr magically animates one or two boulders ... remains animate for 1 minute or until it or the galeb duhr dies.",
  "uses": "1/Day"
}
```
Only `name` + `description` + `uses:"1/Day"` STRING. **NO** `usage` dict, **NO** `automation`, **NO** attack_bonus / damage dice / save_dc / zone / legendary fields.

## Static evidence
1. **Chip-arm inventory** `src/components/encounter/MonsterAction.jsx:249-274` — chips arm ONLY off: `legendaryGate` (LegendarySpendLink), `zone` dict (ZoneAuraLink), `automation.type:"monster_summon"` (SummonLink → `isMonsterSummonRow`), self-buff automation (SelfBuffLink), `attack_bonus != null` (attack chip), dice formula from description (ActionDamageLinks — description contains NO NdM pattern), `save_dc` (ActionSaveRoll), name==`Spellcasting` markup (SpellCastLinks). **All false for this row ⇒ zero `.mc-dice-link`** (§187/§194 fingerprint, §60).
2. **`uses` string dead** — `formatActionUsage` (MonsterCardHelpers.js:1973-1982) reads `action.usage` ONLY; `usage` undefined ⇒ returns null ⇒ **"(1/Day)" counter NEVER renders, not even cosmetically** (§205 — worse than §187's cosmetic `(1/Day)`, because §187 rows have `usage:{type:"per day"}` and this row carries the count in the never-read `uses` string). No gate consumer of `uses:"1/Day"` exists (abilitySaveMaxUses is save-row-only, §162/§169 NaN fingerprint moot — no chip to gate).
3. **Zero consumers** — grep `animate_boulders|Animate Boulders` across `src/` + `server/`: no handler, no consumer. spells.json grep `galeb-duhr` (both `/data/` and `/data/2024/`): grep-zero in automation.variants ⇒ no cast-path adjudication (§86/§219 n/a; RAW here is the monster's own action).
4. **Fake-chip status** — row header `<strong>Animate Boulders.</strong>` renders as plain row text, NOT clickable: §158 fake-chip machinery is Spellcasting-markup-only and §194 confirms it does not extend to generic other-type rows. Live: row `<strong>` mouse-click ×2 produced no popup, no roll, no log entry.

## Live proof (test-campaign, dev :5173, header verified)
- EB join exact "Galeb Duhr" → cs creatures[0] "Galeb Duhr 1" (npc Elemental, init 20, hp 123/123, AC 16, monsterIndex `galeb-duhr`).
- Card open (avatar click → `.mc-overlay`): Animate Boulders `.mc-action` — `mc-dice-link` count **0**, interactive elements **0**, `(1/Day)` text **absent** (`rowTextHas1Day:false`).
- Fresh-rect `<strong>` click ×2 → popup overlays: none appeared (only the card `.mc-overlay` itself); **log delta 0** (len 2→2, join noise excluded §146); no rolls, no summons, no refusal message. §143 tab audit clean after every click.
- Cleanup: admin clear cd+log → `change-data {}` `log []`.

## Likely Location / Fix design
`src/components/encounter/MonsterAction.jsx` chip gate (§187) + **MA-0648/§219 monster_summon seam** is the sanctioned fix template (now live app-wide, `src/services/encounters/monsterSummon.js`):
```json
"automation": { "type": "monster_summon", "options": [{ "monster": "galeb-duhr" }], "count": 2, "range_ft": 60, "duration_minutes": 1 },
"uses": 1,
"maxUses": 1
```
- Numeric `uses:1 + maxUses:1` (NOT the `"1/Day"` string) rides the MA-0020 monsterSpellUses gate for the 1/Day refusal (§169 fix pattern).
- **Boulder self-reference caveat:** options `{monster:"galeb-duhr"}` re-spawns the full duhr block including this same action — needs an option-level stat modifier clause (Int/Cha set to 1 + strip `actions[1]`) in the resolver, else animated boulders could re-animate boulders (RAW forbids). Int/Cha-1, "obeys the duhr", and 1-minute-despawn/dies-clauses are spawn-semantics depth = §70 advisory notes (GM-enforced) unless the resolver grows a modifier field; the adjudicable axis is chip + gate + count.

## Notes (§70 advisory)
- 1-minute duration / obeys-duhr command chain / same-initiative-after ordering: no expiry clock exists for summon tokens app-wide (§84-class residual, same as MA-0648 twin).
- `uses:"1/Day"` string on `uses` is a data smell — should become numerics alongside any automation authoring.

## Recipe / pitfall (NEW)
- **PITFALL — `uses` STRING vs `usage` dict:** the ONLY place an `other`-type row's usage count is displayed is `usage` (formatActionUsage); a `"1/Day"` string living on `uses` renders NOTHING (not cosmetic, not gated). Check WHICH field carries the count before predicting counter text: §187 cosmetic `(1/Day)` only if `usage:{type:"per day",times:N}`; §205 total silence if count is on `uses` string.
- **RECIPE — solo zero-affordance probe:** inert summon/other rows need no victim; join monster alone, baseline `log` length via `/api/campaigns/:c/log`, fresh-rect `<strong>` click ×2 inside `.mc-overlay`, assert log len unchanged + no `.popup-overlay` + `mc-dice-link` count 0 scoped to the row found via `strong.startsWith(actionName)`.
