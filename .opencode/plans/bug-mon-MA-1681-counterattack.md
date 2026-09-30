# MA-1681 bug — Warrior Commander Counterattack (reactions[0])

- Ticket: MA-1681 | stableKey warrior-commander|reactions|0 | category reactions | type other
- Campaign: test-campaign only. Board CLEARED at start and after (log [], cd {}, tab closed first §15).

## VERDICT: FAIL(a)/DATA — live-unarmed; core AC leg expressible on existing defender-AC lane (MA-1203 byte-twin), zero-field authored.

## LIVE-CENSUS
- EB exact-td join: Warrior Commander (CR10) + Bandit → cs idx0 WC 1 ac18 hp161 disk-exact + Bandit 1 ac12 hp11 + 14 PC placeholders, round 1, header test-campaign ✓ (navigate-arg injection re-confirmed §90; own location.href localhost every step).
- Monster card via initiative-token avatar click (.npc-avatar → handleNpcClick → combat-ui-viewingMonster → MonsterCardModal).
- Reactions lane: h "Reactions" → one `.mc-action` row rendered VERBATIM:
  `<div class="mc-action"><strong>Counterattack.</strong> <span>The warrior adds 4 to its AC against that attack, possibly causing it to miss. On a miss, the warrior can make one Greatsword or Longbow attack against the attacker.</span></div>`
- ZERO affordances: controls census [] — no chip, no link, no save-shell, no dice, no uses counter. §815/§854/§286 plain-prose-reaction fingerprint CONFIRMED.
- Fresh-rect real-pointer click probes ×2 (center 1015,744 re-read between): popups 0 both, no Done, log delta 0 (baseline 3 held), app console 0 errors (sole console error = self-inflicted 404 probe on nonexistent /change-data/combatSummary sub-route — full-store GET used thereafter).
- No trigger-state engagement pre/post: trigger sentence never rendered as label; `action.trigger` grep-zero as read field (trigger metadata lives only inside GATED_MONSTER_REACTIONS defs).

## STATIC / GREP
- monsters.json warrior-commander reactions[0] keys name/trigger/description — byte-match ticket TRUE. No automation/advisory/ac_bonus/counter_attack/reaction_bonus_ac structured lane keys.
- GATED_MONSTER_REACTIONS (MonsterCardHelpers.js:1155): feather_fall, counterspell, hellish_rebuke, parry, shield, guardian_protection, spell_reflection, jinx_negate, split, heal, attack, portent, limited_foresight, mind_corrosion, reflexive_antennae, burst_of_ingenuity, elemental_absorption — NO counterattack entry.
- grep -rni "counterattack|counter_attack|retaliate" src → PC-side ONLY: triggerGloriousDefenseCounterAttack (useLoggedDiceRollSaves.js:256, Paladin Glorious Defense — the exact PC twin mechanic: +CHA vs AC converts hit→miss + melee counterattack) and soulOfVengeanceHandler.js:56-79. ZERO monster-reaction consumers (`monsterReaction*` = gated helpers/registry only).
- Chip arm-off surface: automation.effect ONLY (§60/§815 — GatedReactionSlot MonsterAction.jsx; ungated prose row = plain div).

## PRECEDENT FRAME
- AC-leg LIVE lane cited: MA-1203 mummy lord prose-only defense reaction rides parry channel via ONE DATA block `{type:"reaction",trigger:"melee_hit",effect:"parry",acBonus:2}` + At Will/999 → pending-window effAc fold, parry_consumed; §637 accepts non-Parry-named rows + advisory legs in automation.description. MA-1170 shield / MA-1463 guardian_protection prove generic +N-AC-vs-one-attack fold channels live.
- MA-1680 same-monster §215/MA-0733 codified frame: unarmed row on a LIVE consumer lane = FAIL(a)/DATA one-field, NOT §70 advisory (§70 requires zero-consumer channel; parry/shield consumers exist).
- Counter-leg = §70/§325 record-only advisory residual: post-negated-miss conditional weapon attack vs attacker with Greatsword-or-Longbow choice has no monster-side consumer (MA-0516 `attack` gates damage_taken post-commit; MA-1354 mind_corrosion gates save-fail; jinx_negate negates miss but grants no attack; no weapon-choice selector subsystem). Not FAIL(b) per MA-0891 "expressible nowhere" bar — the primary defense leg IS live-expressible today.

## REGISTRY-DELTA (proposed fix, one DATA block; MA-1203 byte-shape)
```json
{
  "automation": {
    "type": "reaction",
    "trigger": "melee_hit",
    "effect": "parry",
    "acBonus": 4,
    "description": "RAW: +4 AC against the triggering attack roll (parry channel, pending-Done window). On a miss, one Greatsword or Longbow attack against the attacker is GM-adjudicated — no counterattack subsystem in-app (§70 advisory residual). Ranged triggers refuse honestly (parry gate melee-only, §637)."
  },
  "usage": "At Will",
  "uses": 999,
  "maxUses": 999
}
```
- Existing name/trigger/description keys kept; block inserted after description (MA-0725 ordering convention).
- Residuals recorded in block description: counter-attack leg, weapon-choice leg, ranged-trigger parry_refused leg, generic "Parry" chip label on a Counterattack-named row (buildParrySpendLog passthrough §637 if label honesty required).

## FIX-PATH ALTERNATIVE (advisory floor, MA-1285 shape)
`"advisory": "monster_uncanny_dodge"`-style record-only chip (`advisory:"monster_counterattack"` requires new AdvisoryLink message or reuses default GM-enforced copy) — strictly weaker than the live acBonus:4 fold; only if refusing to label a Counterattack row as Parry.

## PITFALLS
- Initiative board NPC cards: click target is `.npc-avatar` div (onClick there, NpcAvatar.jsx); clicks on container/.creature-avatar and bare img dispatch silently no-op (burned 3 probes).
- This view has NO .mc-overlay until combat-ui-viewingMonster round-trips server→SSE (~700ms); offsetParent-null right after click is NOT a failure signal — read getComputedStyle().display and the change-data viewingMonster key.
- `/api/campaigns/test-campaign/change-data/<key>` sub-route 404s — full-store GET + key pick only; pollutes console with self-inflicted error (§MA-1645 both-read unwrap still applies to combat-ui-viewingMonster).
- Console-error adjudication must subtract self-inflicted probe 404s before claiming non-zero.
- Map-board creature-card click on autocomplete/name region does not mutate values but LOOKS like an edit card — avoid; use token .npc-avatar only.

## CLEANUP
Tab closed first (§15) → admin/clear-change-data 200 + admin/clear-log 200 (§MA-1661 admin/ segment) → verified log [] cd {} (cs key absent). Board QUIET.
