# bug-mon-MA-1268-battle-cry — Orc War Chief · Battle Cry (FAIL(b)/DATA, zero affordance)

**Row:** MA-1268 · Orc War Chief (`orc-war-chief`) actions[3] · `actionType: attack` (mislabeled — it is a buff/support action, no attack roll in RAW)
**Manifest description (byte-match disk):**
> Each creature of the war chief's choice that is within 30 feet of it, can hear it, and not already affected by Battle Cry gain advantage on attack rolls until the start of the war chief's next turn. The war chief can then make one attack as a bonus action.

## Verdict: FAIL(b)/DATA — zero affordance confirmed live (2026-09-26, localhost:5173, test-campaign only)

## Disk (static, re-confirmed)
`public/data/monsters.json` orc-war-chief actions[3] keys are ONLY:
`name, description, usage:{type:"per day", times:1}`
- NO `attack_bonus` → attack chip unarméd (§60 chip census: every chip keys off attack_bonus/dice/save_dc/Spellcasting-markup/automation.effect/legendaryGate/zone/`advisory`)
- NO `automation`, NO `advisory`, NO structured buff fields → zero clickable affordance (§60/§190)
- `usage.type/times` renders cosmetic `"(1/Day)"` `<em>` text via `formatActionUsage` (MonsterCardHelpers.js:2335, rendered non-clickable at MonsterAction.jsx:417) — ZERO gate consumer (§162/§165; MA-0648 non-save-row extension)

## Live ledger (rig: EB native cb.click exact td "Bandit"+"Orc War Chief" → Join Encounter; cs GET-verified Bandit 1 maxHp11 + Orc War Chief 1 maxHp93 both joined; avatar-alt own-card open `img.avatar-image[alt="Orc War Chief 1"]`)

Battle Cry row chip enumeration: **0 `.mc-dice-link`** in row. Row DOM = `<strong>Battle Cry.</strong>` + prose span (sanitized description) + non-clickable `<em> (1/Day)</em>` (clickable:false audited). Card-wide chip census: 6 ability-mod chips (+4/+1/+4/+0/+0/+3), 3 save chips (STR+6/CON+6/WIS+2), Intimidation +5, and exactly two action chips "+6" "+6" (Greataxe +6, Spear +6) — Battle Cry row contributes ZERO.

Center-click prose probe at fresh rect (1015,702): **0 popups** (`.popup-overlay` visible count 0), **0 log delta** (log stayed 3 entries = join + 2 initiative rolls, same EB join noise fingerprint as MA-1264), **0 console errors** (0 errors / 2 pre-existing warnings). No unexpected chip armed → nothing to press.

## Clause-by-clause adjudication
- "within 30 feet" / "can hear it" / "not already affected" / "until the start of the war chief's next turn" → GM-adjudicated: no grid/senses/duration consumer for prose-only rows (§42 gridless advisory; §69 advisory-unbuilt).
- "gain advantage on attack rolls" (multi-target ally buff) → no producer arms te on allies from this row. te channels `next_attack_advantage`/`vexTarget` exist with LIVE consumers (`conditionEffects.js:299`, contextBuilder-sync WM-008) but producers are PC-cast-side only (vex `executeManeuver.js:241`, `steadyAimHandler.js:79`, warlock teleports) and arm off authored PC automation — ZERO monster-side producer app-wide (`battle_cry|battlecry` grep-ZERO src/+server/).
- "one attack as a bonus action" → prose-inert (§123/MA-0492): live card audit shows the ONLY "bonus action" text is passive trait prose (Aggressive); monster card has NO bonus-actions section, no chip, no spend economy — GM-enforced residual.

## Fix options (recorded proposals, NOT applied)

### Option A — advisory one-field (cheap, honest, rides LIVE seam)
Add to row: `"advisory": true` (+ optional `"advisory_message"`). `isMonsterActionAdvisoryRow` = generic `!!row?.advisory` (monsterActionAdvisory.js), MA-1223 normal-action advisory chip `mc-dice-link-advisory` renders + clickable for non-legendary rows (MonsterAction.jsx:335-342, :406). Press = record-only `ability_use` popup + log, zero rolls/lastAttack pollution (CLA-320). Byte-inert everywhere else. Closes affordance; buff itself stays GM-enforced. Caveat: cosmetic "(1/Day)" stays ungated (§162) — advisory seam has NO uses gate (row authors no numeric uses; could add `uses/maxUses` only with a gated variant, see Option B).

### Option B — structured ally-buff automation (rides the LIVE MA-0694 Bolster legs)
Honest note: multi-target ally advantage is **NOT brand-new terrain** — `monster_self_buff` seam already ships an allied-advantage leg: `armBolsterLegs` (monsterSelfBuff.js:205-214) stamps te `bolster_advantage` (registered targetEffectDefinitions.js:720, LIVE fold conditionEffects.js:488) on self + every allied combatant when `automation.ally_radius_ft > 0`, ONE merged clock; §42 gridless radius/ally-membership advisory, PCs excluded (opposing party). Fix = `automation:{type:"monster_self_buff", effect:"battle_cry", rounds:1, ally_radius_ft:30}` + numeric `uses:1/maxUses:1` (monsterAbilitySaveUses gate + already-active refusal latch). Gaps to name honestly: (1) te grants advantage on ALL D20 tests, RAW Battle Cry is ATTACK ROLLS only — needs a distinct `battle_cry_advantage` te + fold OR accept over-buff with §70 caveat; (2) clock is round-boundary (`until start of next turn` ≈ rounds:1 granted in round R, per MA-0694 rounds:2 analogue discussion); (3) "can hear" + explicit ally-CHOICE (not radius) stays §42 advisory — radius is lenient superset; (4) bonus-action attack leg = unbuilt (§123 zero consumer).

## Ops/rig notes
- Row `actionType:"attack"` in the manifest is mislabeled (support/buff action) — DATA hygiene note, does not change verdict.
- Disk description carries a typo byte "ofit" (missing space) — preserved verbatim, cosmetic.
- No HP-rig POSTs this session (zero affordance = nothing resolves); victim left maxHp11 as joined.
- Board left as joined (Bandit 1 + Orc War Chief 1); Admin clears last per instruction.
