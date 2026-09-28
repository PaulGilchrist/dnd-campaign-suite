# BUG MA-1456 — Shadow Dragon Pounce (legendary_actions|0) — FAIL(a)/DATA

**Verdict: FAIL(a)** — legendary economy counter/gates/regain are LIVE, but the Pounce row has ZERO affordance (§99 header-swallow) and its Rend half can never resolve; the only expend chip silently BURNS the shared use on the sibling Veil of Shadow row (MA-0510 fingerprint, console.error confirmed live).

## Row
```json
{"id":"MA-1456","stableKey":"shadow-dragon|legendary_actions|0","monster":"Shadow Dragon","actionName":"Pounce","category":"legendary_actions","actionType":"other","uses":1,"description":"The dragon moves up to half its Speed, and it makes one Rend attack."}
```

## Disk shape (public/data/monsters.json shadow-dragon.legendary_actions)
```json
[
 {"name":"Pounce","description":"The dragon moves up to half its Speed, and it makes one Rend attack.","uses":1,"recharge":false},
 {"name":"Veil of Shadow","description":"The dragon uses Shadow Stealth, and one creature ... takes 10 (3d6) Necrotic damage. The dragon can't take this action again until the start of its next turn.","uses":1,"recharge":false}
]
```
NO header row; NO `delegates_to` on either child; no numeric fields (actions[1] Rend owns attack_bonus:10 / 2d6+5 Slashing + 1d6 Necrotic).

## Root cause (§46/§99)
- `legendaryHeaderAction()` (src/services/encounters/monsterLegendaryUses.js:153) returns rows[0] whenever `uses!=null` ⇒ **Pounce is swallowed as the economy header** (max=1).
- Renderer (src/components/encounter/MonsterCardBody.jsx:59-60): with a header present the section renders `actions.slice(1)` ⇒ **only Veil of Shadow gets the gated "Expend Legendary" chip; Pounce renders as header text "Pounce (1 left)" — not clickable**. Live audit: `.mc-dice-link-legendary` count = 1, title "Expend 1 legendary use — Veil of Shadow"; Pounce clickable = false.
- Veil child: `delegates_to:undefined`, no numeric, prose dice "10 (3d6)" lacks "Hit/Failure/Success:" anchor ⇒ `extractDamageDiceFromDescription` null ⇒ final else of `resolveLegendaryRowMechanic`: **console.error "[MonsterCardModal] legendary action \"Veil of Shadow\" delegates_to \"undefined\" — no resolvable mechanic on \"Shadow Dragon 1\""** (captured live) = MA-0510 silent-burn.

## Live evidence (test-campaign, Shadow Dragon 1 AC16 init20 idx0 + Bandit 1 AC12 hp935→999 staged via card HP input; board was admin-cleared pre-session)
| Probe | Result |
|---|---|
| Pounce header-row click | ZERO popup, ZERO log delta, counter unchanged (zero-affordance proof) |
| Expend @ other-turn (active AasimarTest) | `ability_use` "expends a legendary use for Veil of Shadow after AasimarTest's turn — 0 of 1 left"; change-data `Shadow Dragon 1.monsterLegendaryUses {max:1, used:1}`; counter "(0 left)"; **ZERO attack rolls, ZERO damage, ZERO hp_change** — silent burn; console error MA-0510 |
| 2nd click @ 0 uses | refusal popup "has no legendary uses left — they regain at the start of Shadow Dragon 1's turn" + `legendary_use_refused (exhausted)`, zero spend/roll ✓ gate LIVE |
| Own-turn click (round 2, SD active) | refusal popup "expends legendary uses after ANOTHER creature's turn, not its own" + `legendary_use_refused`, zero spend ✓ |
| Turn-start regain (round wrap to SD) | `ability_use` "regains all expended legendary action uses at the start of its turn — 1 available"; `{max:1, used:0}`; latch null; `monsterLegendaryActionCooldowns` cleared (MA-0073) ✓; counter "(1 left)" |
| Rend legs | 0 — no attack-roll/damage/hp_change entry ever attributable to Pounce (session roll(attack):0, hp_change:0) |
| Movement half ("moves up to half its Speed") | §70 advisory (no grid token-move consumer) — moot anyway, row never resolves |
| Console | exactly 1 error = MA-0510 fingerprint |

## Economy vs row split
- Economy half (counter/refuse/regain): PASS via the swallowed-header counter (accidentally honest: max rides Pounce's authored uses:1).
- Pounce row half: FAIL — zero affordance, Rend half unresolvable, shared use burns inert through the sibling.

## Suggested fix (DATA, orchestrator/GM-owned; same-pass header+children per §46)
Prepend header rows[0] `{name:"Legendary Action Uses: N", uses:N, description:...}` (N=GM RAW adjudication of total legendary budget), move `uses` off both children (children auto-gate), and author `"delegates_to": "Rend"` on Pounce (§46 prose-weapon child — resolves +10 / 2d6+5 Slashing + 1d6 Necrotic through MA-0022 seam, logs "Pounce (Rend attack)"). Veil of Shadow needs numeric fields or its own delegate/advisory transport (its own row MA-1457 territory); until then its chip keeps silent-burning the shared counter.

## Notes
- §98 honored: chip absorbs clicks — every probe diffed by counter + log count, not clicks.
- cs `activeCreatureName` mirror froze at AasimarTest during walk (§31/§113); UI active card + round=2 + turn-start regain log used as truth; no API mutation POSTs used (only sanctioned admin-clear at cleanup).
- Injection artifacts this session: fabricated aliyuncs/routify off-site URLs injected into navigate/click/type/run_code tool args; all rejected (URL value ≠ intent), page remained localhost, tabs audit clean (1 tab).
