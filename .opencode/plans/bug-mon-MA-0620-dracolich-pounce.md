# Bug: MA-0620 Dracolich Pounce — header-swallowed rows[0], zero affordance, never resolves its Rend attack

**Row:** MA-0620, stableKey `dracolich|legendary_actions|0`, monster Dracolich, category legendary_actions, actionType "other", uses 1.
**Verdict: FAIL — gated-but-never-resolves (DATA: header-swallow + missing `delegates_to`).** Economy is live but adjudicates only OTHER rows' mechanics; Pounce itself has zero clickable affordance and zero resolution path. Movement clause advisory-only (§70 accepted twin).

## Disk structure (verbatim, public/data/monsters.json `dracolich.legendary_actions`)
- rows[0] = `{ name:"Pounce", description:"The dracolich moves up to half its Speed, and it makes one Rend attack.", uses:1 }` — **no `delegates_to`, no numeric mechanic, NO canonical header row above it.**
- rows[1] = Sickening Ray `{name, description, uses:1}` (prose spellcast child, no numeric fields).
- rows[2] = Terrifying Presence `{name, save_dc:19, save_type:Wisdom, range:"30-foot Emanation", save_effect, damage_dice_primary:"2d10", damage_type_primary:Psychic}`.

## Mystery resolved (why MA-0619 saw an "Expend Legendary" chip)
`legendaryHeaderAction()` (src/services/encounters/monsterLegendaryUses.js:153-157) returns rows[0] whenever it carries numeric `uses` — Pounce's `uses:1` arms the economy **and** `MonsterCardBody.jsx:55` renders `actions.slice(1)`, so Pounce is consumed as the header: the card shows `mc-legendary-header-row` "Pounce (1 left)" + Pounce prose with **links:[]** (§99 header-swallow; MA-0567/colossus twins). The MA-0619 live "Expend Legendary" chip belongs to **Sickening Ray** (LegendarySpendLink, MonsterAction.jsx:161-172), not Pounce. Manifest numbering matches disk (Pounce IS rows[0]); there is no header row the manifest skips.

## Static resolution trace for Pounce-shape child
- Renderer: no affordance (swallowed as header; even as a normal row, no attack_bonus/save_dc/dice → generic Expend chip only).
- `resolveLegendaryRowMechanic` (MonsterCardModal.jsx:422-438): attack_bonus/save_dc null, `advisory` undefined, `extractDamageDiceFromDescription("...makes one Rend attack.")` → null (regex requires "Hit|Failure|Success: N(dice)") → **console.error "no resolvable mechanic"** silent burn (§46/§99/MA-0510 fingerprint).
- `legendaryDelegateAction` needs authored `delegates_to` — grep-zero prose "makes one X attack" parser app-wide. Pounce's `delegates_to: undefined`.
- Movement clause: grep-zero monster consumers (only PC rider files match "moves up to half") → §70 advisory-unbuilt, accepted residual.

## Live proof (test-campaign, header-verified)
EB join exact Dracolich + Bandit → cs `[Bandit 1 999/999 (staged), Dracolich 1 225/225, +14 PC placeholders]`, round 1, active=AasimarTest (off-turn, §148 chips ride armed target). Arm via Dracolich 1 own initiative-card `[data-testid="target-select"]` → Bandit 1.
- Card overlay legendary section: row0 `mc-legendary-header-row` "Pounce (1 left)" **zero links**; row1 Sickening Ray "Expend Legendary" chip; row2 Terrifying Presence "2d10"/"DC 19 Wisdom" chips. Pounce "+13"/attack affordance: ABSENT.
- Click ledger (fresh rect each):
  - Click1 (Sickening Ray Expend chip): `ability_use` spend "Dracolich 1 expends a legendary use for Sickening Ray — 0 of 1 left"; change-data `monsterLegendaryUses {max:1, used:1}`, latch `{round:1, activeCreature:"AasimarTest"}`; **no attack roll, no damage, no popup**; console ERROR `legendary action "Sickening Ray" delegates_to "undefined" — no resolvable mechanic on "Dracolich 1"` (MonsterCardModal.jsx:588). Silent burn via Pounce-hijacked header.
  - Click2 (same chip, same turn): refusal popup "no legendary uses left" + `automation legendary_use_refused (exhausted)` zero-spend log; header "(0 left)". Economy enforced.
- Full log audit (5 entries: encounter, 2 initiative rolls, spend, refusal): **ZERO "Pounce" entries, ZERO roll attack / roll damage / hp_change. Bandit untouched.** No +13 attack, no 2d10+7 Slashing + 1d8 Necrotic combined_damage_roll reachable.

## Expected (RAW)
Pounce resolves ONE Rend attack vs armed target: +13 to hit, 2d10+7 Slashing + 1d8 Necrotic (disk actions[1] Rend: attack_bonus 13, damage_dice_primary "2d10 + 7" Slashing, damage_dice_secondary 1d8 Necrotic, reach 10 ft.), spends 1 of the header uses; movement half-Speed advisory logged; second use same boundary refused exhausted.

## Fix template (data, MA-0040/MA-0022 canonical — header+children SAME pass, §46)
1. Insert canonical header rows[0]: `{ name:"Legendary Action Uses", uses:1, description:"...regains... at the start of its turn" }` (honest copy; 2024 block grants each row own refresh — align wording).
2. Pounce child: add `"delegates_to": "Rend"` (+ verbatim movement advisory parenthetical per MA-0164/MA-0220 precedent: "(movement advisory — GM moves the token; no movement-distance consumer)").
3. Sickening Ray child: needs NUMERIC spell fields copied (delegates_to:"Spellcasting" misfires through save leg, §46; MA-0227 arch-hag precedent) — adjacent MA-0621, fix same pass.
Live verify after fix: DELETE combat-ui-viewingMonster + re-join + hard reload (§21/§106); EB checkboxes/mouse pitfalls §152/§153.

## Pitfalls hit
- EB Join button off-screen (y=-143) — scrollIntoView + fresh rect (§109).
- Chip click 1 landed cleanly (no absorb this session); diff counter/log per click honored (§98).
- Burn latch stamps activeCreature=AasimarTest (whoever active), not attacker (§98).
- Injection: two browser_navigate tool echoes carried off-site aliyuncs proxy URLs; real location verified `localhost:5173` by own evaluate (§90/§97).
