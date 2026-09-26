# MA-1238 — Noble "Parry" — FAIL(b) / DATA (one-field automation fix, Bandit Captain MA-0341 byte-shape, acBonus:2)

**Date:** 2026-09-25 · **Campaign:** test-campaign (header-verified) · **Rig:** EB join "MA-1238 Parry Probe" → board Noble 1 (AC15 HP9) + Bandit 1 (nearby presence). Card via `img.avatar-image[alt="Noble 1"]`. Live twin of MA-1236 (nimblewright, same day) / MA-0565 / MA-0869 (§114 fingerprint family).

## Verdict: FAIL(b) — prose-only Parry row arms ZERO affordance; §60/§114 fingerprint live-confirmed

## Disk row (public/data/monsters.json, Noble reactions[0]) — LIVE dump
```json
{ "name": "Parry",
  "trigger": "The noble is hit by a melee attack roll while holding a weapon",
  "description": "The noble adds 2 to its AC against that attack, possibly causing it to miss." }
```
- `name` + `trigger` + `description` ONLY — NO `automation` dict (ticket known disk state re-verified verbatim, MA-1236 fingerprint). No usage/uses, no numeric affordance fields → §60: gated reactions key ONLY off `automation.effect` → inert.

## Code evidence (grep, line-cited, re-read this session)
- Arm condition: `getGatedMonsterReaction` (`src/components/encounter/MonsterCardHelpers.js:1714-1717`) — `const effect = action?.automation?.effect; return effect ? GATED_MONSTER_REACTIONS[effect] || null : null;` → no automation ⇒ def null.
- Renderer: `GatedReactionSlot` (`src/components/encounter/MonsterAction.jsx:165-168`) — `if (!def) return null;` ⇒ zero chip; rendered per reaction row at `MonsterAction.jsx:416`. Prose row emits plain `<div class="mc-action"><strong>Parry.</strong> <span>…</span></div>` — MA-0869 §286 / MA-1236 §652 output byte-shape.
- Machinery LIVE untouched (cited from MA-1236 census same board pattern, playbook line 652 — control not re-opened per lean recipe): `buildParryBuff` Helpers:1305 reads `automation.acBonus`; `resolveMonsterParry` :1335 gates/spends/arms activeBuffs + `lastAttack.parryAcBonus` stamp; consumer folds `_parryAcBonus` into effective AC at `src/hooks/combat/hitResolution.js:284`; same-session Bandit Captain disk row carries the live automation block (re-verified disk this session: `"usage":"At Will","uses":999,"maxUses":999,"automation":{"type":"reaction","trigger":"melee_hit","effect":"parry","acBonus":2}`).

## Live evidence (Playwright, localhost:5173, header test-campaign)
1. **EB join:** native `cb.click()` on exact-monster-name rows Noble + Bandit ("Noble: clicked, checked=true / Bandit: clicked, checked=true"), Save → modal name "MA-1238 Parry Probe", explicit "Join Encounter" (save≠join, §652) → board avatars exactly `["Bandit 1","Noble 1"]`.
2. **Noble card Parry row census:** Parry `.mc-action` outerHTML = `<div class="mc-action"><strong>Parry.</strong> <span>The noble adds 2 to its AC against that attack, possibly causing it to miss.</span></div>` — in-row controls: `mc-dice-link` **0**, `a` 0, `button` 0, `select` 0, `input` 0. Whole-overlay chip census = attack/skill chips only (`+1 (11)`, `+0`, `+1`, `+0`, `+1`, `+2`, `+3`, `Deception +5`, `Insight +4`, `Persuasion +5`, `+3`) — NO Parry chip anywhere (§60 zero-affordance).
3. **Row center-click probe (real pointer, rect center 1015,610):** popups **0**, `.sp-modal` 0, card stays open (overlays 1), log delta from probe **0**, Noble HP held 9/9 (AC 15) on card. Console: **0 errors**.
4. **Log ledger (API `/api/campaigns/test-campaign/log`):** baseline 0 → post-join 3 entries = encounter + roll Noble 1 + roll Bandit 1 (Initiative join noise only, MA-1236 twin ledger). Zero automation / parry / refused / ability_use entries whole-log.

## Fix (DATA, one-field fix — §114; Bandit Captain byte-shape verbatim template, acBonus:2)
Insert into Noble reactions[0] (existing name/trigger/description keys kept):
```json
"usage": "At Will",
"uses": 999,
"maxUses": 999,
"automation": {
  "type": "reaction",
  "trigger": "melee_hit",
  "effect": "parry",
  "acBonus": 2
}
```
- `acBonus:2` = RAW Noble Parry (+2 AC against the triggering melee attack), matches description and Bandit Captain's own 2.
- `usage:"At Will"` + `uses/maxUses:999` = RAW-unlimited honest sentinel (§60, MA-0006/0300/0305).
- **Trigger prose vs RAW note:** RAW Parry is a reaction usable when hit by a melee attack; the authored trigger prose ("…while holding a weapon") is fine once the automation block is added — machinery arms off `automation.effect`/`trigger:"melee_hit"` only (§235/§396 byte-twins), and the wielded-weapon clause stays GM-enforced advisory (no equip model, §235 spend-log copy).
- Result: chip "Parry (999 left)" arms; press → pending `_parryAcBonus:2` → next resolved melee Done folds effAC+2, `parry_consumed`, round-latch refusals (§214/§235 channel; MA-0643/0702/1236 live twins).

## Cleanup evidence trail
Noble card closed via ×; saved encounter "MA-1238 Parry Probe" retained in EB list (consistent with MA-1236 probe saves); admin clears last from quiet state; 0 console errors.
