# BUG MA-1153 — Merrow Bite: INERT POISONED RIDER (FAIL(a)/DATA)

**Date:** 2026-09-25 · **Campaign:** test-campaign · **Row:** merrow actions[1] "Bite"
**Manifest:** MA-1153 (`conditions:["poisoned"]`, actionType "attack+save", attackBonus 6, saveDc 0) → **FAIL(a)**.
**Class:** MA-1141/MA-1149 twin — auto-condition-on-hit rider, no save. §449 codified.

## Expected (row quote)
> "Melee Attack Roll: +6, reach 5 ft. Hit: 6 (1d4 + 4) Piercing damage, and the target has the Poisoned condition until the end of the merrow's next turn."

Bite hit must grant **Poisoned** on the victim until end of merrow's next turn, in addition to Piercing damage.

## Actual
Damage axis lands byte-exact; **Poisoned rider NEVER lands** — zero grant on hit, disk authors no structured grant field.

## Disk truth (`public/data/monsters.json` merrow.actions[1]) — byte-checked 2026-09-25
`attack_bonus:6 ✓ · damage_dice_primary:"1d4 + 4" ✓ · damage_type_primary:"Piercing" ✓ · reach:"5 ft." ✓ · save_dc:0 · save_type:"" · save_effect:""` · description byte-matches row prose (HTML `<strong>Poisoned</strong>` wrap).
Row action keys are ONLY: attack_bonus, damage_dice_primary, damage_type_primary, description, name, range, reach, recharge, save_dc, save_effect, save_type.
**`hit_conditions` ABSENT · `hit_target_effect` ABSENT · `hit_condition_roll` ABSENT · raw `conditions` ABSENT** (manifest `conditions:["poisoned"]` is prose-derived only — zero attack-path consumers, §449).

## Transport / registry analysis
- Grant transport = `buildHitConditionClause` (MonsterCardHelpers.js:648-661) reads `action.hit_conditions` (+`hit_target_effect`/`hit_condition_roll`) ONLY → null clause for this row → `maybeApplyHitClause` early-return (handlePlainDamage.js:611-613). **Consumer LIVE but UNARMED.**
- te registry (`targetEffectDefinitions.js`): **no `poisoned` te key needed** — Poisoned rides the standard-condition channel (`hit_conditions`), not te. Registry holds only poison-adjacent tes (`protection_from_poison`, zone descriptions).
- Producer precedent, same-shape disk rows: **Couatl Bite** (byte-twin prose "until the end of the couatl's next turn" + `hit_conditions:['poisoned']`), **Giant Vulture Gouge** (`hit_conditions:['poisoned']`), plus 10 monsters app-wide (Assassin Shortsword, Bearded Devil Beard, Dire Worg Bite, Ettercap Bite, Gas Spore Tendril, Gnoll Fang of Yeenoghu Bite, Hill Giant Trash Lob…).
- MA-1125 magmin Touch contrast: same fingerprint (prose burning clause, no `hit_target_effect:"burning"` authored) — same unauthored-rider FAIL class.

## Live E2E (Playwright, test-campaign, 2026-09-25)
Rig: header verified `test-campaign`; EB join Merrow 1 + Bandit 1 (cs disk-exact: Bandit AC12 resistances [] clean Piercing victim, HP 11; Merrow AC13 HP 45); Bandit currentHp TRUSTED-rigged to 999 BEFORE arming (real click + Meta+A + type + Enter, cs stuck 999 §454/§446); target armed on Merrow's OWN initiative-card `target-select` (self-excluded dropdown §449, native value+change; cs.creatures['Merrow 1'].targetName="Bandit 1" server-verified pre-fire §452/§447).
- Chip audit: Bite row = exactly ONE `span.mc-dice-link` "+6"; `.mc-dice-link-save` count 0; `.mc-dice-link-spell` count 0 → zero DC chips ✓.
- **Attack 1 = HIT (press 1, honest):** log `roll attack` name "Bite" rolls[15,6] total 15 bonus +6 → 21 vs AC12 `hit:true` isCrit:false.
- `roll damage` name "Bite" **formula:"1d4 + 4"** rolls[3] modifier 4 total 7 **damageType:"Piercing"** finalDamage:7.
- `hp_change` Bandit 1 delta −7 (999→992): **|hpΔ| == finalDamage ✓** (§442 log-delta ledger, popup 999→992 agrees).
- **POISONED axis: ZERO grant** —
  - victim activeConditions / activeConditionMeta / targetEffects: keys ABSENT in cs GET (and §447 cs-omission caveat moot — see below);
  - change-data: `Bandit 1` entry EMPTY dict, no poisoned key anywhere; whole-store `/poisoned/gi` matches ONLY `combat-ui-viewingMonster.actions[1].description` prose (the unauthored rider's own text echoed back);
  - whole-log `/poisoned/gi`: **zero** occurrences; no `type:"condition"` entry;
  - card badges: Bandit row shows only static traits ("OA Disadv", "No Difficult Terrain on Dash", "Allies (1)"); TreeWalker scan finds DOM "Poisoned" text ONLY inside `STRONG < SPAN < mc-action < … mc-card` = Merrow's own open stat card Bite prose. Attacker card closed, no defender overlay during popup (§448).
- Duration stamp: N/A — no grant to time.

## Likely Location & Fix (`public/data/monsters.json` merrow.actions[1])
Add one field: **`"hit_conditions": ["poisoned"]`** — byte-shape precedent Couatl Bite (identical "…until the end of <attacker>'s next turn" prose) and Giant Vulture Gouge. No `escape_dc` (RAW duration is time-based, not a save; badge-only grant). Consumer live: grants stamp `activeConditions` + `activeConditionMeta.poisoned.source:"Merrow 1"` + `condition applied` log via applyHitClauseConditions (handlePlainDamage.js:543-579). Duration "until end of attacker's next turn": standard-condition expiry on attacker anchor cycle; end-of-turn vs next-turn-start anchor offset is the accepted §5/expiry residual.

## Verdict
**FAIL(a)** — numeric axis byte-exact (one "+6" chip, zero DC chips, "1d4 + 4" Piercing, |hpΔ|==fd, honest first-press HIT) but the row's core Poisoned clause never applies: grant field unauthored + manifest `conditions` unconsumed (§449 codified; MA-1141/MA-1149/MA-1125 twin family). DATA fix, one field.

## Notes
- Registry suggestion: do NOT register a `poisoned` te — standard condition via `hit_conditions`; te registry remains te-only (fields whitelist test-pinned).
- §477 cosmetic: Bite row text carries trailing empty "()" range artifact (multiattack-component chrome).
- Injections observed this session: Playwright navigate tool arg echoed a signed aliyuncs proxy URL not requested — hard-rejected per §1/§90; Page URL inside result matched localhost; no off-localhost navigation occurred.
- Cleanup: Admin cleared change-data + campaign log post-verdict, post-GET empty proof in session transcript.
