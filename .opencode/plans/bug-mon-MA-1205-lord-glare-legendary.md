# Bug: MA-1205 Mummy Lord Glare — legendary rows[1] prose child, delegates_to undefined, Expend chip BURNS pool on inert row (§5/§99/MA-0696/MA-1204 fingerprint)

## Overview
MA-1205 (mummy-lord legendary_actions[1] "Glare") is a silent-burn legendary row, reproduced fresh-board 2026-09-25. Disk authors the child as prose-only: `name/description/uses:1/recharge:false` — **no `delegates_to`, no numeric `save_dc`/`save_type`/dice** (full Dreadful Glare numerics live ONLY in `actions[3]`). The card still arms a clickable `span.mc-dice-link-legendary` "Expend Legendary" chip; pressing it spends the shared pool (1→0) and dies in `resolveLegendaryRowMechanic` with console.error "no resolvable mechanic" — zero save, zero damage, zero Paralyzed. The row can NEVER adjudicate its RAW Glare. Same session confirms the swallowed-header counter is max **1** vs RAW **3** legendary actions (header-swallow cross-ref bug-mon-MA-1204: rows[0] "Dread Command" renders as the `div.mc-legendary-header-row`, interactive count 0). Economy gate itself is LIVE: second press refuses honestly (exhausted), turn-start regain restores.

## Expected (manifest row, quoted)
> "id": "MA-1205", "monsterIndex": "mummy-lord", "actionIndex": 1, "category": "legendary_actions", "actionName": "Glare", "actionType": "other", "uses": 1,
> "description": "The mummy uses Dreadful Glare. The mummy can't take this action again until the start of its next turn."

RAW: "uses Dreadful Glare" must adjudicate the Dreadful Glare save per disk `actions[3]` (quoted):
> "name": "Dreadful Glare", "save_dc": 17, "save_type": "Wisdom", "damage_dice_primary": "6d6 + 4", "damage_type_primary": "Psychic", "save_effect": "The target takes 25 (6d6 + 4) Psychic damage and has the Paralyzed condition until the end of the mummy's next turn."

Per §5/§168 legendary-economy pattern (MA-0620/MA-0956 verified templates): rows[0] canonical header `{name:"Legendary Action Uses: N", uses:N}` + child with `delegates_to:"Dreadful Glare"` (resolveDelegates spans actions[], monsterLegendaryUses.js) — chip then spends the pool AND adjudicates the delegated save vs the armed target.

## Disk truth (public/data/monsters.json, mummy-lord)
```json
"legendary_actions[1]": {
  "name": "Glare",
  "description": "The mummy uses Dreadful Glare. The mummy can't take this action again until the start of its next turn.",
  "uses": 1,
  "recharge": false
}
```
No `delegates_to`. No numeric fields. All numerics (DC 17 Wisdom, 6d6+4 Psychic, Paralyzed) exist only on `actions[3]` Dreadful Glare.

## Actual (live, test-campaign, header verified, fresh cleared board)
- **Board:** EB exact td[1]==='Mummy Lord' (CR15/13,000/Desert discriminator, 1 row) native cb.click() checked=true first try → cs "Mummy Lord 1" AC17 HP187 idx mummy-lord; victim Bandit via +NPC autocomplete li textContent==='Bandit' exact, Escape+blur (§487), TRUSTED HP fill 999 (§454, maxHp authored 11 §446). Baseline log=2 (join-noise), change-data Mummy Lord 1 had NO monsterLegendaryUses key.
- **Legendary section DOM census (`.mc-overlay`, card open):**
  - `div.mc-action.mc-legendary-header-row` — text "Dread Command (1 left) The mummy casts Command (level 2 version)…" — interactive `a/button/[role=button]/.mc-dice-link` count **0** (header-swallow, pool max 1).
  - "Glare. Expend Legendary…(false)" row — exactly ONE `span.mc-dice-link-legendary` "Expend Legendary" (+ cosmetic `(false)` recharge-false artifact).
  - "Necrotic Strike. Expend Legendary…(false)" row — one Expend chip (sibling).
  - Dreadful Glare ACTION row (actions[3], separate lane): '+0' junk + '6d6 + 4' auto-damage trap (never pressed §409/525) + 'DC 17 Wisdom' `mc-dice-link-save-clickable` — NOT pressed: that is the action lane (MA-1201 PASS twin), legendary chip does NOT route there (§204 save-chip XOR legend-expend; no correct path exists for the legendary row itself).
- **Press 1 (real pointer, fresh rect 807.5/447.6, first click fired):** `ability_use` log "Mummy Lord 1 expends a legendary use for Glare after AasimarTest's turn — 0 of 1 left"; change-data `Mummy Lord 1.monsterLegendaryUses {max:1, used:1}` — pool **burned 1→0**; header re-renders "Dread Command (0 left)". **ZERO adjudication:** no popup, zero save roll, zero save-damage, zero hp_change, zero condition entries (whole-log saveEntries=0, conditionEntries=0).
- **Console error (verbatim, 1 total):** `[MonsterCardModal] legendary action "Glare" delegates_to "undefined" — no resolvable mechanic on "Mummy Lord 1"` @ src/components/encounter/MonsterCardModal.jsx:777 (resolveLegendaryRowMechanic fallback — MA-1204 same-line live fingerprint).
- **Press 2 (same window, exhausted):** popup "Legendary Action Refused — Glare: Mummy Lord 1 has no legendary uses left — they regain at the start of Mummy Lord 1's turn. Nothing spent, no roll." + automation log "Mummy Lord 1 Glare legendary action refused (exhausted) — zero spend, no roll." Counter held {max:1, used:1}. Gate LIVE.
- **Turn-start regain LIVE:** initiative walk (native Next clicks, §466/§31 polling; round wrapped 1→2) to `__initiative__.lastAppliedTurnStartCreature === 'Mummy Lord 1'` → `ability_use` "Mummy Lord 1 regains all expended legendary action uses at the start of its turn — 1 available.", uses {max:1, used:0} (turnStartEffects consumer wired — merely unreached by any mechanic on this row).
- **Correct-path check:** Glare legendary child has NO alternate affordance — the row renders only the Expend chip; the DC 17 Wisdom chip belongs to the actions[3] Dreadful Glare row (non-legendary lane). So no press combination spends-AND-adjudicates. Burn-on-inert = FAIL(a).

## Steps
1. :5173, select **test-campaign** (header verified); board cleared baseline log=[] cd={} cs null.
2. Encounters → search "Mummy Lord" → 1 row td[1]==='Mummy Lord' CR15/13,000/Desert → native cb.click() checked=true → Join Encounter.
3. Initiative → +NPC → `.monster-autocomplete-input` → type "Bandit" → click li textContent==='Bandit' → Escape+blur → TRUSTED fill HP input 999+Enter.
4. Native `el.click()` on `img.avatar-image[alt='Mummy Lord 1']` → card census: legendary header "Dread Command (1 left)" non-interactive div; Glare row ONE Expend chip.
5. Real-pointer fresh-rect click on Glare "Expend Legendary" → counter "(1 left)"→"(0 left)", `{max:1,used:1}`, zero adjudication, console.error captured.
6. Re-press same chip → "Legendary Action Refused" popup + `legendary_use_refused (exhausted)` log, counter held.
7. Walk initiative (native Next, poll `__initiative__`) to Mummy Lord 1 turn-start → regain log, counter "(1 left)".

## Likely Location
- **DATA (primary):** `public/data/monsters.json` mummy-lord `legendary_actions[1]` — prose-only child with no mechanic. Fix = `delegates_to:"Dreadful Glare"` so resolveDelegates resolves the actions[3] save (DC 17 Wisdom, 6d6+4 Psychic, Paralyzed) through the shared legendary gate (MA-0956 gynosphinx Claw / MA-1057 kraken byte-templates).
- **SAME PASS (§165):** header-swallow — canonical header `{name:"Legendary Action Uses: 3", uses:3}` must be inserted at rows[0] and per-child `uses` dropped, else the chip rides the swallowed Dread Command counter max 1 vs RAW 3 (cross-ref bug-mon-MA-1204; §5 header+children MUST be fixed same pass). Note disk `legendary_resistance:3` and description "(3/Day, or 4 in Lair)" family — honest-gap name it per MA-0675/MA-1057 (CR twins stamp numeric 3).
- **CODE (not required for this fix):** `monsterLegendaryUses.js` header selector + `MonsterCardModal.jsx:777` resolveLegendaryRowMechanic console dead-end are working as designed on bad data; no code change needed once `delegates_to` authored (delegated legendary chip lands FIRST click per MA-0956/MA-0675 census).

## Notes
- Evidence is the row's OWN repro (fresh board), matching MA-1204's secondary-axis observation byte-for-byte: same console line :777, same `{max:1, used:1}` burn shape, same exhausted refusal token, same regain consumer log text.
- §98 re-confirmed: burn latch stamp reads "after AasimarTest's turn" (active creature at click, not attacker).
- Pool arithmetic defect rides the same fix: RAW Mummy Lord = 3 legendary actions; current pool 1 (swallowed child uses:1).
- Cosmetic `(false)` recharge-false artifact on legendary child rows (MA-1204 family) — not a defect axis.
- Session ledger: console exactly 1 error (the burn); press ledger 2 clicks → 1 spend + 1 refusal (1:1 by log, §442/§488); zero save/damage/condition entries whole-log; Bandit survived at 999 (no damage ever).
- Manifest `uses:1` byte-matches disk child; RAW pool-3 gap is the header omission (MA-1204 axis), quoted for the same-pass fix.
