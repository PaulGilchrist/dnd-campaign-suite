# MA-0957 — Gynosphinx "Teleport (Costs 2 Actions)" (legendary) — FAIL(b) DATA-SHAPE

- **id:** MA-0957 | **stableKey:** `gynosphinx|legendary_actions|1`
- **monster:** Gynosphinx (`gynosphinx`) | **actionIndex:** 1 | **category:** legendary_actions
- **actionName:** Teleport (Costs 2 Actions) | **actionType:** other
- **verdict:** FAIL(b) data-shape — same family as MA-0956 (legendary_actions[0] Claw Attack)
- **date:** 2026-09-23 | **campaign:** test-campaign (header verified `test-campaign` via own DOM read)

## Expected

Row (manifest, byte-confirmed on disk):

> Teleport (Costs 2 Actions) — "The sphinx magically teleports, along with any equipment it is wearing or carrying, up to 120 feet to an unoccupied space it can see."

RAW: Gynosphinx has **2 legendary actions per round**; this option **costs 2** of them — spending all remaining uses in one expenditure (used at the end of another creature's turn).

§99 canonical data template (docs/test-setup-playbook.md §99):

> "Legendary DATA shape: rows[0] MUST be header \"Legendary Action Uses: N\" + children delegates_to; child-with-uses as rows[0] → header-swallow: name+counter render, zero affordance..."

§168 byte-shape twin (playbook:168): header row name `"Legendary Action Uses: N"` + `uses:N` + description; children `delegates_to` only (Colossus/Death-Knight verified templates; death-knight legendary_actions[0] = `{"name":"Legendary Action Uses: 2","uses":2,...}` confirmed on disk by MA-0956 audit).

Expected behavior for this row: `"Legendary Action Uses: 2"` header + `(N left)` counter; this child rendered Expend-gated (`.mc-dice-link-legendary` / LegendarySpendLink) so a click spends the 2-use cost against the shared header counter (other-creature-turn gate per `legendaryExpendGate`, monsterLegendaryUses.js:174-182) and logs an `ability_use` spend. Positional teleport itself has no grid transport (gridless precedent) — minimum honest behavior = gated spend + spend log + advisory note; a "(Costs 2)" cost is currently pure inert name-text (no cost parser; the shared header counter is 1-per-expend, MA-0511).

## Actual

Disk `gynosphinx.legendary_actions[1]` (own python dump) — prose-only, keys `['description','name']`; NO `uses`, `delegates_to`, `automation`, `cost`, `effect`:

```json
{"name": "Teleport (Costs 2 Actions)", "description": "The sphinx magically teleports, along with any equipment it is wearing or carrying, up to 120 feet to an unoccupied space it can see."}
```

No `"Legendary Action Uses: 2"` header row exists on disk (rows[0] = prose Claw Attack) ⇒ legendary economy never arms.

Live probe (test-campaign, :5173 REUSE curl=200, rig Gynosphinx 1 136/136 + Bandit 1 370/999):
- Card `.mc-overlay` opened fresh (avatar `el.click()` — mouse rect clipped at x=2122 > innerWidth 1658, el.click fallback per playbook).
- Teleport child renders `<div class="mc-action"><strong>Teleport (Costs 2 Actions).</strong> <span>prose</span></div>` — **interactiveCount = 0** (0 `a`/`button`/`[role=button]`/`.mc-dice-link*`/`input` in the row).
- Card-wide: 11 `.mc-dice-link` total, **ZERO class*="legendary"**; no `"Legendary Action Uses"` text, no `(N left)` counter, no Expend chip; `[role=switch]/radiogroup/tablist` = 0 app-side of card (initiative page scan: 0 legendary/Expend text, 0 legend buttons, 0 switch controls — no spend control ever surfaces, at anyone's turn).
- Live click probe at fresh boundingClientRect center of the `Teleport (Costs 2 Actions).` `<strong>` (rect x=599 y=689.5 w=161 h=14): **ZERO delta** — no popup-overlay, no .sp-modal/.sp-overlay, no dialog, no second `.mc-overlay`; log **160 → 160**; console **0 errors**.
- cs (`GET /api/campaigns/test-campaign/change-data`): `Gynosphinx 1` keys = `_lastRollContext, lastAttackRoll, pendingCombatSuperiorityPrompt` — ZERO legendary keys; top-level change-data ZERO legendary keys (`monsterLegendaryUses` absent); hp/rig unchanged (136/136, 370/999; activeCreatureName null).
- "(Costs 2 Actions)" parses nowhere: no cost-field/consumer — cost is inert name-text.

## Steps to reproduce

1. test-campaign → Initiative (rig: Gynosphinx 1 + Bandit 1).
2. Click Gynosphinx 1 avatar → `.mc-overlay`; scroll to "Legendary Actions".
3. "Teleport (Costs 2 Actions)" row = bold name + prose, zero chips/counter/Expend.
4. Click the name → nothing happens (no popup, log flat 160→160, no spend).

## Construction cites (self-confirmed this session)

- `src/services/encounters/monsterLegendaryUses.js:153-157` — `legendaryHeaderAction(monster)`: `return rows[0]?.uses != null ? rows[0] : null;` (:156 exact). Gynosphinx rows[0] = prose Claw (`uses` undefined) ⇒ header **null** ⇒ economy never arms.
- `src/components/encounter/MonsterAction.jsx:164-165` — `function LegendarySpendLink(...) { if (!legendaryGate) return null; ... }` — no Expend affordance without the gate; and the rich gated section (counter + `legendaryGate={handleLegendaryRow}`) renders only when `legendaryHeader` truthy (`MonsterCardBody.jsx:38,54-58`).
- `MonsterAction.jsx` remainder — every other chip keys off `attack_bonus`/`save_dc`/dice/`automation`; prose-only `{name, description}` arms zero affordance (§113 fingerprint).
- No monster teleport transport: `rg -i teleport` across resolution files — `automationService.js:15` `'teleport'` is the **PC-feature** `INTERACTIVE_HANDLER_TYPES` set; te registry hits are PC-class only (`teleport_swap_with_illusion` Invoke Duplicity :1243, `warping_implosion_teleport` :1253); zero monster-legendary teleport producer/consumer. Even with a gated chip, position change has no grid/token transport (gridless advisory class) — fix must note it.

## Likely Location / Fix

`public/data/monsters.json` → `gynosphinx.legendary_actions` shape (§99/§168 Death-Knight template). Data-only fix, machinery already live (MA-0511 spend/gate/latch/regain):

```json
[
  {"name": "Legendary Action Uses: 2", "uses": 2, "description": "The sphinx takes 2 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only immediately after another creature's turn. The sphinx regains expended legendary uses at the start of its turn."},
  {"name": "Claw Attack", "description": "The sphinx makes one claw attack.", "delegates_to": "Claw"},
  {"name": "Teleport (Costs 2 Actions)", "description": "...", "automation": {"effect": "legendary_teleport", "cost": 2, "range_ft": 120}},
  {"name": "Cast a Spell (Costs 3 Actions)", "description": "...", "delegates_to": "Spellcasting"}
]
```

Caveats: (1) header + children MUST be fixed the same pass (else "Expend" chip silently burns uses on inert delegates — §98/MA-0510); (2) the shared counter is 1-per-expend (MA-0511) — a `cost:2` multi-spend needs either a new consumer or the workaround of two spends; (3) teleport needs a NEW automation type (`legendary_teleport`/`cast_spell` grep-zero today) that logs spend + advisory 120-ft move (gridless — position not modeled, advisory-log precedent §5/MA-0674 fix(B)).

## Notes

- Family: **MA-0956** (Claw Attack, `bug-mon-MA-0956-claw-attack-legendary.md` — same construction, full live evidence) and **MA-0958** (Cast a Spell (Costs 3 Actions), legendary_actions[2], same prose-only shape). All prose-only legendary rows app-wide lacking the §99 header share this defect.
- Cost-in-name ("Costs 2"/"Costs 3") is inert everywhere — no cost parser exists; RAW 3-cost Cast-a-Spell even exceeds the 2-use pool (RAW gynosphinx has only 2 legendary uses, so Cast a Spell is RAW-unusable as printed — record for MA-0958).
- Rig left intact: Gynosphinx 1 136/136, Bandit 1 370/999, card closed via ×, log 160 (no delta), zero clears, no manifest edits, no git writes.
