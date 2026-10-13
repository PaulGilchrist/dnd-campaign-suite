# MA-2072 — Ziz "Sky Screech (Costs 2 Actions)": legendary save child spends 2 uses into a console.error dead-end

## Overview
Ziz legendary_actions[3] "Sky Screech (Costs 2 Actions)" is a prose-only save
row: `delegates_to:null` with NO `save_dc`/`save_type`/`damage_dice_primary`/
`damage_type_primary`/`save_effect` fields. The DC 23 Wisdom save, 7 (2d6)
Thunder damage, 60 ft. radius, and Prone rider exist ONLY in the description
prose; the manifest's `conditions:["prone"]` is generator prose-scan metadata,
NOT a runtime field. The card renders a generic "Expend Legendary" chip with
nothing behind it. The MA-1883 cost lane parses "(Costs 2 Actions)" from the
NAME and honestly SPENDS 2 uses — then `resolveLegendaryRowMechanic` finds no
numeric mechanic (`extractDamageDiceFromDescription` needs a Hit:/Failure:/
Success: prefix, which this prose lacks), and the press dead-ends at
`MonsterCardModal.jsx:776` `console.error(... delegates_to "null" — no
resolvable mechanic ...)`. Zero popup, zero save prompt, zero roll, zero damage,
zero Prone — for a two-wide legendary burn. Exact MA-2063 (Ymir Frost Geyser)
/ MA-1990/1991 (Simurgh) silent-burn twin; MA-1974 fingerprint.

## Expected (row + disk truth)
Row MA-2072: "Enemies within 60 ft. must succeed on a DC 23 Wisdom saving
throw or take 7 (2d6) Thunder damage and be knocked Prone."
Disk (public/data/monsters.json, Ziz legendary_actions[3]):
{name:"Sky Screech (Costs 2 Actions)", delegates_to:null, description} ONLY.
Expected press: enemies within 60 ft. (picker or inline all) → DC 23 WIS save
per creature → fail: 2d6 Thunder + Prone; success: half (engine default).

## Actual (live 2026-10-12, test-campaign, round 4)
- Census: chip = generic `span.mc-dice-link-legendary` "Expend Legendary"; NO
  save chip (contrast Solar Flare row on same card: "DC 24 Constitution" +
  9d10 chips live). Chip title cosmetic: "Expend 1 legendary use — Sky Screech
  (Costs 2 Actions)" (MA-2060 costs-2 title hardcode).
- Own-turn-start press after regain: honest refusal "expends legendary uses
  after ANOTHER creature's turn, not its own. Nothing spent" — zero spend.
- Legal fresh boundary (active=Bandit 1, pool 3, mirror unstuck via full-store
  POST /combatSummary — frozen cs mirror gave a false "not its own" refusal
  first, MA-1990 pitfall live): press → spend log "Ziz 1 spends 2 legendary
  uses for Sky Screech (Costs 2 Actions)" (ability_use), cd
  monsterLegendaryUses {max:3, used:0→2} — then console.error
  `[MonsterCardModal] legendary action "Sky Screech (Costs 2 Actions)"
  delegates_to "null" — no resolvable mechanic on "Ziz 1"` (:776).
  Zero popup, zero save roll, zero saveResult-* key, Bandit hp unchanged
  344/344, zero hp_change entries, no Prone grant.
- Same-boundary re-press: honest zero-spend refusal (once-per-boundary latch,
  "Only one legendary action ... Nothing spent, no roll") — used stays 2.
- Fresh boundary at pool 1 (active=AasimarTest): honest refusal popup+log
  "costs 2 legendary uses but Ziz 1 has only 1 left — they regain at the
  start of Ziz 1's turn" — zero spend. Costs lane fully honest even with
  zero structured fields.
Verdict: FAIL(b)/DATA — spends for nothing (2-wide burn per press).

## Steps to Reproduce
1. :5173 → test-campaign → Encounters → join Ziz (1) + Bandit (1) (board may
   already carry Ziz 1 + victims).
2. Initiative → walk to any non-Ziz post-turn boundary; unstick frozen cs
   mirror via full-store POST /api/campaigns/test-campaign/combatSummary
   {value:{...cs, activeCreatureName:<truth>}} if refusals read stale.
3. Open Ziz card → Sky Screech row → click "Expend Legendary".
4. Observe: 2 legendary uses spent (header "(1 left)"), console shows the
   :776 dead-end error; no popup/roll/save/damage/Prone anywhere.
5. Re-press same boundary → latch refusal; at pool-1 fresh boundary →
   "insufficient-cost" refusal (both honest, zero spend).

## Likely Location
monsters.json data drift (prose-only legendary child, MA-1974/MA-2054/
MA-2063 family). Consumer seam that dead-ends: MonsterCardModal.jsx
`resolveLegendaryRowMechanic` :776 (final else console.error); cost lane
(monsterLegendaryUses.js legendaryActionCost/expendLegendaryUse) is honest
and NOT the defect.

## Notes — full fix (MA-2059 save family / MA-2063 byte-shape)
Author the structured fields on the row:
```json
{
  "name": "Sky Screech (Costs 2 Actions)",
  "delegates_to": null,
  "save_dc": 23,
  "save_type": "Wisdom",
  "damage_dice_primary": "2d6",
  "damage_type_primary": "Thunder",
  "save_effect": "The target has the Prone condition."
}
```
- Save rows word-scan `save_effect` ONLY for conditions — Prone must be
  authored there or it is never granted (§111/§567 MA-2059 bait; flat
  manifest conditions are prose-derived, §346 description never word-scanned).
- "Costs N Actions" enforcement already live via name-parse — no new field.
- Picker shape noun: "Enemies within 60 ft" — no radius/line/cone noun →
  prose picker parsing will not open an sp-modal (MA-2033 opens only on
  recognized shapes); author it inline-lane (MA-2041 inline lane) — the
  structured fields above route handleSaveRoll inline. Add `range:"60 ft."`
  if an area consumer is later taught the 60-ft-round shape.
- Cosmetic: chip title hardcodes "Expend 1 legendary use" for costs-2 rows
  (MA-2060) — render parsed cost N.
- After monsters.json edit: admin-clear cd+log → reload → re-select → EB
  re-join → reopen card; re-verify DC 23 WIS rolls, 2d6 Thunder
  half-on-success, Prone granted on fail.
