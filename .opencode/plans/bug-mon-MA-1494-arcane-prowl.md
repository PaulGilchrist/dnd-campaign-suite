# BUG MA-1494 — Sphinx of Lore Arcane Prowl (legendary_actions|0) — FAIL(b)/DATA

**Verdict: FAIL(b) — header-swallow.** Arcane Prowl renders as the swallowed economy header (`div.mc-action.mc-legendary-header-row` "Arcane Prowl (1 left)", `onclick:false`, zero links) and can never be pressed; its Claw half has ZERO affordance. The card's only legendary chip — the MA-1493-observed "Expend Legendary" — rides the **sibling** row Weight of Years and **silent-burns** the shared use with the MA-0510 console.error fingerprint. Exact MA-1456 (Shadow Dragon Pounce) / MA-1479 (Solar Blinking Gaze) twins.

## Row (verbatim)
```json
{"id":"MA-1494","stableKey":"sphinx-of-lore|legendary_actions|0","monsterIndex":"sphinx-of-lore","monster":"Sphinx of Lore","actionIndex":0,"actionType":"other","recharge":false,"uses":1,"description":"The sphinx can teleport up to 30 feet to an unoccupied space it can see, and it makes one Claw attack.","verified":"not verified"}
```

## Disk structure (public/data/monsters.json sphinx-of-lore.legendary_actions)
```json
[
 {"name":"Arcane Prowl","description":"...teleport up to 30 feet... makes one Claw attack.","uses":1,"recharge":false},
 {"name":"Weight of Years","description":"Constitution Saving Throw: DC 16 ...","uses":1,"recharge":false,"save_effect":"..."}
]
```
- NO header row; Arcane Prowl rows[0] carries `uses:1` ⇒ §99/§46 header-swallow armed.
- Arcane Prowl: NO `delegates_to`, NO numeric attack fields (Claw +8 / 3d6+4 Slashing / reach 5 ft. lives on actions[1]).
- Weight of Years rows[1]: prose DC 16 only, NO numeric `save_dc`/`save_type` ⇒ GenericSpend/Expend child, NOT the §110/§204 save-chip twin.

## Code fingerprint (source-confirmed, MA-1456 byte-shape)
- `legendaryHeaderAction` src/services/encounters/monsterLegendaryUses.js:152-153 — returns rows[0] whenever `rows[0].uses != null` ⇒ Arcane Prowl consumed AS header (max=1, authored on the swallowed child).
- src/components/encounter/MonsterCardBody.jsx:59-60 — `actions={s.actions.slice(1)}` when header truthy ⇒ only Weight of Years renders in the gated section; header = no-onClick `div.mc-legendary-header-row` (:249).
- Weight of Years child: `delegates_to:undefined`, no numeric ⇒ `resolveLegendaryRowMechanic` final else ⇒ console.error (MA-0510).

## Live ledger (Playwright, test-campaign header-verified, localhost)
Board: Sphinx of Lore 1 init29 hp170 + Bandit 1 init17 hp926 (Incapacitated from MA-1492) + full EB party. Bandit 1 armed on Sphinx own-card target-select (select value verified pre-press). Log baseline 36.

| Probe | Result |
|---|---|
| Card audit (legendary window, active=Bandit 1) | legendary section = `mc-legendary-header-row` "Arcane Prowl (1 left)" `onclick:false` `links:[]` + Weight of Years chip `.mc-dice-link-legendary` "Expend Legendary" title **"Expend 1 legendary use — Weight of Years"** — the MA-1493 chip rides the SIBLING, not Arcane Prowl |
| Arcane Prowl header click ×2 (fresh rects) | ZERO popup, ZERO log delta, counter unchanged — structurally unclickable |
| Own-turn press (pre-unstick) | refusal popup + `legendary_use_refused (own-turn)` — §418 frozen cs mirror (`activeCreatureName` stuck "Sphinx of Lore 1" while walker=`3:AasimarTest`→`4:Bandit 1`; mirror only stamped at round-wrap) — gate LIVE but window masked |
| §418 sanctioned unstick | full-store cs POST `{value:{...}}` setting `activeCreatureName`=walker-truth ("Bandit 1") only — round 4, window open |
| Expend press #1 (window open) | `ability_use` "expends a legendary use for **Weight of Years** after Bandit 1's turn — 0 of 1 left"; change-data `Sphinx of Lore 1.monsterLegendaryUses {max:1,used:1}`; counter "(0 left)"; **ZERO attack rolls, ZERO damage, ZERO hp_change (Bandit 926→926)** = MA-0510 silent burn |
| Console | exactly **1 error**: `[MonsterCardModal] legendary action "Weight of Years" delegates_to "undefined" — no resolvable mechanic on "Sphinx of Lore 1"` (MonsterCardModal.jsx:778) — MA-0510 fingerprint |
| Expend press #2 (exhausted) | refusal popup "no legendary uses left — regain at the start of Sphinx of Lore 1's turn" + `legendary_use_refused (exhausted)`; counter held {1,1}; zero spend/roll ✓ gate honest |
| Claw legs (nat+8 vs AC12, 3d6+4 Slashing) | **ZERO — never adjudicated**; no roll/hp_change attributable to Arcane Prowl (or the burning chip) all session |
| Teleport clause | §70 advisory (no grid token-move consumer) — moot; row never resolves |

## Economy honesty
Counter/refuse/regain machinery LIVE (spend log, exhausted + own-turn refusal tokens distinguish, round-wrap regain consumer present). Two residuals: (1) canonical total gap — 2024 Sphinx has **2** legendary actions; disk authors `uses:1` on each child and the swallowed header floors at 1 (§231/§202 gap-naming, fix max=2 = children count); (2) `_legendaryUses_usedRound` + `monsterLegendaryActionCooldowns` keys stamped on the Sphinx store by the inert burn.

## Fix (DATA, same-pass per §46; MA-0675/§168/MA-1204 template)
1. Insert canonical header rows[0]: `{"name":"Legendary Action Uses: 2","uses":2,"description":"The sphinx of lore takes 2 legendary actions..."}` (total = children count; lair_actions here are prose, no "(4 in Lair)" bump §231).
2. Arcane Prowl: add `delegates_to:"Claw"` → rides the delegate attack seam (resolveDelegates spans actions, monsterLegendaryUses.js:3-9; MA-0956 gynosphinx / MA-1057 kraken twins) — resolves +8 vs AC / 3d6+4 Slashing; teleport leg = §70 advisory residual (optionally advisory fields per MA-0957 seam).
3. Weight of Years: add numeric `save_dc:16` + `save_type:"Constitution"` (+ `dc_success:"none"`, exhaustion adjudication per family) so it rides the shared gate as a real save (§110/§204/§437 DC>0 gate); DROPPING its `uses` per §165 required with the header insert (double-economy MA-1089/§438).

## End-state (left LIVE for MA-1495)
Round 4, walker=4:Bandit 1, cs.activeCreatureName=Bandit 1 (unstick preserved); Sphinx hp170, Bandit hp926 Incapacitated; `Sphinx of Lore 1.monsterLegendaryUses {max:1,used:1}` (regain at Sphinx's next turn-start); log 40; overlays flushed; card closed.
