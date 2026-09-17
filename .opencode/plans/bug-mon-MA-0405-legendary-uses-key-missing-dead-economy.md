# bug-mon-MA-0405 — Blob of Annihilation: legendary header has no `uses` key → dead legendary economy (MA-0375 twin)

**Row:** MA-0405 | monster `blob-of-annihilation` | category `legendary_actions` | actionIndex 0 | "Legendary Action Uses: 3" (other)

## Root cause
`public/data/monsters.json` → Blob `legendary_actions[0]` carries ONLY `{name, description}` — no numeric `uses` field.
`legendaryHeaderAction()` (`src/services/encounters/monsterLegendaryUses.js:153-157`) returns `rows[0]` only `if rows[0]?.uses != null` → returns **null** for Blob.
Downstream all dead:
- `legendaryMaxUses` (:159-164) → null (no authored, no stored stamp)
- `legendaryExpendGate` (:174-183) → `{allowed:false, reason:'no-uses'}` — spend path unreachable via gate
- `MonsterCardBody` renders the UNGATED branch (counter never rendered)

## Evidence (E2E, localhost:5173, header verified `test-campaign`)
1. Disk (curl `/data/monsters.json`): `legendary_actions[0]` = `{name:"Legendary Action Uses: 3", description:"Immediately after another creature's turn…"}` — no `uses` key. Children: Decay (4d6 Necrotic), Grasping Glob, Lashing Goo.
2. EB → exact "Blob of Annihilation" → Join → cs `combatSummary` shows "Blob of Annihilation 1" (blob keys in cs: none legendary).
3. Card DOM, Legendary Actions section: header is prose-only `<strong>"Legendary Action Uses: 3."</strong>` — **no counter widget / no X-of-3 badge**.
4. Forced clicks on Decay "4d6" chip: NO refusal popup, NO gate. Instead a raw ungated damage roll fired — damage popup "Decay / 14 / 4d6: 3, 5, 1, 5 / click to dismiss" + log `roll` "Decay" 4d6=[3,5,1,5] total 14 + spurious `hp_change` (currentHp 0, threshold dead, finalDamage 0, note `combined_damage_roll`). Economy fully bypassed: chip rolls freely with zero expenditure.
5. cs audit: no `monsterLegendaryUses` / `_legendaryUses_usedRound` / `monsterLegendaryActionCooldowns` keys — zero spend, zero latch, zero cooldown. Recovery leg vacuous (`regainLegendaryUses` no-op without stored uses).
6. Log: no `ability_use` spend record, no `legendary_use_refused` refusal record — the MA-0021 economy vocabulary is entirely absent.

## Verdict
**FAIL** — MA-0375 twin: uses-field not authored → `legendaryHeaderAction` null → counter dead, gate dead, and (worse than pure dead children here) child chips roll ungated damage with no spend and no refusal log. Fix: author `uses: 3` on `legendary_actions[0]` (data-only, per MA-0277 no-lair shape; Blob lair variant none).

## Note
Blob registered same-day cluster MA-0401..0404. Cleanup performed: Admin clear change-data + log, verified `{}` / `[]`.
