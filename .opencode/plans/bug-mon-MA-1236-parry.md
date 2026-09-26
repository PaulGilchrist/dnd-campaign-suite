# MA-1236 — Nimblewright "Parry" — FAIL(b) / DATA (one-field automation fix, Bandit Captain MA-0341 byte-shape, acBonus:2)

**Date:** 2026-09-25 · **Campaign:** test-campaign (header-verified) · **Rig:** EB join "MA-1236 Parry Probe" → cs Bandit Captain 1 (idx0, AC15 HP52) + Nimblewright 1 (idx1, AC18 HP45). Card via `img.avatar-image[alt="Nimblewright 1"]`.

## Verdict: FAIL(b) — prose-only Parry row arms ZERO affordance; §114 fingerprint live-confirmed (MA-0869 gladiator twin)

## Disk row (public/data/monsters.json, Nimblewright reactions[0]) — LIVE dump
```json
{ "name": "Parry",
  "description": "The nimblewright adds 2 to its AC against one melee attack that would hit it. To do so, the nimblewright must see the attacker and be wielding a melee weapon." }
```
- `name` + `description` ONLY — NO `automation` dict (ticket's known disk state re-verified verbatim). No usage/uses, no numeric affordance fields → §60: gated reactions key ONLY off `automation.effect` → inert.

## Code evidence (grep, line-cited)
- Arm condition: `getGatedMonsterReaction` (`src/components/encounter/MonsterCardHelpers.js:1714-1717`) — `const effect = action?.automation?.effect; return effect ? GATED_MONSTER_REACTIONS[effect] || null : null;` → no automation ⇒ def null.
- Renderer: `GatedReactionSlot` (`MonsterAction.jsx:165-168`) — `if (!def) return null;` ⇒ zero chip; rendered per reaction row at `MonsterAction.jsx:416`. Zero auto-arm from prose (row prose carries no attack_bonus/dice/save_dc) — same plain `<div class="mc-action"><strong>Parry.</strong>…</div>` output as MA-0869 §286 fingerprint.
- Machinery LIVE (untouched, ready): `buildParryBuff` :1305 reads `automation.acBonus`; `resolveMonsterParry` :1335 gates/spends/arms activeBuffs + `lastAttack.parryAcBonus` stamp (:~1358); consumer folds `_parryAcBonus` into effective AC at `src/hooks/combat/hitResolution.js:284`. Parry gated effect registered (`def.effect==='parry'` branch in `resolveMonsterGatedReaction` :1797).

## Live evidence (Playwright, localhost:5173, header test-campaign)
1. **Nimblewright card census (row-scoped):** Parry `.mc-action` outerHTML = plain prose, `<strong>Parry.</strong> <span>The nimblewright adds 2…</span>` — inner `[class*=mc-dice-link]` = **ZERO**; `<a>` 0, `button` 0, `select/input` 0. Whole-overlay chip census = 11 attack/save/skill chips only (+1/+4/+3/−1/+0/−2, DEX +7, Acrobatics +8, Preception +2, +6, +6) — NO Parry chip anywhere (§60 zero-affordance).
2. **Row center-click probe (real pointer, rect center):** popups **0**, `.sp-modal` 0, log delta **0** (3→3: encounter + 2× Initiative join noise), Nimblewright HP held 45, card stays open. Console: **0 errors**.
3. **Control contrast (same board, same session):** Bandit Captain 1 card Parry row HAS the live automation block → arms `mc-dice-link` chip **"Parry (999 left)"** (`role=button`, hasClick, shield icon) + "(At Will)" usage — machinery reachable, one field separates the rows.

## Fix (DATA, one-field fix — §114; bandit-captain byte-shape, live census above)
Insert into Nimblewright reactions[0] (existing name/description keys kept):
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
- `trigger:"melee_hit"` is the authored twin convention (§235/§396 — machinery arms off `automation.effect` only, erinyes/drow/gladiator byte-twins). `acBonus:2` = RAW Nimblewright Parry (+2), matches Bandit Captain's own 2.
- `usage:"At Will"` + `uses/maxUses:999` = RAW-unlimited honest sentinel (§60, MA-0006/0300/0305).
- Result: chip "Parry (999 left)" arms; press → pending buff `_parryAcBonus:2` → next resolved melee Done folds effAC+2, `parry_consumed`, round-latch refusals (§214/§235 channel; MA-0702/0869/1203/1148 twins). Wielding-melee-weapon clause = GM-enforced advisory (no equip model, §235 spend-log copy).

## Cleanup evidence trail
Board: Bandit Captain 1 + Nimblewright 1 + 14 PC placeholders (§439); ledger = 3 entries (encounter + 2× Initiative) only — zero junk rolls (zero-affordance row had nothing to press; row-click inert). Admin clears (log + change-data) executed last from quiet state; cards closed, 0 overlays. Saved encounter "MA-1236 Parry Probe" retained in EB list (consistent with prior probe saves).
