# Bug: MA-1206 Mummy Lord Necrotic Strike — legendary rows[2] prose WEAPON child, delegates_to undefined, Expend chip BURNS pool on inert row (§5/MA-1205/MA-1204 fingerprint)

## Overview
MA-1206 (mummy-lord legendary_actions[2] "Necrotic Strike") is a silent-burn legendary row, reproduced fresh-board 2026-09-25. Disk authors the child as prose-only: `name/description/uses:1/recharge:false` — **no `delegates_to`, no numeric `attack_bonus`/dice** (all "+9 to hit" numerics live ONLY on `actions[1]` Rotting Fist / `actions[2]` Channel Negative Energy). The card still arms a clickable `span.mc-dice-link-legendary` "Expend Legendary" chip; pressing it spends the shared pool (1→0) and dies in `resolveLegendaryRowMechanic` with console.error "no resolvable mechanic" — zero attack roll, zero damage, zero hp_change vs the armed Bandit. The row can NEVER adjudicate its RAW "one Rotting Fist or Channel Negative Energy attack". Same session re-confirms the swallowed-header pool max **1** vs RAW **3** (header-swallow cross-ref bug-mon-MA-1204: rows[0] "Dread Command" renders as the non-interactive `div.mc-legendary-header-row`, interactive count 0). Economy gate itself is LIVE: second press refuses honestly (exhausted), own-turn-start regain restores.

## Expected (manifest row, quoted)
> "id": "MA-1206", "monsterIndex": "mummy-lord", "actionIndex": 2, "category": "legendary_actions", "actionName": "Necrotic Strike", "actionType": "other", "uses": 1,
> "description": "The mummy makes one Rotting Fist or Channel Negative Energy attack."

RAW: the legendary press must adjudicate ONE delegated weapon attack vs the armed target. Delegated weapons' disk numbers (public/data/monsters.json mummy-lord):
> actions[1] Rotting Fist: `"attack_bonus": 9, "reach": "5 ft.", "damage_dice_primary": "2d10 + 4", "damage_type_primary": "Bludgeoning", "damage_dice_secondary": "3d6", "damage_type_secondary": "Necrotic"` (+ cursed target HP-max drain rider)
> actions[2] Channel Negative Energy: `"attack_bonus": 9, "range": "60 ft.", "damage_dice_primary": "6d6 + 4", "damage_type_primary": "Necrotic"`

Per §5/§168 legendary-economy pattern (MA-0956 gynosphinx / MA-1057 kraken byte-templates): rows[0] canonical header `{name:"Legendary Action Uses: N", uses:N}` + child with `delegates_to:"<Weapon>"` (resolveDelegates spans actions[], monsterLegendaryUses.js:7-9) — chip then spends the pool AND adjudicates the delegated attack (+9 to-hit roll, weapon damage) vs the armed target.

## Disk truth (public/data/monsters.json, mummy-lord, verbatim)
```json
"legendary_actions[2]": {
  "name": "Necrotic Strike",
  "description": "The mummy makes one Rotting Fist or Channel Negative Energy attack.",
  "uses": 1,
  "recharge": false
}
```
No `delegates_to`. No numeric attack_bonus/dice. Whole legendary block carries per-child `uses:1` on all three children (header-swallow axis, MA-1204).

## Actual (live, test-campaign, header verified "test-campaign", fresh cleared board)
- **Board:** EB exact td[1]==='Mummy Lord' (CR15/13,000/Desert discriminator, 1 row) native cb.click() checked=true first try → Join Encounter → cs "Mummy Lord 1" AC17 HP187; victim Bandit via +NPC fresh-row scoped autocomplete li textContent==='Bandit' exact, Escape+blur (§487), TRUSTED HP fill 999 (§454, maxHp authored 11 §446). Baseline log=2 (join-noise: encounter + initiative roll), change-data had NO monsterLegendaryUses key.
- **Legendary section DOM census (`.mc-overlay`, card open):**
  - `div.mc-action.mc-legendary-header-row` — text "Dread Command (1 left) The mummy casts Command (level 2 version)…" — interactive `a/button/[role=button]/.mc-dice-link` count **0** (header-swallow, pool max 1 vs RAW 3).
  - "Necrotic Strike. Expend Legendary…(false)" row — exactly ONE `span.mc-dice-link-legendary` "Expend Legendary", computedStyle `display:inline-block visibility:visible opacity:1` (§448 poll-computed not offsetParent) + cosmetic `(false)` recharge-false artifact.
- **Press 1 (real pointer, fresh rect x=801.16 y=437.30 w=128.46 h=19.75):** `ability_use` log "Mummy Lord 1 expends a legendary use for Necrotic Strike after AasimarTest's turn — 0 of 1 left (regain at the start of Mummy Lord 1's turn; 4 in lair advisory)."; change-data `Mummy Lord 1.monsterLegendaryUses {max:1, used:1}` — pool **burned 1→0**; header re-renders "Dread Command (0 left)". **ZERO adjudication:** no popup, zero attack/to-hit roll (+9 never rolled), zero damage entry, Bandit held 999/11 AC12 untouched, zero condition entries (§442/§488 log-delta: baseline 2 → 3 = spend only).
- **Console error (verbatim, exactly 1 total):** `[MonsterCardModal] legendary action "Necrotic Strike" delegates_to "undefined" — no resolvable mechanic on "Mummy Lord 1"` @ http://localhost:5173/src/components/encounter/MonsterCardModal.jsx?t=1790353511697:777 (resolveLegendaryRowMechanic fallback — MA-1205/MA-1204 same-line live fingerprint; source line :602).
- **Press 2 (same window, exhausted):** popup "Legendary Action Refused — Necrotic Strike: Mummy Lord 1 has no legendary uses left — they regain at the start of Mummy Lord 1's turn. Nothing spent, no roll." + automation log "Mummy Lord 1 Necrotic Strike legendary action refused (exhausted) — zero spend, no roll." Counter held {max:1, used:1}. Gate LIVE.
- **Turn-start regain LIVE:** initiative walk (native Next, poll change-data; round wrapped 1→2, lastApplied "2:Mummy Lord 1" at step 15 of walk) → `ability_use` "Mummy Lord 1 regains all expended legendary action uses at the start of its turn — 1 available.", uses {max:1, used:0} (turnStartEffects.js consumer wired — merely unreached by any mechanic on this row).
- **Correct-path check:** the row renders ONLY the Expend chip; no picker, no auto-first alternative ever offered ("or" alternative moot — nothing adjudicates). Burn-on-inert = FAIL(a).

## Steps
1. :5173, select **test-campaign** (header verified); board cleared baseline log=[] cd={} cs null.
2. Encounters → search "Mummy Lord" → 1 row td[1]==='Mummy Lord' CR15/13,000/Desert → native cb.click() checked=true → Join Encounter.
3. Initiative → +NPC → fresh "NPC 1" row `.monster-autocomplete-input` (scope by value; do NOT use textContent card match — Target dropdowns mention every creature name) → type "Bandit" → click li textContent==='Bandit' → Escape+blur → TRUSTED fill Bandit current-HP input 999+Enter (Bandit AC12 HP11→999).
4. Native `el.click()` on `img.avatar-image[alt='Mummy Lord 1']` → card census: legendary header "Dread Command (1 left)" non-interactive div; Necrotic Strike row ONE Expend chip (computedStyle visible).
5. Real-pointer fresh-rect click on Necrotic Strike "Expend Legendary" → counter "(1 left)"→"(0 left)", `{max:1,used:1}`, zero attack/damage/hp entries, console.error captured verbatim.
6. Re-press same chip → "Legendary Action Refused" popup + `refused (exhausted)` log, counter held.
7. Walk initiative (native Next, poll change-data) to Mummy Lord 1 turn-start (round 2) → regain log, `{max:1,used:0}`.

## Likely Location
- **DATA (primary):** `public/data/monsters.json` mummy-lord `legendary_actions[2]` — prose WEAPON child with no mechanic. Fix = `delegates_to:"Rotting Fist"` (honest first-listed of the "or"; or "Channel Negative Energy") so resolveDelegates (monsterLegendaryUses.js:7-9) resolves the actions[1]/[2] attack (+9, 2d10+4 Bludgeoning +3d6 Necrotic / 6d6+4 Necrotic) through the shared legendary gate (MA-0956 gynosphinx Claw / MA-1057 kraken byte-templates).
- **SAME PASS (§165/§5):** header-swallow — canonical header `{name:"Legendary Action Uses: 3", uses:3}` must be inserted at rows[0] and per-child `uses` dropped, else the chip rides the swallowed Dread Command counter max 1 vs RAW 3 (cross-ref bug-mon-MA-1204; children+header MUST be fixed same pass). Glare sibling fix: `delegates_to:"Dreadful Glare"` (bug-mon-MA-1205).
- **CODE (not required for this fix):** `MonsterCardModal.jsx:777` (bundle; source :602) resolveLegendaryRowMechanic console dead-end works as designed on bad data; no code change needed once `delegates_to` authored (delegated legendary chip lands FIRST click per MA-0956/MA-1205 census).

## Notes
- Evidence is the row's OWN repro (fresh board), matching MA-1205 (Glare) and MA-1204 (Dread Command) byte-for-byte: same console line :777 `delegates_to "undefined"`, same `{max:1, used:1}` burn shape, same exhausted refusal token, same regain consumer log text, same max-1-vs-RAW-3 pool.
- §98 re-confirmed: burn latch stamp reads "after AasimarTest's turn" (active creature at click, not attacker).
- "or" alternative behavior: NO picker is offered and NOTHING adjudicates — the "one Rotting Fist or Channel Negative Energy" choice is unreachable; fix must pick the delegated weapon honestly (first-listed Rotting Fist recommended; second-weapon alternative stays GM-enforced unless a picker ships).
- Pool arithmetic defect rides the same fix: RAW Mummy Lord = 3 legendary actions; current pool 1 (swallowed child uses:1); lair advisory "(4 in lair)" appears in spend log text.
- Cosmetic `(false)` recharge-false artifact on legendary child rows (MA-1204/1205 family) — not a defect axis.
- Session ledger: console exactly 1 error (the burn); press ledger 2 clicks → 1 spend + 1 refusal (1:1 by log, §442/§488); zero attack/damage/condition entries whole-log; Bandit survived at 999 (no damage ever). Rig incident noted: first HP-fill attempt hit Mummy Lord via loose `.creature-card.npc` textContent match (Target dropdown mentions "Bandit") — corrected to 187 by card-scoped re-fill; self-verified cs byte-state before presses.
- Manifest `uses:1` byte-matches disk child; RAW pool-3 gap is the header omission (MA-1204 axis), quoted for the same-pass fix.
