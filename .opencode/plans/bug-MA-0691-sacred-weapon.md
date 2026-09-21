# Bug MA-0691 — Empyrean "Sacred Weapon": Stunned-on-hit unenforced + opt-out extra-21 chooser absent

**Verdict: FAIL(a)** — primary axis clause 1 (one-field DATA); clause 2 design-ticket advisory.

## Canonical (disk `public/data/monsters.json` Empyrean actions[1], byte-verified)
"Melee Attack Roll: +17, reach 10 ft. Hit: 31 (6d6 + 10) Force damage, and the target has the **Stunned** condition until the start of the empyrean's next turn. The target can choose not to be Stunned, in which case it takes an extra 21 Force damage that bypasses Resistance or Immunity."

Disk fields: `attack_bonus:17`, `reach:"10 ft."`, `damage_dice_primary:"6d6 + 10"`, `damage_type_primary:"Force"`. **NO `hit_conditions`**, no variant/opt-out structure, no secondary dice for the opt-out extra 21 (prose constant "21" — §530 flat-rider family; "Hit: N" grep n/a).

## Clause 1 (FAIL(a), DATA one-field — MA-0010/MA-0291/§150 family)
Transport EXISTS and is LIVE:
- `buildHitConditionClause` (MonsterCardHelpers.js:560) reads `action.hit_conditions` only; stamped onto attack context (MonsterCardModal.jsx:747 `hitClause:`).
- Consumer live: `applyHitClauseConditions` (handlePlainDamage.js ~:513) → `activeConditions` + `activeConditionMeta.source` + `condition applied` log; MA-0010/MA-0621 byte-shape precedents.
- `stunned` is a registered standard condition (conditionUtils.js:17, con auto-fail machinery in conditionEffects).
Unauthored row ⇒ inert by construction. Fix = one field `hit_conditions:["stunned"]` (until-next-turn duration rides the standard condition clock; escape_dc NOT applicable — no save in prose).

## Clause 2 (design-ticket advisory, NOT FAIL)
Opt-out choice ("can choose not to be Stunned, takes extra 21 Force bypassing Resistance or Immunity") has no producer:
- Variant-chooser machinery is field-armed and spell-row-scoped (MA-0275 §80); monster-attack chooser producer grep-zero (§107 "needs new chooser producer template", MA-0575-class).
- Live confirmation: 2-stage popup only on both hits (chooser would be third stage §104); no popup opt affordance, no extra-damage offer, zero `bypass` machinery on attack rows.

## Live evidence (test-campaign, 2026-09-20)
- EB joined Empyrean 1 (cs idx0, init 36) + Bandit 1 (AC12, resistances[] clean); Bandit 1 maxHp/currentHp staged 999 via full-store cs POST (§119/§181); target armed on Empyrean OWN initiative-card `[data-testid="target-select"]` (§28/§148), re-armed between rolls.
- Card: Sacred Weapon row ONE `.mc-dice-link` "+17" chip (§116; Multiattack header 0 chips §66).
- Hit 1: nat6+17=23 ✓ vs AC12, Done honored → ONE `roll damage` formula `6d6 + 10` dice [4,5,1,4,6,5] total 35 Force finalDamage 35; hp_change -35 999→964, resisted:false.
- Hit 2: nat2+17=19 ✓, ONE `roll damage` `6d6 + 10` dice [2,1,4,5,6,2] total 30 finalDamage 30; hp_change -30 964→934. Σ65 == 999−934 exact unclamped.
- **ZERO condition grants**: whole-log grep `stunned` = False; zero `condition` type entries; Bandit 1 `activeConditions`/`activeConditionMeta` null; top-level `targetEffects` null; `pendingSavePrompts` null.
- No opt-out chooser popup at any stage (attack popup→damage popup, click-to-dismiss; `.sp-modal` zero).
- mode:normal dupe-second-die noise §92; no crits; rangeReason:null gridless lenient §146; cosmetic `combined_damage_roll` note on single-primary §183/§185.
- MA-0690 same-day twin: identical zero-condition behavior on the same row inside Multiattack.

## Fix summary
1. DATA: author `hit_conditions:["stunned"]` on Empyrean actions[1] (consumers live, zero code change).
2. Design ticket: monster-attack opt-out chooser producer (2-choice popup: accept Stunned vs pay extra flat-Force bypass) + structured opt-out transport (e.g. `opt_out_clause:{damage_flat:21,damage_type:"Force",bypass:true}`) — new template, §70/§107 class; separate from this row's FAIL.

## Cleanup
Admin clear-log + clear-change-data 200/200; GET log len 0; change-data keys []; cs creatures [] quiet-state verified. Dev-log `campaign-lock` grep 0. No manifest/git writes.

## Injection note
browser_navigate tool ARGS echoed an off-site aliyuncs proxy URL (§90/§97 fingerprint) while page stayed http://localhost:5173/ (own `location.href` self-verified). Rejected; no off-site navigation.
