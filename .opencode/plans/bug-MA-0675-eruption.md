# BUG MA-0675 — Elemental Cataclysm "Eruption" (legendary_actions[0]) — §99 header-swallow, live-confirmed

**Verdict: VERIFIED: FAIL(b) / DATA (one-header + one-field child fix)**
Date: 2026-09-20 · Session: MA-0675 · Campaign: test-campaign (header-verified)

## Canonical
"The cataclysm makes one Elemental Burst attack." (legendary action, rides the +15 Elemental Burst attack row — MA-0672 live-proven standalone attack_bonus 15, 5d6+8 Acid.)

## Disk fingerprint (public/data/monsters.json, elemental-cataclysm.legendary_actions)
```json
[
  {"name":"Eruption","description":"The cataclysm makes one Elemental Burst attack.","uses":1},
  {"name":"Rumbling Movement","description":"...","save_dc":23,"save_type":"Constitution","save_effect":"..."}
]
```
NO header row. Child-with-uses as rows[0] = §99 header-swallow. rows[1] (save_dc 23) rides shared gate with own chip (§110/§567 nuance — out of scope, lives).

## Mechanism (code)
- monsterLegendaryUses.js:156 `legendaryHeaderAction` returns rows[0] whenever `rows[0].uses != null` → **Eruption itself is consumed as the header**.
- MonsterCardBody.jsx:54 gated branch activates (header "exists"); children render `slice(1)` → only Rumbling Movement. Eruption never renders as a row.
- MonsterCardBody.jsx:241-249 `MonsterLegendaryHeaderRow` = plain `<div>` with `<strong>{header.name}</strong> (N left)` — no onClick, no role=button.

## Live proof (card audit + trigger attempts)
- Legendary section renders: `Eruption (1 left) The cataclysm makes one Elemental Burst attack.` then `Rumbling Movement. DC 23 Constitution...`.
- Header row DOM: `hasOnClickAttr:false`, innerLinks 0, `<strong>Eruption>` clickable:false, counter "(1 left)" renders.
- **0 × `.mc-dice-link-legendary` anywhere on the card; 0 "Expend Legendary" chips** — sharper than MA-0510: the silent-burn expend chip never even exists here, because the swallowed child became the header instead of remaining a child (LegendarySpendLink, MonsterAction.jsx:161, never runs on it).
- Target Bandit 1 AC12 armed on EC's OWN initiative-card select (`value:"Bandit 1"`; Bandit 1 maxHp/currentHp 999 full-store cs POST, §181). Fresh-rect mouse clicks fired at: header `<strong>Eruption>` → log 3→3; `.mc-legendary-counter` span → 3→3; header description span → 3→3. Zero popups (`popup-overlay`/`sp-overlay`/`sp-modal` = 0). Card stayed open.
- Console: **0 errors** — §99 silent-burn `console.error "no resolvable mechanic"` NOT reached (no affordance to reach it).
- Economy untouched and UNREACHABLE: change-data has NO monsterLegendaryUses key for the cataclysm; counter shows "(1 left)" forever — it can neither burn nor regain meaningfully. No `ability_use`, no attack adjudication, no refusal tokens possible (no clickable gate surface exists; exhausted/own-turn refusals untestable by construction).
- Cleanup: admin clear-change-data + clear-log 200/200; GET verify log 0 / cs null / change-data {} (card closed pre-clear, no resurrection, §15).

## Fix (DATA, §165 byte-template — Colossus/Death Knight/MA-0620 family)
Insert canonical header rows[0] + thread Eruption as a delegating child:
```json
{"name":"Legendary Action Uses: N","uses":N,"description":"..."},
{"name":"Eruption","description":"The cataclysm makes one Elemental Burst attack.","delegates_to":"Elemental Burst"},
{"name":"Rumbling Movement", ...}
```
- `delegates_to:"Elemental Burst"` resolves: resolveDelegates (monsterLegendaryUses.js:3-9) spans actions[], where the +15 Burst row lives → gate spends, adjudicates one attack.
- Drop Eruption's own `uses` (§165: children delegates_to only, no per-child uses).

## HONEST GAP — canonical legendary total
Disk carries **no canonical legendary count**: the missing header never existed, Eruption's `uses:1` is a swallowed pool value of unknown provenance, and the manifest row repeats only `uses:1`. Two legendary children are authored. N must come from the printed canonical source (not resolvable from this repo's data); floor suggestion ≥2 to cover both children, per-GM adjudication until canonical confirmed.
