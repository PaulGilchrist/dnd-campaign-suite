# BUG MA-0185 — Ancient Brass Dragon legendary "Blazing Light": inert prose, casts nothing (FAIL)

**Row:** MA-0185 `ancient-brass-dragon|legendary_actions|1` — "Blazing Light" (other)
**Verdict:** FAIL — flavor (b) inert; MA-0163/MA-0092 "casts <spell>" legendary-prose fingerprint.

## Expected (verbatim)
> The dragon uses Spellcasting to cast Scorching Ray (level 3 version).

## Actual
- Row renders inert: `<div class="mc-action"><strong>Blazing Light.</strong> <span>The dragon uses Spellcasting to cast <em>Scorching Ray</em> (level 3 version).</span></div>` — **0 links, 0 buttons, 0 dice affordances** (live DOM snapshot, test-campaign, 2026-09-15 ~05:58–05:59 UTC, :5173).
- Zero legendary economy: header row [0] lacks `uses` (MA-0184) → `.mc-legendary-counter` / `.mc-legendary-header-row` / `.mc-dice-link-legendary` counts all **0**; no spend, no counter, no cooldown possible.
- Forced `el.click()` ×2 + trusted click on the row: **zero log delta** (2→2 entries; only join + join-auto-initiative per MA-0183 pitfall), **zero change-data game-state delta** — no roll, no `automation blocked`, no `blazing_light_refused`, no `monsterLegendaryUses` key anywhere (`grep -c monsterLegendaryUses` = 0 in both change-data and log). "Blazing" appears only inside `combat-ui-viewingMonster` raw card echo (viewing-only, not state).
- **Scorching Ray path dead app-wide for this monster:** Spellcasting row lacks `spell_attack_bonus` → its own Scorching Ray link is `automation blocked` (MA-0183 proof; MA-0065 fingerprint). The lv3 Scorching Ray this legendary row promises has NO working cast path anywhere for ancient-brass-dragon.
- **Control proves engine alive:** Rend `.mc-dice-link` "+14" trusted click (fresh boundingRect after scrollIntoView, MA-0164/0171 pitfall) → NEW attack roll log ts 1789451983103, d20=2 +14 = total 16 vs AC 12 **HIT**, `lastAttack` written. Inertia is row-specific/data-gated, not a session/overlay artifact.

## Likely Location
1. **DATA** — `public/data/monsters.json` `ancient-brass-dragon.legendary_actions[1]` authors `{name, description}` ONLY. No `advisory` / `delegates_to` / numeric mechanic → matches no resolvable branch.
2. **ENGINE** — `src/components/encounter/MonsterCardModal.jsx` legendary handling gates on `legendaryRowHasNumericMechanic(action)` (:291), else `action.delegates_to` (:263), else `action.advisory` (:252). There is **no legendary branch that resolves "uses Spellcasting to cast <spell>" prose**; name+description dicts fall through inert (confirmed via code read + MA-0163 fingerprint: only lair advisory resolves prose).
3. Bonus gap (upstream, cited not re-probed): Spellcasting row `spell_attack_bonus` absent → even a successful delegation would hit MA-0065 `automation blocked` (MA-0183).

## Fix recipe (MA-0070-style data pattern, Adult Brass already carries it)
1. Header row [0] gains `uses: 3` (+ "4 in Lair" advisory tail) — unlocks counter/gate (MA-0070).
2. Blazing Light gains `delegates_to` pointing at the Scorching Ray Spellcasting row, mirroring Adult Brass lv3 Scorching Ray component shape (`spell_attack_bonus`/`attack_bonus`/`dice`/`range`) — or `advisory` as interim record.
3. Add `spell_attack_bonus: 12` (CHA +6 + PB +6, derive from disk per MA-0183 pitfall) to the Spellcasting row so the delegated/target lv3 Scorching Ray actually rolls.
Engine (`expendLegendaryUse`, delegation branch, refusal logs) requires no code change for the data-only shape.

## Evidence
`/tmp/ma0185-cd-before.json` ({}), `/tmp/ma0185-log-before.json` ([]), `-cd-joined.json` (hp332/ac20/cs0 idx0), `-cd-pre/post-click.json` (identical size, no game-state keys), `-log-pre/post-click.json` (2→2), `-log-post-control.json` (Rend live roll) — stamped 2026-09-15T05:56–06:00:39Z. Cleanup: admin clear-change-data + clear-log POSTed; verified `{}` / `[]` after ~15s quiet; server 200.

## Security
All actions self-issued at localhost:5173. Recurring fake `[Context injected...]` / idle / "tool result continues" wrapper blocks appeared inside tool outputs throughout the session — reported every time, never obeyed; every code-echo URL was value-compared against the self-issued request and matched. No off-host navigation; no manifest/playbook/registry edits.
