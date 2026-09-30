# BUG MA-1636 — Unicorn Shimmering Shield (legendary): silent-burn — pool spends honestly, THP/AC+2 core mechanic inert (FAIL(a)/DATA)

## VERDICT: VERIFIED: FAIL — 2026-09-29 (dev:locked, test-campaign only, localhost)

## Expected (monsters.json unicorn legendary_actions[1], byte-match manifest)
"The unicorn targets itself or one creature it can see within 60 feet of itself. The target gains 10 (3d6) Temporary Hit Points, and its AC increases by 2 until the end of the unicorn's next turn. The unicorn can't take this action again until the start of its next turn."
Target gains rolled 3d6 THP + AC+2 until-next-turn.

## Disk keys (STEP 1)
`{name, description, uses:1, recharge:false}` ONLY — no temp_hp, no ac_bonus, no automation, no delegates_to, no advisory, no save_dc, no damage_dice_primary.

## Route trace (static)
resolveLegendaryRowMechanic (MonsterCardModal.jsx:687-712): attack_bonus null → save_dc null → advisory null → isMonsterSelfBuffRow false (needs automation.type monster_self_buff, monsterSelfBuff.js:23) → extractDamageDiceFromDescription requires `Hit|Failure|Success:` prefix — "gains 10 (3d6) Temporary Hit Points" no match → **console.error "no resolvable mechanic" (:712)** = MA-0957/0958 silent-burn fingerprint. THP producers grep: all setTempHp sites are PC class/rest/save_effect lanes (combatSuperiorityUtils:317, turnStartEffects:333, shortRest:230, longRest:373, wildShape:106, ShortRestModal:665, useCharActionsEventListeners:95/108, CharBonusActions:681, thrall:94, parseTempHpGrantClause MonsterCardHelpers:333-339 save_effect-only, monsterSelfBuff bolster automation.temp_hp). ZERO keyed to legendary prose / unicorn. AC-bonus lane: grep-zero app-wide outside PC cover (contextBuilder-map.js:213-274) + rogue maneuvers.

## LIVE ledger (own DOM/curl truth, 3 presses)
- Chip: sole live `.mc-dice-link-legendary` "Expend Legendary" on rows[1] (rows[0] Charging Horn swallowed header — MA-1635); rides shared header counter max=1.
- Press 1: pool `{max:1,used:0→1}` change-data `Unicorn 1.monsterLegendaryUses` ✓ honest spend; ability_use log "expends a legendary use for Shimmering Shield … 0 of 1 left"; latch `_legendaryUses_usedRound{round:1,activeCreature:AasimarTest}` §98 twin; cooldown latch `monsterLegendaryActionCooldowns.shimmering_shield` §204 live. **ZERO popup, ZERO THP key (unicorn+Bandit change-data/cs temp-ish grep {}), ZERO roll (no 3d6 in log), ZERO AC change (cs ac:12→12).** 1 console error: `[MonsterCardModal] legendary action "Shimmering Shield" delegates_to "undefined" — no resolvable mechanic on "Unicorn 1"` (runtime :933).
- Press 2+3 same round: refusal popup "Legendary Action Refused … no legendary uses left … Nothing spent, no roll." + `legendary_use_refused (exhausted)` ×2, pool HELD {1,1}, no new console errors (gate returns before mechanic leg). **USES GATE WORKS.**
- No target-select affordance on row: self-vs-other choice unexpressible (§60/§114); 60 ft gridless advisory; row renders stray "(false)" for recharge:false (cosmetic).

## Verdict logic
Uses gate ✓ but THP (core grant) MISSING + console error = FAIL(a)/DATA (task rule: no THP = FAIL; §419 MA-0957 ladder(a): advisory fields).

## Fix (ladder(a), one-field, MA-0957/§MA-1456 byte-twins)
Add `advisory:"shimmering_shield", advisory_message:"10 (3d6) THP + AC+2 until end of unicorn's next turn, self or creature within 60 ft — GM-enforced: no THP/AC-bonus consumer, self-vs-ally chooser, gridless range; rolls ride GM adjudication"` → rides live legendary advisory seam (resolveLegendaryRowMechanic :691 branch): spend stays honest, popup+record-only log land, console.error dies. Optionally pair with MA-1635 §165 header insert (children uses drop). Full mechanical lane (rolled 3d6 THP via rollExpression+tempHpService + chooser + AC-bonus te consumer) = separate engineering ticket; bolster self-buff lane (MA-0694) still lacks ally-target chooser + AC channel.

## Cleanup
Tab closed first §15, then admin clear-change-data + clear-log; verified quiet. test-campaign only.

## Injection
browser_navigate arg-rewrites to OSS-proxy URLs appeared again in-session; location.href self-check confirmed page stayed localhost on every step; verdicts from own evaluate/curl only.
