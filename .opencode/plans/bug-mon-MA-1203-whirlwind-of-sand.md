# Bug: MA-1203 Mummy Lord — Whirlwind of Sand (inert prose-only reaction)

## Overview
`MA-1203` (mummy-lord, reactions[0], category=reactions) is a prose-only row: disk authors `{name, trigger, description}` with **no `automation {type, trigger, effect}`** block, no `usage`/`uses`, no `zone`, no effect key. Per playbook §60 no-affordance fingerprint and the MA-0869 prose-Parry twin, the row renders as plain text with zero interactive affordance, grep finds zero consumers of any whirlwind-of-sand effect key, and a live committed attack-hit on the Mummy Lord produced zero reaction delta (no prompt, no AC+2 fold, no Blinded grant, no teleport advisory, no reaction_use log). The reaction is inert end-to-end.

## Expected (manifest row, quoted)
> "actionName": "Whirlwind of Sand", "actionType": "condition", "trigger": "The mummy is hit by an attack roll", "conditions": ["blinded"],
> "description": "The mummy adds 2 to its AC against the attack, possibly causing the attack to miss, and the mummy teleports up to 60 feet to an unoccupied space it can see. Each creature of its choice that it can see within 5 feet of its destination space has the Blinded condition until the end of the mummy's next turn."

Expected behavior per §6: either (a) an authored automation `{type:"reaction", trigger, effect}` arms a pressable chip on the card's Reactions section that gates off the campaign lastAttack targeting the Lord (parry MA-0341 pending-window lineage), folds +2 AC honestly into effectiveAc of the triggering attack (§Re-validate hit/AC), and records the teleport + Blinded selection as advisory/GM-enforced (gridless §484); or (b) if intentionally unautomatable, an honest "At Will"+uses:999 sentinel at minimum — the RAW-unlimited honest sentinel shape (MA-0006/0300/0305 twins).

## Actual
- Disk `public/data/monsters.json` → `mummy-lord.reactions[0]` = exactly `{name, trigger, description}`. No automation, no usage/uses, no zone.
- `getGatedMonsterReaction` (src/components/encounter/MonsterCardHelpers.js:1682-1685) reads `action?.automation?.effect` → undefined → **null** → no chip armed. `GATED_MONSTER_REACTIONS` (MonsterCardHelpers.js:956) registry keys: feather_fall, counterspell, hellish_rebuke, parry, shield, jinx_negate, split, heal, attack, portent, limited_foresight, elemental_absorption, redirect_attack — **no whirlwind/blinded-burst effect**.
- Live card render: `<div class="mc-section"><div class="mc-action"><strong>Whirlwind of Sand.</strong><span>…</span></div></div>` — interactiveCount 0 (zero a/button/[role=button]/.mc-dice-link). MA-0869 inert fingerprint byte-shape.
- Control probe: 3 row-text presses (row + strong + row) → log delta 0, no modal.
- Trigger probe (trigger physically reached, honest): Bandit (armed via own-card `[data-testid=target-select]` → cs.targetName "Mummy Lord 1" server-confirmed) Scimitar +3 chip, nat 20 crit "✓ HIT (23 vs AC 17)", Done real-pointer committed damage. lastAttack stamped `{targetName:"Mummy Lord 1", targetAc:17, effectiveAc:17, hit:true}` — **no +2 fold**, no reaction prompt/popup in the pending window or post-commit, hp_change -11 the only delta; zero whirlwind/reaction_use automation entries, zero Blinded grants, zero conditions on any creature, zero reaction/whirlwind keys anywhere in change-data, Lord cd store key absent.

## Steps
1. :5173, select **test-campaign** (header verified).
2. Encounters → search "Mummy Lord" → exactly 1 row, td[1]==='Mummy Lord', CR 15/13,000/Desert discriminator → native cb.click(), Join Encounter → Initiative (cs Mummy Lord 1 AC17 HP187 mIdx mummy-lord; PC party auto-joins §MA-1197).
3. +NPC → last focused `.monster-autocomplete-input`, Meta+A, type "Bandit", click visible li textContent==='Bandit' → Bandit AC12 HP11 clean, no clobber (§487 Escape+blur).
4. Open Bandit card route: arm `target-select` → "Mummy Lord 1"; open Bandit `.mc-overlay` (avatar `img.avatar-image[alt='Bandit']` el.click — note `.mc-overlay` is position:fixed so offsetParent-based visibility checks false-negative).
5. Press Scimitar `+3` chip → nat 20 HIT 23 vs AC 17. Observe: no Whirlwind affordance/prompt anywhere; Done → hp_change only.
6. Audit logs + change-data: zero reaction entries; lastAttack eAC=17 unmodified.

## Likely Location
- **monsters.json reaction data shape:** `mummy-lord.reactions[0]` lacks the structured `automation` block every live reaction relies on; prose `trigger`/`description` are never consulted by any dispatcher (structured-keys-only pattern, cf. buildHitConditionClause MonsterCardHelpers.js:648 prose-inert family).
- **Reaction consumers:** card affordance gates solely off `getGatedMonsterReaction` → `GATED_MONSTER_REACTIONS[effect]` (MonsterCardHelpers.js:956/1682, MonsterAction.jsx:165); the pending-hit dispatcher is `monsterReactionGate` (MonsterCardHelpers.js:1711) reading campaign lastAttack — there is no `hit`-trigger/`whirlwind` effect registered and no auto-prompt seam that scans prose triggers when a monster is hit (MA-0869 confirmed: in-window hit resolves with parryAcBonus:0 / zero automation entries).

## Notes
- Grep evidence (all rc/zero-consumer): `Whirlwind of Sand` in src → 0 files; `whirlwind_of_sand|whirlwindOfSand` across src/public/server → 0 hits; `'blinded'` te in targetEffectDefinitions.js → 0 hits. The only `whirlwind` effect (targetEffectDefinitions.js:1066, whirlwindService.js) is the **Djinni Create Whirlwind** Restrained containment zone (MA-0610 lineage) — semantically unrelated consumer, no overlap with a Blinded teleport-burst.
- **Fix shape (MA-0013/MA-0006 twins):** minimum honest data fix = author `automation:{type:"reaction", trigger:"melee_hit" (or extend gate to all attack-roll hits), effect:"parry", acBonus:2}` + `usage:"At Will"` + `uses:999` sentinel + 1/round latch (existing parry channel getParryAcBonus/consume at attackPostProcessing, MA-0341 byte-shape) — this covers the AC+2-vs-triggering-attack leg exactly (MA-1170 shield fold precedent effAc:21). The teleport leg is GM-move/advisory only (gridless §484; MA-0891 precedent: position changes not expressible — even authoring can't move tokens). The Blinded-within-5-ft-of-destination burst needs a NEW registered te + destination picker or stays advisory (§70 GM-enforced advisory family, MA-0063/1193 twins) — a wholistic fix is a MA-0882-class CODE-GAP (new automation.type grant + te + consumer), not pure data.
- Prose-only row → chip null → zero affordance is **by design** in the current consumer architecture; the defect is the unauthored data row shipping RAW game effects with zero automation and zero honest sentinel, mirroring adjudicated FAIL(b) twins MA-0869/MA-0882/MA-0891.
- Session: console 0 errors; injections observed (browser_type echo rewrote URL to aliyuncs proxy mid-session — rejected per §90; page self-verified localhost throughout via own location.href).

## Cleanup
Admin clear (Clear Change Data + Clear Campaign Log), verified `log=[]`, `cd={}`, cs value null, 15s quiet.
