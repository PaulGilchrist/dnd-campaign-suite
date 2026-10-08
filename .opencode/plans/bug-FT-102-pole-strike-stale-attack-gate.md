# bug-FT-102 — Polearm Master / Pole Strike: "immediately after the Attack action" trigger gate unenforced

Verdict: FAIL(a) (trigger clause) — core lane live-exact, gate freshness missing.

## What works (live-exact, 2026-10-07, EvasiveFighter lv18 2024 BM + Glaive, EB-joined Bandit 1 AC12, test-campaign)
- Bonus Actions row "Pole Strike:" renders (automationRouter bonusActions bucket); automation {damage:"1d4", damageType:"Bludgeoning", trigger:"after_attack_action_with_polearm"}.
- Glaive Attack action HIT (d20 17+8=25 vs AC12) → Pole Strike click → attack_roll popup d20 17+8 vs AC12 HIT → after rider flush (Shield Bash STR DC16 save chain + chooser Skip) damage popup VERBATIM "Pole Strike 4 1d4 [bludgeoning]: 4 damage applied to Bandit 1 — HP: 11 → 7"; log roll:damage formula "1d4 [bludgeoning]" rolls:[4] damageType:"Bludgeoning" finalDamage:4 + hp_change delta:-4 breakdown [{Bludgeoning,4}]. d4 NOT weapon d10; no mastery rider.
- Weapon gate ENFORCED vs lastAttack identity: lastAttack=null → refusal popup "Pole Strike requires you to be holding a Quarterstaff, Spear, or a weapon with the Heavy and Reach properties." + zero attack (control A). lastAttack=Scimitar HIT → same refusal, zero attack (control B).
- Once-per-Attack-action effectively enforced by accident: 2nd click same turn refused because lastAttack is now attackName "Pole Strike" (not a polearm name) → checkPolearmRequirement fails. Attacking again with Glaive re-arms (RAW-correct per Attack action, incl. Action Surge).

## Defect
Trigger "immediately after you take the Attack action" NOT enforced — only weapon identity of campaign-global lastAttack is checked, with no round/freshness/turn-attack gate.
Proof: Round N, EvasiveFighter attacks Glaive, does NOT take Pole Strike. Walk initiative to his NEXT turn (round N+1, activeCreatureName=EvasiveFighter). Click Pole Strike with no Attack action this turn → attack fired (d20 3+8=11 vs AC12, honest miss popup, no roll:damage, no hp_change).
Cause: bonusActionAttackHandler.js:32 checkPolearmRequirement → findLastAttack(campaignName) reads root lastAttack only; no round stamp (no _Pole_Strike_usedRound / no activeCreature / no lastActionAttack check), usesMax=0 → no uses economy (handler:253-285 inert for this row).
Precedent family: CLA-143 (Flurry after_attack_action gate unenforced, fires round w/o Attack = FAIL(a)); CLA-148 fires-on-miss same gate-class. Verdict policy playbook §1: unenforced trigger/gate = FAIL.
Secondary (same gate class): gate also passes on a polearm MISS lastAttack (not separately probed; weapon-name-only check), and on another creature's polearm lastAttack (campaign-global key).

## Fix direction
Latch on attacker's own turn: stamp/read round from fresh getCombatContext (playbook §5 round-latch convention) + require lastAttack.attackerName===playerStats.name AND lastAttack occurred during attacker's current turn after an Attack-action weapon attack (polearm). Row render may stay always-visible (handler-gate model), but click must refuse with existing popup when no polearm Attack action this turn.
