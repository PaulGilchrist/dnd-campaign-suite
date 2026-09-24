# MA-0958 — Gynosphinx "Cast a Spell (Costs 3 Actions)" (legendary) — FAIL(b) DATA-SHAPE

- **id:** MA-0958 | **stableKey:** `gynosphinx|legendary_actions|2`
- **monster:** Gynosphinx (`gynosphinx`) | **actionIndex:** 2 | **category:** legendary_actions
- **actionName:** Cast a Spell (Costs 3 Actions) | **actionType:** other
- **verdict:** FAIL(b) data-shape — family MA-0956/MA-0957 (MA-0511/§99 lineage)
- **date:** 2026-09-23 | **campaign:** test-campaign (header verified `test-campaign` twice: after select and after re-select post-stray-navigation)

## Expected

Row (manifest/queue):

> Cast a Spell (Costs 3 Actions) — "The sphinx casts a spell from its list of prepared spells, using a spell slot as normal."

RAW (SRD): Gynosphinx takes **3 legendary actions** per round ("only one legendary action option can be used at a time and only at the end of another creature's turn"); "Cast a Spell (Costs 3 Actions)" consumes **all 3** uses and casts a prepared spell "using a spell slot as normal". The row must render inside the §99 economy with an Expend-gated affordance that, on a remaining≥3 gate, spends **all 3** uses **and** transports a prepared-spell cast (spell-list picker + spell-slot spend).

§99 canonical data template (docs/test-setup-playbook.md:99):

> "Legendary DATA shape: rows[0] MUST be header \"Legendary Action Uses: N\" + children delegates_to; child-with-uses as rows[0] → header-swallow: name+counter render, zero affordance..."

§168 byte-shape twin (playbook:168): header row name `"Legendary Action Uses: N"` + `uses:N`; children `delegates_to` only.

Expected behavior: `"Legendary Action Uses: 2"` header with `(N left)` counter; Cast-a-Spell child carries an Expend-gated `.mc-dice-link-legendary` affordance honoring **cost 3** (no-gate-on-costs-3 would itself be FAIL per the uses rule); clicking opens a spell-list affordance and spends a prepared spell slot with an advisory/slot log.

## Actual

Disk `public/data/monsters.json` → `gynosphinx.legendary_actions[2]` keys = **`[description, name]` only** — no `uses`, `cost`, `delegates_to`, `save_dc`, `automation`:

```json
{"name": "Cast a Spell (Costs 3 Actions)", "description": "The sphinx casts a spell from its list of prepared spells, using a spell slot as normal."}
```

(`legendary_resistance: null`; gynosphinx has **no spellcasting data key** — Spellcasting exists only as a prose **trait**.)

Live (test-campaign, Gynosphinx 1 136/136 init 5 vs armed Bandit 1 370/999 init 14, log baseline 160, :5173 REUSE curl 200):

- Row DOM in `.mc-overlay`: `<div class="mc-action"><strong>Cast a Spell (Costs 3 Actions).</strong><span>prose</span></div>` — **interactiveCount 0** (no a/button/[role=button]/[class*=dice-link]/input).
- Click probe at fresh boundingClientRect center (row rect x=599 y=731.7 w=640 h=35.7; mousedown/mouseup/click on row + on its `<strong>`): **zero delta** — popup 0, overlays unchanged (1 = card itself), **log 160→160**, cs delta 0.
- cs (`GET /api/campaigns/test-campaign/change-data`): Gynosphinx 1 runtime keys = `[ac, concentration, currentHp, immunities, initiative, maxHp, monsterIndex, monsterType, name, resistances, saveBonuses, size, targetName, type, vulnerabilities]` — **zero legendary/spend/spell-slot keys** (the two grep hits `legendary_actions`/`legendary_resistance` are static stat-block fields, not runtime counters).
- Legendary section renders header `"Legendary Actions"` + 3 prose children; **no** `"Legendary Action Uses"` text, no `(N left)`, no Expend chip; `[class*=legendary]` chips: 0.
- Initiative view: **0** elements matching /legend|expend/i. Console errors **0**.
- Spellcast-chip leak check: `.mc-dice-link-spell` card-wide = **[]** — the card's Spellcasting **trait** renders as plain prose (0 interactive elements), so nothing can leak spell chips into the legendary section. (Chips never arm even on the Spellcasting row itself: `extractSpellNamesFromSpellcasting` (MonsterCardHelpers.js:356-368) harvests only `<strong>`/`<em>`-wrapped names, and gynosphinx's trait description is plain lowercase prose — §118 transport never arms for this card.)

## Steps to reproduce

1. test-campaign → Initiative (rig: Gynosphinx 1 + Bandit 1 armed).
2. Click Gynosphinx 1 avatar → `.mc-overlay`.
3. Scroll to "Legendary Actions": "Cast a Spell (Costs 3 Actions)." renders bold-name + prose, zero chips/counter/Expend/spell-picker.
4. Click the name or anywhere on the row → nothing (no popup, no log, no spend, no slot touched).

## Grep evidence

Prose-only row arms zero affordance at every producer:

- `src/services/encounters/monsterLegendaryUses.js:153-157` — `legendaryHeaderAction`: `return rows[0]?.uses != null ? rows[0] : null;` (:156) — rows[0] is prose Claw ⇒ header **null** ⇒ economy never arms for the whole section.
- `src/components/encounter/MonsterCardBody.jsx:38,54-58` — rich legendary section (counter headerRow + `legendaryGate={handleLegendaryRow}`) renders ONLY when `legendaryHeader` truthy; else plain-prose section (fallback branch passes `legendaryGate=undefined`).
- `src/components/encounter/MonsterAction.jsx:164-165` — `LegendarySpendLink`: `if (!legendaryGate) return null;` — no Expend chip without the gate.
- `src/components/encounter/MonsterAction.jsx:269,285` — `isSpellcastingRow = /^spellcasting$/i.test(action.name)`; `<SpellCastLinks>` renders **only** for rows named exactly "Spellcasting". "Cast a Spell (Costs 3 Actions)" fails the regex ⇒ **§118 spell-chip transport can structurally never attach to a legendary child**.
- `src/components/encounter/MonsterAction.jsx:45,92` — damage/save chips require `attack_bonus`/`save_dc`/rollable formula; prose-only row has none ⇒ all null.

Legendary-cast consumer grep — **zero**:

- `MonsterCardModal.jsx` legendary-path ∩ `cast|spell`: **0 matches**. `resolveLegendaryRowMechanic` (:565-591) resolves only attack_bonus / save_dc / advisory / self-buff / damage-formula mechanics, else `console.error "... no resolvable mechanic"` (:589) — **no cast/spell-slot branch exists**.
- `resolveLegendaryRow` (:618-666): delegate path requires `delegates_to` (absent here — wouldn't even reach the gate); `expendLegendaryUse` then mechanic resolution only.
- `rg -i "spell.?slot"` across `src/services/encounters` + `src/components/encounter` (non-test): **zero** — no monster spell-slot machinery anywhere (PC slots only).

## Likely Location / Fix

`public/data/monsters.json` → `gynosphinx.legendary_actions` data shape (§99/§168 template) **plus an absent feature**: a legendary-cast transport.

1. Data: author §99 header uses-row (`{"name":"Legendary Action Uses: 3","uses":3,...}` — SRD Gynosphinx count) + `delegates_to` children (Death-Knight byte template, playbook:168). The existing spend/gate/latch machinery (MA-0511) then arms the economy.
2. New transport needed (does not exist today): (a) cost parsing — costs-in-name is inert text; the gate is 1-per-expend on the shared header counter, so "Costs 3 Actions" needs a cost field/gate honoring N-per-expend (and cost > max uses ⇒ refusal, not silent no-op); (b) legendary spell-list affordance (prepared-spell picker from the Spellcasting trait, whose plain-prose names also need §118 `<strong>`-wrapping + numeric `save_dc` before SpellCastLinks can arm anywhere on this card); (c) monster spell-slot spend/log transport (grep-zero app-wide).

## Notes

- **Family:** MA-0956 (Claw Attack legendary) + MA-0957 (Teleport legendary) = same FAIL(b) data-shape, same two construction cites (monsterLegendaryUses.js:156 + MonsterAction.jsx:165). This row is the third and worst: even §99-shaped data alone would NOT fix it — legendary-cast transport (§118 spell chips + slot spend + cost-3 gate) is absent by construction (cites above).
- The card's own Spellcasting content (trait) already PASSed as prose-row rendering in **MA-0949** — that verdict does not confer any legendary-cast affordance; live confirms the trait row itself arms 0 chips (§118 name-wrapping gap noted above).
- Per the uses rule: if a future fix renders a clickable affordance that spends only **1** use for this costs-3 row (or spends with <3 remaining), that is a FAIL — cost 3 must be honored (and the sibling row "Costs 2 Actions" likewise).
- Security note: one stray navigation to an external OSS proxy URL (403) occurred mid-session via a tool echo; not obeyed — returned to localhost:5173 and re-verified header `test-campaign`. All evidence gathered on localhost only.
- Rig left intact (Gynosphinx 1 136/136, Bandit 1 370/999 armed, init 5/14); card closed; log unmodified (160); no cache/log clears; no manifest edit; no git writes.
