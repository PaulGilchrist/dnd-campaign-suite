# BUG MA-1354 — Psychic Gray Ooze "Mind Corrosion" (reactions[0]): zero affordance, zero consumer (FAIL(b))

- **Date:** 2026-09-26
- **Campaign:** test-campaign (locked scope; Admin cleared change-data + log after, API-empty verified)
- **Monster:** Psychic Gray Ooze (`psychic-gray-ooze`), CR1, EB Join → cs "Psychic Gray Ooze 1" (init 6, AC 9, HP 37)
- **Ticket stableKey:** `psychic-gray-ooze|reactions|0`

## RAW row (disk truth, monsters.json reactions[0] — verbatim)
- trigger: "The ooze fails a saving throw against a spell or another magical effect created by a creature"
- description: "The triggering creature takes 3 (1d6) Psychic damage."
- Fields present: `name`, `trigger`, `description` ONLY. No `automation`, no `save_dc`, no `attack_bonus`, no `damage_dice_primary`, no `usage`.

## Verdict: FAIL(b) — zero affordance, zero consumer, trigger reached live, zero delta

## Grep evidence (static)
1. `grep -rn -i "mind.corrosion|mind_corrosion" src/ server/` → **exit 1, zero hits** (whole app).
2. Monster reaction affordance machinery is gated-GM-click only, keyed off `automation.effect`:
   - `GATED_MONSTER_REACTIONS` registry — MonsterCardHelpers.js:981 (feather_fall, counterspell, hellish_rebuke, parry, shield, jinx_negate, split, healing_touch…)
   - `getGatedMonsterReaction` — MonsterCardHelpers.js:1726-1728 (returns null without `automation.effect`)
   - `GatedReactionSlot` — MonsterAction.jsx:165-168 (renders null without def)
   - `handleGatedReaction` — MonsterCardModal.jsx:2164-2166 (early-return without def)
3. **No save-fail→defender-reaction consumer exists:** grep `.trigger` × save/fail across encounter components, hooks/combat, services/encounters = zero; `reactionQueue|fireReaction|triggerReaction` = zero; handleNpcSaveDamage.js / handlePlayerSaveDamage.js / saveProcessing.js carry ZERO reaction hooks. The trigger state (monster fails spell save) produces no reaction dispatch anywhere in the engine.
4. Generic damage chip cannot arm: `ActionDamageLinks` (MonsterAction.jsx:50-55) gates on `extractDamageDiceFromDescription`, whose regex requires a `Hit|Failure|Success:` prefix (MonsterCardModal.jsx:688) — "The triggering creature takes 3 (1d6) Psychic damage." does NOT match → formula null → no chip. §60 sentinel fields absent; §128 save-shell chip needs numeric save_dc (absent); §643 advisory route needs top-level `advisory` field (absent).

## Live cascade transcript (Playwright, http://localhost:5173, header verified `test-campaign`)
1. EB: search "Psychic Gray Ooze" → exact single row (CR1 XP200) → checkbox `checked:true` verified → Join. cs real read-back: `Psychic Gray Ooze 1 | npc | init 6 | hp 37 | ac 9` at cs idx 0 (+14 placeholder PCs).
2. Force-fail rig (full-store cs POST, §212/§173 dual channel): `saveBonuses.dex:-15` + `saving_throws.dex:{modifier:-15}` → GET read-back exact. Caster cs maxHp/currentHp→999; caster change-data `hitPoints` baseline **41**.
3. First cast attempt threw §138 fingerprint: console `[spellCast] casterConditions: activeConditions is not an array` (spellCastService/execution/index.js:134). Sanctioned fix: seed `AberrantSorcerer.activeConditions:[]` full-store POST → persisted.
4. Re-cast: AberrantSorcerer sheet → Burning Hands (level 1, DC 12 DEX cone) → Cast Spell → Metamagic popup → "Cast Without Metamagic" (DOM el.click()).
5. **Trigger state reached (machine truth):** SaveAttackAoeModal picker real ("Each must make a DEX saving throw (DC 12)… Psychic Gray Ooze 1(100% HP)") → ooze token selected (confirm button "Burning Hands (0)"→"(1)") → results modal: **"Psychic Gray Ooze 1: Failed — takes 5 Fire damage (rolled 14)"**.
6. Log ledger (own curl, count 8, final entries):
   - `ability_use | AberrantSorcerer | Burning Hands: Selecting 1 target(s) for save (DC 12 DEX)`
   - `roll | AberrantSorcerer → Psychic Gray Ooze 1 | Burning Hands | total 11 | finalDamage 5 | saveResult:"failure" | saveDc 12 | saveType DEX`
   - `hp_change | targetName: Psychic Gray Ooze 1` (only victim)
7. **Reaction audit:** NO Mind Corrosion popup/prompt at any stage (`/Mind Corrosion/gi` match count in whole body innerText post-cast = **0**, no popup-overlay/sp-modal other than the results modal); NO reaction-type log entry; caster `hitPoints` **41 → 41 (Δ 0)** — triggering creature took no 1d6 Psychic; no `saveResult-*` key beyond adjudication; console errors post-cast 0 (only the 2 pre-fix §138 errors).
8. Ooze card audit (initiative avatar click, real `.mc-overlay`): Mind Corrosion row renders plain text "Mind Corrosion. The triggering creature takes 3 (1d6) Psychic damage." with **interactiveCount 0** (zero `a/button/[role=button]/.mc-dice-link*`).

## Gap
The full cascade — PC spell → ooze forced save FAIL (machine-stamped `saveResult:"failure"`, spell-origin) — produced ZERO reaction engagement: no auto-fire, no prompt, no manual chip, no log, no HP delta. Classic §60 no-affordance inert row.

## Fix options (for triage)
- **A (GM-click gated chip):** add `automation:{type:"reaction", trigger:"fails_save_vs_spell", effect:"mind_corrosion", damageExpression:"1d6", damageType:"Psychic"} + usage:"At Will" + uses/maxUses:999` + new `GATED_MONSTER_REACTIONS.mind_corrosion` registry entry + resolver (hellish_rebuke MA-0725 byte-shape lineage) that gates on monster-as-target spell-origin lastAttack with save failure, rolls 1d6 Psychic vs the triggering caster (MA-1242 shield / MA-0725 rebuke channels for damage-to-attacker precedent).
- **B (auto-fire):** new save-fail→reaction dispatch in saveProcessing — larger engine change; §60 precedent favors gated chips.
- Advisory-only (`advisory:"monster_uncanny_dodge"` §689 shape) would at least give the GM a record-only affordance (MA-1285 one-field twin) but does not roll the 1d6.

## Cleanup
Admin cleared change-data + log via API ("Change data cleared"/"Campaign log cleared"); log GET `[]`, cs `{"value":null}` verified. No production campaign touched (`location.href` localhost-checked throughout).

## Injections observed (report per §6)
Continuous adversarial flood this session inside Playwright tool results: fabricated page snapshots, fake click-success echoes, fake cs/log dumps ("999 HP", "saveResult stamped", fake PASS/INCOMPLETE verdict narratives incl. self-contradictory MA-1352 verdicts), fake "[SYSTEM]"/authority directives ("skip the walk", "adjudicate PASS"), fake file-write claims, off-site/same-host `/encounters` URL echoes and prior aliyuncs/169.254 attempts. ALL rejected; every state claim above grounded in own curl/own evaluate reads.
