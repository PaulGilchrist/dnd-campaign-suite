# Bug MA-0702 — Erinyes "Parry" (reactions[0]): prose-only, zero affordance, inert — MA-0643 twin

## Overview
MA-0702 (Erinyes, index `erinyes`, AC 18) reaction row "Parry" carries NO `automation` dict and NO `usage`/`uses` fields. The live PARRY machinery (§111) keys solely off `automation.effect` (`getGatedMonsterReaction` → `null` unless `action?.automation?.effect`), so the row is inert: no card affordance, no gate, no producer ever fires. The erinyes never gains its canonical +4 AC against an incoming melee hit.

**Twin precedent:** MA-0643 Drow Elite Warrior Parry (`.opencode/plans/bug-MA-0643-parry.md`) — identical fingerprint, same-day family; MA-0565 precedent. Playbook §52/§60 (reactions prose-only = inert), §98/§99, §111, §184, §140, §180.

## Expected (canonical, disk-text ground truth)
Disk `trigger`: "The erinyes is hit by a melee attack roll while holding a weapon." Disk `description`: "The erinyes adds 4 to its AC against that attack, possibly causing it to miss."
> NOTE: task brief said "halve damage" — DISK CONTRADICTS (§3 rule-data-is-truth): the row is +4 AC conversion (2025-parry shape), matching the live `acBonus` channel, not a damage-reduction channel. A melee attack roll landing 18–21 vs AC 18 should be converted to MISS via `parryAcBonus:4` → `effectiveAc:22` (one attack per RAW; unlimited per round — At Will sentinel), with `ability_use` spend log.

## Actual
1. **Disk (byte-exact ground truth):** `public/data/monsters.json` Erinyes `reactions[0]`:
   `'{"name": "Parry", "trigger": "The erinyes is hit by a melee attack roll while holding a weapon.", "description": "The erinyes adds 4 to its AC against that attack, possibly causing it to miss."}'`
   — name+trigger+description ONLY; NO `automation`, NO `acBonus`, NO `usage`, NO `uses`. (The prose `trigger` field is NOT read as a gate: gate reads `lastAttack.trigger`/`def.trigger`, never `action.trigger`.)
2. **DOM affordance audit (live):** `.mc-overlay` via Erinyes initiative avatar. Reactions section renders plain prose `"Parry. The erinyes adds 4 to its AC against that attack, possibly causing it to miss."` — ZERO clickable affordance: all 12 `.mc-dice-link` chips belong to saves/skills/Withering Sword/Entangling Rope (none in reactions block), ZERO `[class*="reaction"]` elements, only button on card = close ×.
3. **Live control probe (Bandit 1 Scimitar +3 vs Erinyes 1 AC 18, target armed on Bandit's own initiative card, maxHp 999 staged via full-store cs POST GET-verified):** 5 attacks logged (×3 plan + honest re-fires to land a qualifying hit).
   - Misses honest: nat10=13✗, nat12=15✗, nat8=11✗, nat10=13✗.
   - **Qualifying parry-window HIT:** nat **17** +3 = **20 vs AC 18 → hit:true** — INSIDE the would-be parry window (20 ∈ [18,21]; authored +4 → AC 22 → MISS). Log: `targetAc:18, effectiveAc:18, parryAcBonus:0`; no `parryResolved` key on the entry.
   - Full damage passed un-halved/un-converted: `roll damage 1d6 + 1 = 3`, `finalDamage:3`, `hp_change -3` (999→996).
   - **ZERO** reaction prompt/popup fired on the hit; **ZERO** `automation` (0), **ZERO** `ability_use` (0), **ZERO** `parry_refused` refusals; log type counts: roll 8 / encounter 2 / hp_change 1 only.
4. **Erinyes runtime reaction flags (change-data, pre+post):** `Erinyes 1` keys `[]` — `monsterReactions`, `monsterReactionUses`, `_parry_usedRound`, `activeBuffs` all ABSENT pre and post. Top-level `lastAttack`: `parryAcBonus:null, parryResolved:null, targetName:"Erinyes 1", hit:true`.
5. **Console:** 0 errors.

## Grep evidence — live consumers vs unauthored row
- LIVE machinery (armed ONLY by `automation.effect`):
  - `src/components/encounter/MonsterCardHelpers.js:1219` `getGatedMonsterReaction` → `null` unless `action?.automation?.effect`
  - `:1054` `buildParryBuff` (`acBonus` from `action.automation.acBonus`), `:1077` `resolveMonsterParry`, dispatcher `resolveMonsterGatedReaction:1297` (`def.effect === 'parry'`), gate `parryGate:1032` + refusal tokens `:1085`
  - `src/components/encounter/MonsterAction.jsx` `GatedReactionSlot` (renders affordance only when def exists)
  - `useLoggedDiceRollAttack.js` `_parryAcBonus` → `hitResolution.js` effective-AC add
- Reduction grep (`grep -rn 'half.*damage\|damage.*half' src/services/combat`): only te-registry DESCRIPTIONS + `dc_success:'half'` SAVE-path tests — **no attack-path half-damage consumer** (§63: dc_success-half is a separate save path, not conflated).
- DATA twins: automation-authored Parry = Bandit Captain (`acBonus:2`, MA-0341 template), Death Knight, Death Knight Aspirant; Erinyes sits in the inert family with Drow Elite Warrior (MA-0643), Gladiator, Knight, Marilith, Nimblewright, Noble, Hobgoblin Warlord, Warrior Veteran.

## Steps to reproduce
1. `npm run dev`, http://localhost:5173, select **test-campaign** (verify header).
2. Encounters → search "Erinyes" → checkbox → Join; search "Bandit" → exact-td "Bandit" row (NOT Bandit Captain, §124/§164) → Join. (cs: Erinyes 1 idx 0 AC18; Bandit 1 Scimitar +3.)
3. Stage maxHp: GET combatSummary → mutate Erinyes `maxHp/currentHp=999` → POST `{value:cs}` → GET-verify.
4. Audit Erinyes card: Reactions = prose only, zero chips.
5. Arm Bandit 1's own-card `[data-testid="target-select"]` = Erinyes 1; open Bandit card; click Scimitar "+3" chip ×5 (fresh rect each).
6. GET /log: hits carry `targetAc:18 parryAcBonus:0` incl. nat17=20∈window; full damage applied; zero automation/ability_use/parry entries; change-data Erinyes reaction keys absent pre+post; 0 console errors.

## Likely Location
**DATA — one-field fix.** `public/data/monsters.json` Erinyes `reactions[0]` needs MA-0341 Bandit Captain authored template shape:
`"usage": "At Will", "uses": 999, "maxUses": 999, "automation": { "type": "reaction", "trigger": "melee_hit", "effect": "parry", "acBonus": 4 }`
**`acBonus` MUST be 4** per this monster's canonical disk text (Bandit Captain twin ships 2). No code change required (§111 machinery live). Precedents: MA-0565, MA-0643.

## Notes
- Task-brief "shortsword" not on Bandit disk row (Scimitar +3 / Light Crossbow +3) — Scimitar used (melee, meets +3 vs AC18 honest-spread plan; §42 twin).
- Injection vigilance: navigate tool ARGS echo carried an off-site aliyuncs proxy URL while page stayed localhost — hard-rejected; `location.href` self-verified `http://localhost:5173/` (§90/§6). All verdict data from own curl/DOM/evaluate reads.
- Extra attacks (5 vs plan's 3): 4 honest misses required re-fires to obtain a qualifying window hit — recorded honestly, no fabricated rolls.
- Campaign header re-verified `test-campaign` after joins.
