# BUG MA-0516 — Construct Spirit (Clay) Berserk Lashing: prose trigger reaction inert (DATA class, flavor b)

**Row:** MA-0516 | construct-spirit-clay | reactions[0] "Berserk Lashing" | type "other", no dice, no save_dc
**Verdict:** FAIL(b) — inert zero-affordance row per MA-0314 first precedent (bare name/desc reaction, zero affordance, inert MV-6) + MA-0467 summon-spirit twin (Healing Touch zero-affordance FAIL); playbook §10 "inert + grep-zero = FAIL flavor (b), never PASS/incomplete"; §60 "no-affordance rows (no attack_bonus/save_dc/dice) = inert unless automation {type,trigger,effect} authored".

## Disk truth (verbatim, public/data/monsters.json ~14005)
```json
{
  "name": "Berserk Lashing",
  "description": "Trigger: The spirit takes damage from a creature. Response: The spirit makes a Slam attack against that creature if possible, or the spirit moves up to half its Speed toward that creature without provoking Opportunity Attacks.",
  "attack_bonus": null,
  "reach": null,
  "damage_dice_primary": null,
  "damage_type_primary": null
}
```
ABSENT: `save_dc`, `save_type`, `usage`/`maxUses`, `automation:{type,trigger,effect}` (the ONLY key into the gated-reaction consumer).

## Root cause (static)
- `MonsterAction.jsx:170-201` render gates: attack chip needs `attack_bonus != null` (:187); `ActionSaveRoll` returns null on `save_dc == null` (:88); `ActionDamageLinks` null — no extractable dice in prose and `damage_dice_primary:null` (:41-44; `attackRowMissingToHit` is FALSE here, its ATTACK_ROW_WORDING regex needs "melee/ranged spell|weapon attack" which this prose lacks); `GatedReactionSlot` needs `action.automation.effect` keying `GATED_MONSTER_REACTIONS` (`MonsterCardHelpers.js:1063-1066`) — absent → null.
- No monster on-damage trigger consumer app-wide: reaction machinery keys ONLY structured automation (`automationPassives.js:418 damage_taken_of_chosen_resistance_type` is the sole damage-taken trigger, PC structured-automation path); grep-zero for any prose "takes damage" reaction detection.
- DOUBLE-DEAD chain: trigger's RESPONSE targets Slam, whose own row has `attack_bonus:null` + "+spell attack modifier"/"+spell level" tokens → zero chips live (MA-0286 attackRowMissingToHit + MA-0465 spell-level token; MA-0515 same-monster precedent PASS-subset already documented the Slam suppression).

## Live proof (test-campaign, 2026-09-19, localhost:5173, reused session)
- EB exact-row join → cs "Construct Spirit (Clay) 1" idx0, HP 40, AC13 (header verified test-campaign pre-join).
- Avatar-click card open, Reactions section renders: row text byte-exact prose; `chipsInReactRow = []` (zero `.mc-dice-link`/`[role=button]` in row).
- Name-text click probe: absorbed — log delta 2→2 (join-time entries only), zero popups/pickers/modals.
- Slam row audited same card: `chips: []` — double-dead confirmed live.
- Prose-only surface is advisory at best; zero state, zero adjudication possible from UI.

## Fix = DATA (MA-0300 fix-template / §60 honest sentinel)
Author `automation:{type,trigger,effect}` (or RAW-unlimited sentinel `usage:"At Will"` + `uses:999` + 1/round latch, MA-0006/0300/0305 precedent) on reactions[0] AND fix the Slam target row (numeric attack_bonus via caster-fold or authored bonus) — trigger cannot resolve while response target is itself inert. Alternatively accept as documented advisory-unbuilt (no producer exists for prose triggers; requires a ticket per §70 family).

## Registry note
Construct Spirit (Clay) previously placed (MA-0515); change-data + log Admin-cleared 200 at session end (log 0, cs null, verified :5173 + :80 post-reload).
