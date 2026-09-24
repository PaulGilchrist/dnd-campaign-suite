# bug-mon-MA-1012-ice-spear.md — FAIL(a)-DATA

Row: MA-1012 `ice-devil|actions|1` Ice Devil "Ice Spear" (attack) — disk `public/data/monsters.json` Ice Devil `actions[1]` LIVE verified 2026-09-23, test-campaign, :5173 reuse, fresh card.

## Defect: rider authored in wrong slot (save_effect, no save_dc)
Disk keys: `attack_bonus 10`, `damage_dice_primary "2d8 + 5"` Piercing, `damage_dice_secondary "3d6"` Cold (§118 structured LIVE), `reach "5 ft."`, `range "30/120 ft."`, `save_effect: "Until the end of its next turn, the target can't take a Bonus Action or Reaction, its Speed decreases by 10 feet, and it can move or take one action on its turn, not both."` — **NO `save_dc`, NO `hit_conditions`, NO `hit_target_effect`**. Rider is part of the row's OWN HIT effect text.

## Live proof — core exact, rider inert
Press ×1 vs Bandit 1 (own-card target-select armed, AC12, 814/999 safe vs 24 max):
- HIT n9+10=19 vs AC12; `lastAttack` targetAc==effAc==12, bonus:10, bonusDetail "(+10 to hit)"; Done clicked, stage-2 flushed, popups=0, card open.
- ONE `combined_damage_roll`: formula "2d8 + 5" [1,7]=13 Piercing finalDamage 13 + secondaryFormula "3d6" [4,3,1]=8 Cold secondaryFinalDamage 8; `hp_change` −21 (814→793); fd+sec 13+8==|Δ| exact; breakdown resisted:false ×2; 3 log entries, 1 press. Console errors 0.
- Rider grep ×0: Bandit 1 cs `conditions:null`, `targetEffects:null`; change-data `activeConditions:[]`, `activeConditionMeta:{}`, `targetEffects:null`; zero speed/speedModifier keys; live log window grep frozen/speed/"bonus action"/reaction = 0 hits. No bonus/reaction block, no speed −10 modifier entry — rider NEVER lands.

## Adjudication — MA-0984/MA-0995 wrong-slot fingerprint
Playbook ADJUDICATION RULE (MA-0984/MA-0995): attack row whose own hit-text carries a rider AND authors structured `save_effect` with no `save_dc` = wrong-slot FAIL(a)-DATA; the pass-subset escape is for prose-only riders (MA-0937/0983) only. Code confirms nothing arms this rider:
- `MonsterAction.jsx:92` — `ActionSaveRoll` `if (action.save_dc == null) return null;` → save consumer dead.
- `MonsterCardModal.jsx:567` — save dispatch `else if (action.save_dc != null)` → never reached.
- `MonsterCardHelpers.js:622` — `buildHitConditionClause` reads `hit_conditions`/`hit_target_effect` ONLY → returns null for this row; hit path (`handlePlainDamage`) never touches `save_effect`.

## Fix design (design ticket — non-condition rider, MA-0995 precedent lane)
1. Register te(s) in `targetEffectDefinitions.js`: e.g. `bonus_reaction_suppressed` (label "Frozen Grip — no Bonus Action/Reaction") and `speed_reduction_10` (or generic `speed_penalty` with value field) — until-end-of-attacker's-next-turn group.
2. Author row: `hit_target_effect` granting the te on hit + `hit_conditions`/value payload for speed −10; clock via ONE `addExpiration(expireOnCreatureName:"Ice Devil 1")` anchor leg (fires anchor next turn-start).
3. Consumers: turn-start tick applies speed −10 modifier entry; bonus/reaction block enforced at PC/NPC action seam (or GM-adjudicated advisory logged); spear-returns clause advisory-only.
4. Drop `save_effect` or keep byte-mirror only if a save_dc is ever authored; remove misleading wrong-slot key per single-source-of-truth.

## State at cleanup
Rig intact: Ice Devil 1 joined (cs), Bandit 1 armed, HP drift 814→793 (−21 from this press); no clears; manifest untouched.
