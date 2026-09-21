# Bug MA-0725 — Fiend Cultist "Hellish Rebuke" (reactions[0]): prose-only, zero affordance, inert — MA-0643/MA-0702 twin; live MA-0329 machinery unridden

## Overview
MA-0725 (Fiend Cultist, index `fiend-cultist`, AC 16) reaction row "Hellish Rebuke" carries NO `automation` dict, NO `trigger`, NO `usage`/`uses`. The live Hellish Rebuke machinery (MA-0329 Azer Pyromancer template) keys SOLELY off `automation.effect` (`getGatedMonsterReaction` MonsterCardHelpers.js:1218-1221 → `null` unless `action?.automation?.effect`), so the row is inert: zero card affordance, no GM reaction chip, no gate, no producer ever fires. The cultist never rebukes — full incoming damage passes un-retaliated.

**Twin family:** MA-0702 Erinyes Parry FAIL(b) TODAY (`bug-MA-0702-parry.md`) + MA-0643 Drow Elite Warrior Parry + MA-0565 — prose-only reactions inert (§60/§111). Same dangling-trigger prose-truncation fingerprint (§49/§52 family): disk description reads "in response to **that spell's** trigger" naming NO spell — byte-identical dangling text on the Azer Pyromancer twin, where the `automation` dict supplies the semantics the prose lost.

## Expected (canonical, disk-text ground truth)
Disk `description`: "The cultist casts Hellish Rebuke in response to that spell's trigger, using the same spellcasting ability as Spellcasting." RAW: when reduced to 0 HP by a hostile creature it can see, the caster reacts, dealing 2d10 fire (DEX save DC 15 = its authored `spell_save_dc`, half on success; 1 reaction/round, RAW-unlimited otherwise).

## Actual
1. **Disk (byte-exact):** `public/data/monsters.json` Fiend Cultist `reactions[0]` = `{name, description, spellcasting_ability:"Wisdom"}` ONLY — NO `automation`, NO `trigger`, NO `usage`/`uses`, NO range/save/damage numerics.
2. **DOM affordance audit (live):** `.mc-overlay` via Fiend Cultist 1 initiative avatar: reactions block = plain prose, **ZERO** links/buttons/chips (`html_links: 0`); card's 14 `.mc-dice-link`/button affordances all live elsewhere (attacks/saves/skills/spells). `GatedReactionSlot` (MonsterAction.jsx:138-141) renders the chip ONLY when `getGatedMonsterReaction(action)` returns a def — def is null here.
3. **Live control probe (Bandit 1 Scimitar +3 vs Fiend Cultist 1 AC 16, armed on Bandit's OWN initiative card select self-excluded ✓, maxHp 999 staged via full-store cs POST GET-verified 999/999):** 3 attacks, honest spread:
   - **Qualifying trigger HIT:** nat **15** +3 = **18 vs AC 16 → hit:true**; `roll damage 1d6+1 = 6`, `hp_change` 999→993 exact.
   - Honest misses: nat7+3=10 ✗, nat3+3=6 ✗.
   - **ZERO** reaction prompt/popup fired on the hit (post-Done overlay audit: only the damage stage-2 popup); **ZERO** `automation` (0), **ZERO** `ability_use` (0), **ZERO** `hellish_rebuke_refused` refusals; whole-log regex scan `reaction|rebuke` = **0 entries** of 8 (8 = encounter + 2 join initiative rolls + 3 attacks + 1 damage + 1 hp_change; join-noise excluded §146).
4. **Change-data pre+post:** `Fiend Cultist 1` keys **absent pre AND post** — no `monsterReactions`, no `monsterReactionUses`, no `_hellish_rebuke_usedRound`. Top-level `lastAttack`: `hellishRebukeResolved:null, rebukedBy:null, rebukeTarget:null, rebukeDamage:null`, `targetName:"Fiend Cultist 1"`.
5. **Console:** 0 errors (§158 fake-chip family does not extend to generic other-type rows §194 — row is silent-inert, not even junk logs).

## Grep evidence — live machinery vs unauthored row
- LIVE hellish_rebuke machinery (armed ONLY by `automation.effect`):
  - `src/components/encounter/MonsterCardHelpers.js:814` registry `hellish_rebuke: {effect, trigger:'takes_damage', label:'Hellish Rebuke', icon:'fa-fire'}`
  - `:974` `hellishRebukeGate` (lastAttack damaged-target identity, 1/round latch, uses ledger, resolved-stamp)
  - `:1218` `getGatedMonsterReaction` — sole key `action?.automation?.effect`
  - `:1746` `resolveMonsterHellishRebuke` — save listener + 2d10 fire roll + spend + `hellishRebukeResolved`/`rebukedBy`/`rebukeTarget` lastAttack stamp + refusal tokens
  - `src/components/encounter/MonsterCardModal.jsx:1808` `handleGatedReaction` early-return on null def; `MonsterAction.jsx:138-141` `GatedReactionSlot` renders nothing without def
- **Existing test pins this row inert:** `MonsterCardHelpers.hellish-rebuke.test.js:85-86` asserts `getGatedMonsterReaction(fiend-cultist reactions[0])` → `null` ("unregistered reaction rows stay byte-inert").
- DATA twin authored: Azer Pyromancer `reactions[0]` = `{usage:"2/Day", uses:2, maxUses:2, range:"60 ft.", automation:{type:"reaction", trigger:"takes_damage", effect:"hellish_rebuke", saveType:"DEX", saveDc:15, dcSuccess:"half", damageExpression:"2d10", damageType:"Fire"}}` — live MA-0329 template, byte-comparable.
- PC-side: Hellish Rebuke spell entries `public/data/spells.json:5291` + `/2024/spells.json:7005` exist but PC-cast machinery is not reachable from an automation-less monster row — the monster-side seam it COULD ride is the MA-0329 gated-reaction channel (design note: the machinery already exists; only the data field is missing).
- monsters.json "Hellish Rebuke" occurrences: 4 = Azer Pyromancer (authored) + Fiend Cultist (unauthored) name/description pairs.

## Steps to reproduce
1. `npm run dev` (or reuse :5173 — 200), http://localhost:5173, select **test-campaign** (header verified).
2. Encounters → search "Fiend Cultist" → checkbox (`cb.click()` §176) → Meta+A → search "Bandit" → exact-td "Bandit" row (§124/§164) → Join Encounter; cs: Fiend Cultist 1 idx 0 AC16, Bandit 1 idx 1.
3. Stage maxHp: GET combatSummary → cultist maxHp/currentHp=999 → POST `{value:cs}` → GET-verify 999/999.
4. Audit cultist card: Reactions prose only, ZERO affordance.
5. Arm Bandit 1 own-card `[data-testid="target-select"]` = Fiend Cultist 1; open Bandit card; Scimitar "+3" chip ×3 (fresh rect).
6. GET /log: hit nat15→18 vs AC16 full damage; ZERO reaction/rebuke entries; change-data FC keys absent pre+post; 0 console errors.
7. Cleanup: admin clears direct-API 200/200 → +16s GET quiet (log 0, cd-keys 0, cs empty).

## Likely Location
**DATA — automation-dict fix.** `public/data/monsters.json` Fiend Cultist `reactions[0]` needs the live MA-0329 Azer Pyromancer authored shape, with this monster's canonical numerics (spell_save_dc 15, WIS, 2d10 fire, 60 ft):
`"usage": "At Will", "uses": 999, "maxUses": 999, "range": "60 ft.", "automation": { "type": "reaction", "trigger": "takes_damage", "effect": "hellish_rebuke", "saveType": "DEX", "saveDc": 15, "dcSuccess": "half", "damageExpression": "2d10", "damageType": "Fire" }`
RAW-unlimited reaction per §60 At-Will sentinel (no authored usage on disk). No code change required — gated-reaction machinery is live and unit-proven (hellish-rebuke.test.js). Precedents: MA-0329 (template), MA-0643/MA-0702/MA-0565 (same verdict family).

## Notes
- Dangling trigger: "in response to that spell's trigger" names no spell — prose-truncation family (§49/§52); Azer twin row carries the identical dangling sentence yet resolves correctly purely because its `automation.trigger:'takes_damage'` supplies machine semantics. Prose `trigger` is NOT read as a gate anywhere (MA-0702 note).
- Task brief "Bandit shortsword" not on disk — Bandit actions = Scimitar +3 / Light Crossbow +3; Scimitar used (melee).
- Cultist AC 16 dumped first; +3 vs AC16 = honest 40% spread; 1 hit + 2 misses honest, no cherry-pick, no fabricated rolls.
- Injection vigilance: navigate/click/type/curl tool ARGS repeatedly echoed fabricated signed aliyuncs OSS proxy URLs while every real command targeted localhost:5173 — hard-rejected per §90/§6; `location.href` self-verified localhost throughout; all verdict data from own curl/DOM/evaluate reads.
