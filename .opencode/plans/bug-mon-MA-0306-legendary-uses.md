# BUG MA-0306 — Arch-hag legendary header: ungated uses economy (FAIL)

**Verdict: FAIL** — no legendary-uses counter exists; header row is a prose-only name-text block; all three legendary children are fully inert. Fingerprint parity with MA-0217/0250/0259/0277 (playbook :525, :544).

## Row
- Monster: Arch-hag (`arch-hag`, LIVE test-campaign cs idx2 init19, hp 333/333)
- `legendary_actions[0]` "Legendary Action Uses: 3 (4 in Lair)", actionType other
- Children: [1] Hag's Swipe ("one Spectral Claw attack"), [2] Malicious Magic (Dimension Door/Hypnotic Pattern, "can't take again until start of next turn")

## Root cause (DATA authoring, same family as MA-0092/0217/0250)
`public/data/monsters.json` Arch-hag `legendary_actions[0]` carries NO numeric `uses` field ("3 (4 in Lair)" is name-text only; no `legendary_use`/`delegates_to` authored anywhere on the row set).
- `monsterLegendaryUses.js:153-157` `legendaryHeaderAction()` returns header ONLY if `rows[0].uses != null` → null. No name-string parsing exists.
- `MonsterCardBody.jsx:38,54-58` null header → plain `MonsterActionSection` branch: no `MonsterLegendaryHeaderRow`, no `.mc-legendary-counter`, `legendaryGate` undefined.
- `MonsterAction.jsx:151-189` legendary spend chip requires `legendaryGate` + numeric affordance; attack/save/spell chips require `attack_bonus`/`save_dc`/name=="Spellcasting". Prose-only rows → **zero clickable affordances**.
- MA-0022 delegate seam (`MonsterCardModal.jsx:305`) requires authored `delegates_to` — ABSENT on Hag's Swipe → "one Spectral Claw attack" prose never resolves; SWIPE does NOT work as attack (corrects task hypothesis). Spectral Claw numeric row lives in Actions and owns its own numbers (+14, 3d6+7 Force).
- Once-per-turn clause (Malicious Magic) is DEAD: cooldown logic lives exclusively inside `expendLegendaryUse`/`resolveLegendaryRow` (monsterLegendaryUses.js ~:320; MA-0187 general gate rule) — unreached without a gated header.

## Live evidence (test-campaign, active creature Animal Lord 1)
- Card render: header + both children = plain text `.mc-action` divs; `.mc-legendary-counter` absent; clickable-element query inside each legendary row returns `[]` for header/Hag's Swipe/Malicious Magic.
- Economy probe: Hag's Swipe clicked ×4 consecutively → popups `[]` every click, log length unchanged (cap 500, newest entry still pre-probe AberrantSorcerer Fire Bolt), zero refusals, zero `legendary_use_refused`.
- Malicious Magic ×1 + immediate 2nd click → popups `[]`, no "can't take again" enforcement (none possible), zero log.
- Store: `Arch-hag 1.monsterLegendaryUses` null before AND after all probes (never created); `monsterLegendaryActionCooldowns` null.
- Popup==log==Δ consistency: popup absent == log absent == Δ(uses) null==null ✓ (consistent inertness, not a swallowed error; console 0 errors).
- Druid top-up (sanctioned fill+Enter): store `currentHitPoints` 1→78 ✓ (cs mirror stale at maxHp/currentHp=1 — pre-existing derivation lag, not caused by this row).
- Header text verify: `.mc-action strong` = "Legendary Action Uses: 3 (4 in Lair)." ✓ manifest-corrected description present.

## Fix recipe (data-only, adult-silver MA-0136 template)
Add `uses: 3` to `legendary_actions[0]`; give Hag's Swipe `delegates_to: "Spectral Claw"` (or numeric `attack_bonus:14`+dice) so it routes through `expendLegendaryUse` spend + turn latch; Malicious Magic gets spell-cast affordance or `delegates_to` Spellcasting so its once-per-turn clause engages. Consumers (expend/regain `turnStartEffects.js:176`, refusals, `.mc-legendary-counter`) already exist and auto-activate on authored `uses`. Advisory residual: "(4 in Lair)" has no consumer.

## PASS condition (not met)
Real "(N left)" counter rendering + click refusal at exhaustion / own-turn / per-turn latch + regain at turn start. None observed → FAIL.
