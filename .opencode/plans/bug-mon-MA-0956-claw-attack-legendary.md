# MA-0956 — Gynosphinx "Claw Attack" (legendary) — FAIL(b) DATA-SHAPE

- **id:** MA-0956 | **stableKey:** `gynosphinx|legendary_actions|0`
- **monster:** Gynosphinx (`gynosphinx`) | **actionIndex:** 0 | **category:** legendary_actions
- **actionName:** Claw Attack | **actionType:** other
- **verdict:** FAIL(b) data-shape (MA-0511/§99/§114 family)
- **date:** 2026-09-23 | **campaign:** test-campaign (header verified `test-campaign`)

## Expected

Row (manifest/queue):

> Claw Attack — "The sphinx makes one claw attack."

RAW: Gynosphinx has **2 legendary actions per round** ("only one legendary action option... immediately after another creature's turn"), Claw Attack = 1 legendary action costing one claw attack (+9, 13 (2d8+4) slashing — same numbers as its standalone Claw action).

§99 canonical data template (docs/test-setup-playbook.md:99):

> "Legendary DATA shape: rows[0] MUST be header \"Legendary Action Uses: N\" + children delegates_to; child-with-uses as rows[0] → header-swallow: name+counter render, zero affordance..."

§168 byte-shape twin (playbook:168): header row name `"Legendary Action Uses: N"` + `uses:N` + description; children `delegates_to` only, no per-child uses (Colossus/Death Knight verified templates — confirmed live on disk: death-knight legendary_actions[0] = `{"name":"Legendary Action Uses: 2","uses":2,...}`).

Expected behavior: "Legendary Action Uses: 2" header with `(N left)` counter + Expend-gated `.mc-dice-link-legendary` chip on Claw Attack child; clicking spends 1 use (other-creature-turn gate, one-per-boundary latch) and resolves a claw attack exactly like MA-0955 (nat+9, 2d8+4 slashing).

## Actual

Disk `gynosphinx.legendary_actions[0]` is prose-only — NO `delegates_to`, `uses`, `attack_bonus`, `automation`:

```json
{"name": "Claw Attack", "description": "The sphinx makes one claw attack."}
```

Live (test-campaign, Gynosphinx 1 vs Bandit 1 AC12 370/999 rig):
- Card `.mc-overlay` Legendary section renders header + 3 prose children: `"Legendary Actions\nClaw Attack. The sphinx makes one claw attack.\nTeleport (Costs 2 Actions). ...\nCast a Spell (Costs 3 Actions). ..."`.
- Per-row affordance audit: all 3 children = `<strong>name.</strong><span>prose</span>`, **0 clickable elements each**. No `mc-dice-link-legendary` anywhere in overlay (card-wide `.mc-dice-link*` = 11: 6 ability mods, 4 skill checks, 1 standalone Claw `+9`).
- No "+N" chip on legendary Claw Attack child (disk legendary has no `attack_bonus` — confirmed none).
- No `"Legendary Action Uses"` text, no `(N left)` counter, no `[role=switch]/radiogroup/tablist/checkbox` (0).
- Click probe at fresh boundingClientRect center of the Claw Attack `<strong>`: **zero delta** — no popup, no overlay, log 160→160, console errors 0.
- cs (`GET /api/campaigns/test-campaign/change-data`): Gynosphinx 1 entry carries NO legendary keys; Gynosphinx char store and top-level change-data likewise zero legendary keys (`monsterLegendaryUses` absent).
- Initiative view: zero legendary/Expend affordances app-wide when another creature's turn ends (DOM scan: 0 elements matching /legend|expend/i).
- Adjacent gap: disk `legendary_resistance: null` (RAW 2) → "Legendary Resist." defense row never renders (`MonsterCardBody.jsx:329` `!= null` guard).

## Steps to reproduce

1. test-campaign → Initiative (rig: Gynosphinx 1 + Bandit 1).
2. Click Gynosphinx 1 avatar → `.mc-overlay`.
3. Scroll to "Legendary Actions": three rows render as bold-name + prose, zero chips/counter/Expend.
4. Click "Claw Attack" name or anywhere on its row → nothing happens (no popup, no log, no spend).

## Grep evidence (producers require structured fields; prose-only ⇒ zero affordance)

- `src/services/encounters/monsterLegendaryUses.js:153-157` — `legendaryHeaderAction(monster)`: `return rows[0]?.uses != null ? rows[0] : null;` — gynosphinx rows[0] lacks `uses` ⇒ header null ⇒ economy never arms.
- `src/components/encounter/MonsterCardBody.jsx:38,54-58` — rich legendary section (counter `headerRow` + `legendaryGate={handleLegendaryRow}`) renders ONLY when `legendaryHeader` truthy; else plain prose section (children get plain handlers, no spend gate, no chip).
- `src/components/encounter/MonsterAction.jsx:164-165` — `LegendarySpendLink`: `if (!legendaryGate) return null;` — no Expend chip without the gate.
- `src/components/encounter/MonsterAction.jsx:45,92` + §114 fingerprint — every remaining chip keys off `attack_bonus`/`save_dc`/dice/`automation`; prose-only `{name, description}` arms zero affordance.
- Gate/refusal machinery fully built for structured rows: `legendaryExpendGate` (monsterLegendaryUses.js:174-182), `resolveLegendaryRow`/`delegates_to` resolution (MonsterCardModal.jsx:554-666), MA-0511 shared swallowed-header counter.

## Likely Location / Fix

`public/data/monsters.json` → `gynosphinx.legendary_actions` data shape (§99 template). Fix = author header uses-row + delegates_to on children (app machinery already exists — MA-0511 spend/gate/latch/regain all live; do NOT touch code):

```json
[
  {"name": "Legendary Action Uses: 2", "uses": 2, "description": "The sphinx takes 2 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only immediately after another creature's turn. The sphinx regains expended legendary uses at the start of its turn."},
  {"name": "Claw Attack", "description": "The sphinx makes one claw attack.", "delegates_to": "Claw"},
  {"name": "Teleport (Costs 2 Actions)", ...},
  {"name": "Cast a Spell (Costs 3 Actions)", ...}
]
```

(Death-Knight byte template verified on disk, playbook:168.)

## Notes

- Same defect hits both siblings: **Teleport (Costs 2 Actions)** and **Cast a Spell (Costs 3 Actions)** — prose-only, zero affordance, costs-in-name are inert text (no cost parser; gate is 1-per-expend on the shared header counter per §98/MA-0511).
- Affects **all prose-only legendary rows app-wide** lacking the §99 header row (MA-0511/MA-0510 family).
- MA-0954 live note today already flagged: "card legendary section header+prose children ZERO links no Expend chip cs no legendary keys -> MA-0956 needs legendary mechanism probe" — probe done, zero affordance confirmed.
- Rig left intact (Gynosphinx 1 136/136, Bandit 1 370/999, armed target untouched); no monsters removed; log unmodified (160 entries, join noise only pre-existing); no cache/log clears.
