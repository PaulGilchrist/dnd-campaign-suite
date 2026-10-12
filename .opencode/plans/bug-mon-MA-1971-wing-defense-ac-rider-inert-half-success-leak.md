# BUG MA-1971 — Quetzalcoatl "Wing Defense" (reactions[0]) — FAIL(a)/FAIL(b) hybrid

**Verdict: FAIL** — save core is EXACT and credited: the DC 25 Dexterity reaction chip renders LIVE and GM-clickable, adjudicates DC25/DEX with FULL-on-fail Thunder damage byte-exact across 5 presses on two seams (NPC inline + PC prompt). But the "+5 to AC against the attack" rider is **inert-by-construction** (no automation authored; parry lane keys `automation.effect` only), and the RAW "or take 7 (2d6)" success-zero semantics are **leaked by the app-wide `dc_success` default `half`** (static payload proven — live success face honestly unreachable: every rolled save failed). Trigger ungated = by-design-for-no-automation (§60), recorded as advisory (co-fixes with #1).

## Row (disk-truth, 2026-10-12, manifest NEVER edited)
- `MA-1971` · Quetzalcoatl (`quetzalcoatl`) · `reactions[0]` · save (reaction)
- `public/data/monsters.json:54302-54311`: name / trigger / description / `save_dc: 25` / `save_type: "Dexterity"` / `damage_dice_primary: "2d6"` / `damage_type_primary: "Thunder"` ONLY — **NO automation, NO dc_success, NO recharge**.
- description verbatim: `"It flares its feathered wings and gains +5 to AC against the attack, and the attacker must succeed on a DC 25 Dexterity saving throw or take 7 (2d6) Thunder damage."` — avg 7 ✓.
- RAW answer: success = **none** (0 damage); AC rider = +5 vs the triggering ranged attack; trigger = ranged weapon attack targeting it, 1 reaction.

## Chip census (KNOWN SHAPE #1 CONFIRMED — core LIVE, credited)
- `ActionSaveRoll` (`src/components/encounter/MonsterAction.jsx:110-148`): DC>0 gate :116 passes (save_dc 25); `saveChipPlan` (`MonsterCardModal.jsx:1284-1296`): `!action.attack_bonus` → `clickable:true`, formula `2d6` rollable → clickable branch.
- Live: `.mc-action` `strong` "Wing Defense." + `button "2d6"` + `span.mc-dice-link mc-dice-link-save mc-dice-link-save-clickable` "DC 25 Dexterity" (click captured in Playwright intercept log with exact class list) — generic save-shell chip LIVE, 5/5 presses produced full save adjudications. Description renders verbatim on the row.

## DEFECT 1 — "+5 to AC against the attack" rider INERT (§114 one-field automation fix)
Parry lane requires authored automation; Wing Defense has none:
- `getGatedMonsterReaction` (`src/components/encounter/MonsterCardHelpers.js:2203-2206`) keys **only** `action.automation.effect` → null for this row; `GatedReactionSlot` (`MonsterAction.jsx:186-189`) renders nothing.
- `resolveMonsterParry` (`MonsterCardHelpers.js:1812-1842`) dispatches only via that lane (:2298); `buildParryBuff` (:1782-1792) reads `automation.acBonus` (silently defaults 2 — must be authored).
- Live proof: Quetz cs `ac: 22` identical before press #1 and after all 5 presses; `cd.activeBuffs` null throughout; Quetz cs bucket carries only `_lastRollContext`+`lastSaveRoll` — **no `parry_ac`/`acBonus`/`buffs` keys**; `lastAttack.parryResolved` absent. Byte-shape twin precedent MA-0341/0565/**MA-1140 Marilith** (`MonsterCardHelpers.gated-reaction.test.js:928-959`: `automation:{type:'reaction',trigger:'melee_hit',effect:'parry',acBonus:5}` + At Will sentinel flips AC 16→21).
- Fix: author `automation: { type: 'reaction', trigger: 'ranged-weapon-target', effect: 'parry', acBonus: 5 }` (one-field-per-lane §114). CAVEAT for the fixer: `parryGate` currently gates `melee_hit` lastAttack shapes (test :952) — Wing Defense's RAW trigger is a RANGED attack targeting the monster; verify the gate/`vsAttack` stamp (`buildParryBuff` :1788 defaults 'melee attack') handles ranged-origin lastAttack, else log the ADJUSTMENT or lane will refuse/miss-label.

## DEFECT 2 — `dc_success` default half vs RAW none (§63 data fix; MV-20 family)
- RAW "succeed … **or** take 7 (2d6)" ⇒ success = NO damage ⇒ canonical data answer `dc_success: "none"`.
- No field authored ⇒ default `half` rides every surface: `resolveBlockSaveDcSuccess` (`MonsterCardModal.jsx:286` `action.dc_success ?? 'half'`), `buildSaveOptions` (:1332), `handleDamage` (:2443), `processPlayerSave` (`src/hooks/combat/saveProcessing.js:136` `dcSuccess || 'half'`).
- Live stamp: **`dcSuccess:"half"` present on ALL FIVE save-roll log entries** (Bandit×2, ElderPaladin×3) and the PC prompt copy showed the half-default convention ("Evasion: No damage on success, half damage on failure" — i.e. row default is half; Evasion is what would lift it to none, and EP has no Evasion). Any EP success had planned `floor(2d6/2)` vs 0 RAW.
- Success face honestly unreachable ≤3 loops: NPC inline seam rolls RAW d20+0 (max 20 < DC 25 → deterministic fail); PC seam EP live bonus **+8** (dex +3 base +5 aura; recipe "+11/nat14" assumption WRONG — authoritative: nat17+ needed) — failed 3× (totals 14/9/20 vs 25). ⇒ static payload evidence per MA-0481/0303 twin-fix precedent: authored `dc_success:"none"` twins live in monsters.json (abominable-yeti Chilling Gaze — cited in `MonsterCardModal.jsx:281-282` MA-0030 override; cockatrice-regent Magical Backlash = exact REACTION save-chip twin; 20+ rows total).
- Fix: `dc_success: "none"` on this row (data-only, honest copy both surfaces).

## ADVISORY — trigger ungated (§60 by-design-for-no-automation; co-fixes with DEFECT 1)
- No `automation{type,trigger}` → no auto-fire, no latch (playbook: "gated reactions key ONLY off `automation.effect`"). Control press #2 fired the full save again with zero refusal/zero latch (ungated repeat-fire, GM-driven honest) — recorded, and `lastAttack.trigger: null` on every press. If DEFECT 1 authors `type:'reaction'`+`trigger`, the gated lane gains 1/round latch semantics for free (MA-0006/0300/0305 At Will sentinel, uses:999).

## Press ledger (test-campaign, dev :5173, header==test-campaign every step)
Setup: EB check Quetzalcoatl + Bandit → `.encounter-btn-join` → Initiative r1: Quetzalcoatl 1 AC22 HP594, Bandit 1 AC12 HP11; Quetz target-select → Bandit 1.
1. **Press #1 (Bandit 1, NPC inline seam)**: popup "Wing Defense ✗ SAVE FAILURE (7 vs DC 25) (d20 7 + 0)" → "6 damage applied — HP: 11 → 5". Log: roll save `rolls:[7] saveDc:25 saveType:'Dexterity' saveResult:'failure' **dcSuccess:'half'**` + roll save-damage `formula:'2d6' rolls:[2,4] total:6 damageType:'Thunder' finalDamage:6 saveSuccess:false` + hp_change `delta:-6 → 5`. **FULL-on-fail EXACT.** lastAttack: `{saveDc:25, saveType:'Dexterity', saveResult:'failure', attackName:'Wing Defense', rawDamage:6, primaryDamage:6, primaryDamageType:'Thunder', damageApplied:true, trigger:null}`. cs ac 22 unchanged, activeBuffs null (DEFECT 1 live).
2. **Press #2 (Bandit 1, ungated control)**: fired again, zero refusal — nat20+0=20 vs 25 FAILURE → 2d6[1,1]=2 dmg (5→3). No latch/round gate (§60 shape).
3-5. **Presses #3–#5 (ElderPaladin, PC `sp-modal` prompt seam)**: prompt "ElderPaladin must make a DEXTERITY saving throw. DC 25"; stacked `sp-overlay--evasion` "Leading Evasion — Choose Allies" chooser (HeroesFeastBard passive) on every press → Skip first. Rolls: nat6+8=14 ✗, nat1+8=9 ✗, nat12+8=20 ✗ (all vs DC 25). Done applies FULL each: 8 → 224→216, 11 → 216→205, 5 → 205→200 (cs oracle; board cs 1/1 stub known MA-1970 shape). 3 fails ⇒ static-evidence fallback per recipe; **no Monk saves entered** (MA-1970 reroll-drops-damage avoided).
- Console 0 errors (2 warnings) throughout.

## Cleanup (verified)
`.mc-close` card → Admin **Clear Change Data** + **Clear Campaign Log** (both confirm dialogs accepted) → cd `{}` + log `[]` two-pass ~16s; disk `character-change-data.json`/`campaign-log.json` unlinked (empty-clear behavior). No API mutations beyond Admin clears + GET truth-reads; manifest untouched; no git writes.

## NEW one-liners
- NPC inline save seam (monster-card DC chip vs NPC target) rolls RAW d20+0 regardless of cs.saveBonuses (`Bandit cs saveBonuses.dexterity:1` yet live `bonus:0`) — any DC>20 is a deterministic NPC fail face; PC `sp-modal` prompt is the only banded-save lane.
- `sp-overlay--evasion` "Leading Evasion" chooser stacks over `sp-modal` and steals Roll Save clicks — resolve (Skip) the chooser first, per-press.
- `dice-roll-damage-applied` popup ignores body "click to dismiss" under Playwright — explicit Done button required before next chip press.
- EP live DEX save bonus = +8 (+3 base +5 aura) — nat17+ vs DC25; the "+3+aura+8=+11/nat14" carrier math is wrong (consistent with MA-1970 "+3 base/+8 aura cannot clear 25").
