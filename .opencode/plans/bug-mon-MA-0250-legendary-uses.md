# MA-0250 — Ancient Silver Dragon "Legendary Action Uses: 3 (4 in Lair)" — FAIL

**Verdict: FAIL — root cause = DATA (header missing numeric `uses`), consumers healthy (MA-0217 fingerprint, 3rd confirm).**

## Evidence (live, test-campaign, 2026-09-15)
1. Header render: `.mc-overlay` header row = prose-only `.mc-action`, 0 dice-links/0 buttons; `.mc-legendary-counter` absent (null). `legendaryHeaderAction()` (monsterLegendaryUses.js:153-157) returns null → MonsterCardBody.jsx:54 ungated branch.
2. Economy probe: Cold Gale `.mc-dice-link` fired 2× same window — picker opened both times, NO refusal popup, NO `legendary_use_refused`/spend log (log 112→113; sole new line = `recharge_failed` Cold Breath, unrelated). `Ancient Silver Dragon 1.monsterLegendaryUses` + `_legendaryUses_usedRound` never created (absent before/between/after). Chill/Pounce prose-only, 0 affordance (MA-0163 family).
3. Round-wrap: Next-walk r14→r15 full loop back to dragon turn-start — turnStartEffects.js:176 `regainLegendaryUses` ran but no-op (no map); zero regain log.
4. Data: ancient-silver `legendary_actions[0]` = bare {name, description} — no `uses`. Fixed sibling adult-silver header carries `uses: 3` (MA-0136 template exists on disk).

## Fix recipe
Add `"uses": 3` to ancient-silver-dragon `legendary_actions[0]` mirroring adult-silver (advisory lair prose appended). WARNING (MA-0164): once `uses` lands, prose-only Chill ("uses Spellcasting to cast Hold Monster") gains a gated chip that BURNS a use with "no resolvable mechanic" — needs `delegates_to:"Spellcasting"` on Chill; Pounce needs numeric/attack metadata or delegates_to. Anchor edit monster-unique (MA-0209).

## Registry delta (report-only)
Ancient Silver Dragon config line: append `| MA-0250 (FAIL legendary header no uses: counter absent, Cold Gale fired 2× ungated zero refusal/spend, monsterLegendaryUses never created, no regain across r14→r15 wrap; Chill/Pounce inert)`
