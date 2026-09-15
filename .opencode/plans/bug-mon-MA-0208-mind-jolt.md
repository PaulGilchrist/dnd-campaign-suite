# BUG MA-0208 — Ancient Copper Dragon legendary_actions[2] "Mind Jolt" (FAIL, flavor (b) inert)

Date: 2026-09-15 | Campaign: test-campaign | Manifest row: MA-0208
stableKey: `ancient-copper-dragon|legendary_actions|2` | actionType: other
MV-18 header (campaign test-campaign).

## Row data (monsters.json verbatim)
`legendary_actions[2]` keys = **name, description only**:
> "Mind Jolt" — "The dragon uses Spellcasting to cast <em>Mind Spike</em> (level 5 version). The dragon can't take this action again until the start of its next turn."

No `delegates_to`, no `spell`, no `save_dc`, no `dice`, no `automation`.

## Evidence (all self-issued localhost calls / Playwright at :5173)
1. **Registry re-join verified** (cleared after MA-0207): EB join "Ancient Copper Dragon 1" hp 367 ac 21 csIndex 0, monsterIndex ancient-copper-dragon, init 8. Target armed cs.targetName="Disciplined_Monk" @10:12:30Z.
2. **DOM**: Mind Jolt row = `<div class="mc-action">` → `<strong>Mind Jolt.</strong><span>…</span>`. **Links 0, buttons 0, clickables 0.**
3. **Zero-delta**: forced `el.click()`×2 + trusted `mouse.click(954,448)` → log stayed **2→2** entries (baseline join+init-roll), no popup/overlay, no `pendingSavePrompts`/`lastAttack`/`monsterLegendaryUses` keys (change-data @10:13:09Z).
4. **CONTROL (engine alive)**: Spellcasting row `.mc-dice-link-spell` "Mind Spike" click → prompt "Disciplined_Monk must make a WIS saving throw. DC 21. Half damage on successful save" fired; `pendingSavePrompts` saveType WIS saveDc 21 dcSuccess half; Roll Save nat20+10=30 success → damage log **formula "6d8"** rolls [2,3,6,5,2,1]=19 → **finalDamage 9** (half); `lastAttack.attackName:"Mind Spike"` isSpellDamage:true @1789467244824. Lv5 formula per MA-0201/0205 (findMonsterSpell 2024-only spell onto 5e-path row).
5. **Header economy**: legendary header renders "Legendary Action Uses: 3 (4 in Lair)" as NAME TEXT only — no numeric `uses` key in dict → no counter/economy (**MA-0206-owned**, cited not re-litigated).
6. **grep-cite**: `mind jolt` / `mind_jolt` / `mindjolt` in src/ (+server) = **zero consumers**. Producers of cast links live only on Spellcasting path: `.mc-dice-link-spell` (MonsterAction.jsx), `findMonsterSpell` (MonsterCardModal.jsx); `LegendarySpendLink` (MonsterAction.jsx:148-159) renders only with `legendaryGate` (header `uses`) — no legendary branch resolves "uses Spellcasting to cast X" prose.

## Verdict
**FAIL flavor (b)** — inert name/description-only cast-prose legendary (MA-0163 fingerprint family; 5th instance with MA-0196 Guiding Light et al.). Row itself does NOT cast lv5 Mind Spike; the Spellcasting row does.

## Fix recipe (data-only)
`legendary_actions[2]`: `delegates_to: "Spellcasting"`, `spell: "Mind Spike"`, `upcast: 5` — or auto-cast row key wired to the existing spell-link producer. Per-action "can't take again until next turn" clause is dead while header lacks `uses` — economy fix is MA-0206-owned (header `uses:3` per MA-0070 pattern), cited not duplicated here.

## Registry line to update on fix
docs/test-monster-registry.json "Ancient Copper Dragon" → verifiedRow append:
`MA-0208 (FAIL inert Mind Jolt cast-prose legendary; control Spellcasting Mind Spike lv5 6d8 WIS DC21 live; ungated cite MA-0206)`
