# MA-2063 — Ymir "Frost Geyser (Costs 2 Actions)": legendary save child spends 2 uses into a console.error dead-end

## Overview
Ymir legendary_actions[3] "Frost Geyser (Costs 2 Actions)" is a prose-only save
row: `delegates_to:null` with NO `save_dc`/`save_type`/`damage_dice_primary`/
`damage_type_primary`/`save_effect` fields. The DC 24 Dexterity save, 4d8 Cold
damage, 20 ft. radius point-target, and Restrained rider exist ONLY in the
description prose. The card renders a THIRD generic "Expend Legendary" chip (same
face as the honest Glacier Club/Stomp delegates, but with nothing behind it).
The MA-1883 cost lane parses "(Costs 2 Actions)" from the NAME and honestly
SPENDS 2 uses — then `resolveLegendaryRowMechanic` finds no numeric mechanic
(`extractDamageDiceFromDescription` needs a `Hit:/Failure:/Success:` prefix,
which this prose lacks), and the press dead-ends at
`MonsterCardModal.jsx:776` `console.error(... delegates_to "null" — no
resolvable mechanic ...)`. Zero popup, zero save prompt, zero roll, zero damage,
zero Restrained — for a two-wide legendary burn. MA-1974 silent-burn fingerprint,
worse because the honest cost parse doubles the burn width.

## Expected (row + disk truth)
Row MA-2063: "A pillar of ice erupts at a point within 90 ft. Each creature in a
20 ft. radius must succeed on a DC 24 Dexterity saving throw or take 18 (4d8)
Cold damage and be Restrained."
Disk (public/data/monsters.json:71921-71924): {name, delegates_to:null,
description} ONLY — all numeric/save/condition data prose-only, structured fields
all zero/absent.
Expected press: point-picker (90 ft., 20 ft. radius) → DC 24 DEX save per
creature in area → fail: 4d8 Cold + Restrained; success: half (engine default).

## Actual (live 2026-10-12, test-campaign)
- Census: chip = generic `span.mc-dice-link-legendary` "Expend Legendary"; NO
  save chip (contrast Glacier Wave row: "DC 26 Strength" + 14d10 chips).
  Chip title cosmetic: "Expend 1 legendary use — Frost Geyser (Costs 2 Actions)".
- Fresh boundary, pool 3: press → spend log "Ymir 1 spends 2 legendary uses for
  Frost Geyser (Costs 2 Actions) after AasimarTest's turn — 1 of 3 left",
  cd monsterLegendaryUses {max:3, used:2} — then console.error
  `[MonsterCardModal] legendary action "Frost Geyser (Costs 2 Actions)"
  delegates_to "null" — no resolvable mechanic on "Ymir 1"` (:776).
  Zero popup, zero save roll, Bandit hp unchanged 11/11, zero hp_change entries.
- Same-boundary re-press: honest zero-spend refusal (turn) — latch intact.
- Fresh boundary at pool 1: honest refusal popup+log
  "insufficient-cost: costs 2, 1 left" — name-parse cost lane works even with
  zero structured fields; zero spend.
- Own-turn regain: canonical "regains all expended legendary action uses — 3
  available" at 2:Ymir 1, used→0.
Verdict: FAIL(b)/DATA — spends for nothing (2-wide burn per press).

## Steps to Reproduce
1. :5173 → test-campaign → Encounters → join Ymir (1) + Bandit (1).
2. Initiative → walk to any non-Ymir turn boundary (unstick frozen cs mirror via
   full-store POST /combatSummary if refusals read stale).
3. Open Ymir card → Frost Geyser row → click "Expend Legendary".
4. Observe: 2 legendary uses spent (card header "(1 left)"), no popup/roll/log
   of any save or damage; console shows the :776 dead-end error.
5. Press again same boundary → "(turn)" refusal; at pool 1 fresh boundary →
   "insufficient-cost" refusal (both honest, zero spend).

## Likely Location
monsters.json data drift (prose-only legendary child, MA-1974/MA-2054 family).
Consumer seam that dead-ends: MonsterCardModal.jsx `resolveLegendaryRowMechanic`
:776 (final else console.error); cost lane (monsterLegendaryUses.js
legendaryActionCost/expendLegendaryUse :388-415) is honest and NOT the defect.

## Notes — full fix (MA-2059 save family / Scylla Shriek MA-1982 byte-shape)
Author the structured fields on the row:
```json
{
  "name": "Frost Geyser (Costs 2 Actions)",
  "delegates_to": null,
  "save_dc": 24,
  "save_type": "Dexterity",
  "damage_dice_primary": "4d8",
  "damage_type_primary": "Cold",
  "range": "90 ft.",
  "save_effect": "The target has the Restrained condition.",
  "description": "A pillar of ice erupts at a point within 90 ft. Each creature in a 20 ft. radius must succeed on a DC 24 Dexterity saving throw or take 18 (4d8) Cold damage and be Restrained. Success: half damage."
}
```
- Save rows word-scan `save_effect` ONLY for conditions — Restrained must be
  authored there or it is never granted (§111; MA-2026 flat-conditions-no-consumer
  twin). Half-on-success is engine default (`dc_success ?? 'half'`).
- "Costs N Actions" enforcement is already live via name-parse — no new field.
- Picker arming: prose save-lane parsing opens the sp-modal (§211 correction,
  MA-2033/MA-2059); range field rides the child; 20 ft. radius adjudication may
  stay GM-noted until a radius-shape consumer exists.
- Cosmetic: chip title hardcodes "Expend 1 legendary use" for costs-2 rows
  (MA-2060 census) — render parsed cost N in the title.
- Minimal alternative (MA-2012 shape): `advisory` + `advisory_message` honest
  record — but full struct is preferred since a live save lane exists.
- After monsters.json edit: admin-clear cd+log → reload → re-select → EB re-join
  → reopen card; re-verify picker opens, DC 24 Dex rolls, 4d8 Cold half-on-success.
