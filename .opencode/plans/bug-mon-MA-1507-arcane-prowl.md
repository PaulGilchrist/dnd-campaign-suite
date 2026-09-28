# BUG MA-1507 — Sphinx of Valor Arcane Prowl (legendary_actions|0) — FAIL(b)/DATA

**Verdict: FAIL(b) — header-swallow.** Exact MA-1494 (sphinx-of-lore) twin, byte-identical disk shape, reproduced live 2026-09-28: Arcane Prowl renders as the swallowed economy header (`div.mc-action.mc-legendary-header-row` "Arcane Prowl (1 left)", `onclick:false`, zero links) and can never be pressed; its Claw half (+12, 4d6+6 Slashing — fields live on actions[1]) has ZERO affordance. The card's only legendary chip — `.mc-dice-link-legendary` "Expend Legendary", title **"Expend 1 legendary use — Weight of Years"** — rides the **sibling** row Weight of Years and **silent-burns** the shared use with the MA-0510 console.error fingerprint. Twins: MA-1494 (Arcane Prowl, sphinx-of-lore), MA-1456 (Shadow Dragon Pounce), MA-1479 (Solar Blinking Gaze).

## Row (verbatim)
```json
{"id":"MA-1507","stableKey":"sphinx-of-valor|legendary_actions|0","monsterIndex":"sphinx-of-valor","monster":"Sphinx of Valor","actionIndex":0,"actionType":"other","recharge":false,"uses":1,"description":"The sphinx can teleport up to 30 feet to an unoccupied space it can see, and it makes one Claw attack.","verified":"not verified"}
```

## Disk structure (public/data/monsters.json sphinx-of-valor.legendary_actions — MA-1494 byte-twin)
```json
[
 {"name":"Arcane Prowl","description":"...teleport up to 30 feet... makes one Claw attack.","uses":1,"recharge":false},
 {"name":"Weight of Years","description":"Constitution Saving Throw: DC 16 ...","uses":1,"recharge":false,"save_effect":"..."}
]
```
- NO header row; Arcane Prowl rows[0] carries `uses:1` ⇒ §46/§99 header-swallow armed (`legendaryHeaderAction` monsterLegendaryUses.js:154 takes rows[0] on `uses!=null`).
- Arcane Prowl: NO `delegates_to`, NO numeric attack fields (Claw +12 / reach 5 ft. / 4d6+6 Slashing live on actions[1]).
- Weight of Years rows[1]: prose DC 16 only, NO numeric `save_dc`/`save_type` ⇒ GenericSpend/Expend child, MA-0510 silent-burn armed (real save chip would need §110/§204 numeric pair — that's MA-1508's row).

## Code fingerprint (source re-confirmed same session)
- `legendaryHeaderAction` src/services/encounters/monsterLegendaryUses.js:152-156 — rows[0].uses!=null ⇒ Arcane Prowl consumed AS header (max=1, authored on the swallowed child).
- src/components/encounter/MonsterCardBody.jsx:60 `actions={s.actions.slice(1)...}` ⇒ only Weight of Years renders in the gated section; header = plain no-onClick `div.mc-legendary-header-row` (:249).
- Weight of Years child: `delegates_to:undefined`, no numeric ⇒ `resolveLegendaryRowMechanic` final else ⇒ console.error (MA-0510), MonsterCardModal.jsx:778.

## Live ledger (Playwright, test-campaign header-verified, localhost:5173 dev reuse, no API-mutation POSTs)
Fresh EB re-join (initiative was cleared post-MA-1506): Sphinx of Valor 1 init19 hp199/199 + Bandit 1 init9 hp11/11 + PC placeholders, round 1. Bandit 1 armed on Valor's OWN-card target-select (verified "Bandit 1" pre-press and persisted). Log baseline 3 (join + 2 initiative rolls). Window open: cs.activeCreatureName=AasimarTest (walker past Valor init19 + Bandit init9 mid-join).

| Probe | Result |
|---|---|
| Card audit (legendary window) | legendary section = `mc-legendary-header-row` "Arcane Prowl (1 left)" `onclick:false` `links:[]` + Weight of Years chip `.mc-dice-link-legendary` "Expend Legendary" title "Expend 1 legendary use — **Weight of Years**" — chip rides the SIBLING, not Arcane Prowl (MA-1494 live zero-affordance twin) |
| Arcane Prowl header press ×2 (fresh rects, playwright click) | ZERO popup, ZERO log delta (log 3→3), ZERO console errors, counter "(1 left)" unchanged — structurally unclickable (§99 harder-zero) |
| Expend press #1 (window open, active=AasimarTest) | `ability_use` "Sphinx of Valor 1 expends a legendary use for **Weight of Years** after AasimarTest's turn — 0 of 1 left"; change-data `Sphinx of Valor 1.monsterLegendaryUses {max:1,used:1}` + `_legendaryUses_usedRound {round:1,activeCreature:"AasimarTest"}` (§98 latch stamps ACTIVE creature, not the monster) + `monsterLegendaryActionCooldowns.weight_of_years`; header counter → "(0 left)"; **Bandit hp 11→11, ZERO attack rolls, ZERO damage, ZERO hp_change** = MA-0510 silent burn |
| Console | exactly **1 error**: `[MonsterCardModal] legendary action "Weight of Years" delegates_to "undefined" — no resolvable mechanic on "Sphinx of Valor 1"` (MonsterCardModal.jsx:778) — MA-0510 fingerprint, same line as MA-1494 |
| Expend press #2 (exhausted) | refusal popup "Legendary Action Refused — no legendary uses left — regain at the start of Sphinx of Valor 1's turn. Nothing spent, no roll." + `automation` `legendary_use_refused (Weight of Years)`; counter held {1,1}; zero spend ✓ gate honest |
| Claw legs (nat+12 vs AC12, 4d6+6 Slashing) | **ZERO — never adjudicated**; only `roll` entries all session = 2 join initiative rolls; no hit/damage/hp_change attributable to Arcane Prowl or the burning chip |
| Teleport clause | §70 advisory (no grid token-move consumer) — moot; row never resolves |

## HP999 note
Victim-max staging via UI spinbutton clamps at maxHp 11 (input echoed 999, cs held 11/11); sanctioned §181/§418 full-store cs POST forbidden this session — moot: zero damage was dealt and none possible (row has no affordance; chip burns without rolling).

## Economy honesty
Counter/refuse/regain machinery LIVE: spend log, exhausted refusal token distinguish gate-vs-dead, round-wrap regain consumer present. Residuals (same as MA-1494): (1) canonical total gap — 2024 Sphinx of Valor takes **2** legendary actions (registry MA-1500/MA-1501 note "Roar 3/Day inert-as-authored" family); disk authors `uses:1` on each child and the swallowed header floors at max:1 (§202/§231 gap-naming; fix total = children count = 2); (2) `_legendaryUses_usedRound` + `monsterLegendaryActionCooldowns` keys stamped on the Sphinx store by the inert burn.

## Fix (DATA, same-pass per §46; MA-0675/§168/MA-0956 template — identical to MA-1494)
1. Insert canonical header rows[0]: `{"name":"Legendary Action Uses: 2","uses":2,"description":"The sphinx of valor takes 2 legendary actions, choosing from the options below. Only one legendary action can be used at a time and only at the end of another creature's turn."}` (total = children count; no lair_actions on this monster — plain numeric, no "(4 in Lair)" bump §231).
2. Arcane Prowl: add `delegates_to:"Claw"` → rides the delegate attack seam (resolveDelegates spans actions, monsterLegendaryUses.js:3-9; MA-0956 gynosphinx twin) — resolves +12 vs AC / 4d6+6 Slashing; teleport leg = §70 advisory residual.
3. Weight of Years: add numeric `save_dc:16` + `save_type:"Constitution"` (+ `dc_success:"none"`) so it rides the shared gate as a real save (§110/§204), and DROP its `uses` per §165 required with the header insert (double-economy MA-1089/§438).

## Evidence
- Screenshot: `.opencode/plans/ma1507-arcane-prowl-header-swallow.png`
- Checkpoint: `.opencode/plans/checkpoint-mon-MA-1507.md`
- Twin: `.opencode/plans/bug-mon-MA-1494-arcane-prowl.md` (sphinx-of-lore, same shape, same line-778 burn)

## End-state (left LIVE for MA-1508)
Round 1, active=AasimarTest; Sphinx of Valor 1 hp199/199 init19 targetName="Bandit 1" (armed preserved); Bandit 1 hp11/11 init9; `Sphinx of Valor 1.monsterLegendaryUses {max:1,used:1}` (exhausted; regain at Valor's next turn-start); log 5; overlays flushed (.popup-overlay Done pressed, card closed); initiative NOT cleared.
