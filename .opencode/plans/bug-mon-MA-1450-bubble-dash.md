# MA-1450 — Seahorse "Bubble Dash" — FAIL(a) MISROUTE (junk +0 attack chip on RAW movement-only row)

Date: 2026-09-27 | Campaign: test-campaign (header verified) | Rig: :5173 reused | Verdict: **FAIL(a)**

## Row
`seahorse|actions|0` — "Bubble Dash": *"While underwater, the seahorse moves up to its Swim Speed without provoking Opportunity Attacks."*
RAW = pure self-movement utility: no attack roll, no save, no damage. Disk fields: `attack_bonus:0` `save_dc:0` `save_type:""` `save_effect:""` `range/reach/recharge:""` — **no `advisory` field, no automation, no conditional_damage**.

## Fingerprint (MA-1223 twin, unfixed)
MA-1223 Nalfeshnee "Teleport" comment verbatim: *"formerly junk attack_bonus:0 → '+0' chip rolling bogus to-hit"*. Seahorse carries the identical fingerprint, unfixed:
- `MonsterAction.jsx:383` `actionHasAttack = action.attack_bonus != null` — **0 != null is TRUE** → `:408` renders clickable `<span class="mc-dice-link">+0</span>` → `onAttack("Bubble Dash", 0, action)`.
- `attackRowMissingToHit` (MonsterCardHelpers.js:509-511) returns false whenever `attack_bonus != null` — MA-0286 wording guard unreachable; nothing suppresses the noise-zero chip.
- Advisory lane gated solely on `!!row.advisory` (monsterActionAdvisory.js:18) → `mc-dice-link-advisory` NOT armed; no honest record-only affordance exists.
- save_dc:0 save-shell suppressed (`Number(save_dc)>0`, MonsterAction.jsx:367); ActionDamageLinks self-suppressed (`attack_bonus != null`, :51). Row therefore renders exactly ONE affordance and it is the bogus one.

## Live evidence
- Rendered `.mc-action` chips (Bubble Dash row): `[{cls:"mc-dice-link", text:"+0", title:""}]` — single junk attack chip; zero advisory/speed/no-OA affordance. Screenshot: `ma1450-bubble-dash-row.png`.
- Press once (target armed ElderPaladin AC19): popup `"Bubble Dash / 7 / d20 7 / ✗ MISS (7 vs AC 19)"` + Done.
- Log delta: `{"type":"roll","characterName":"Seahorse 1","name":"Bubble Dash","total":7,"rolls":[7,2],"hit":false,"targetAc":19,"targetName":"ElderPaladin"}` — a REAL d20 to-hit roll the RAW never grants → FAIL(a) misroute (precedents MA-1223 same chip; MA-1449 self-cast real-roll ≠ advisory PASS-subset).
- Zero movement/no-OA state: no speed te (§68 family requires authored te; none), `bubble_dash` grep-zero consumers in src/+server/, no token-move/OA machinery (§70 documented no-consumer area). Zero `ability_use`, zero `hp_change`; ElderPaladin HP untouched (miss + row authors no damage).

## Fix (DATA, MA-1223 Option-A one-field template)
Strip the noise `attack_bonus:0` (or set null) and author `"advisory":"bubble_dash"` (+ optional `advisory_message` naming swim-speed move without OA, GM-enforced) → AdvisoryLink arms `mc-dice-link-advisory`, record-only `ability_use`, zero rolls. Movement/no-OA enforcement stays §70 advisory-unbuilt (accepted residual).

## Cleanup end-state
Admin clear change-data + log POSTed: `log: []`, cd cleared; card closed quiet-recheck; no manifest edits, no git writes, no off-target campaign touched.
