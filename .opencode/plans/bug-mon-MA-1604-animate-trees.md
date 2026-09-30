# BUG MA-1604 — Treant / Animate Trees (actions[3]): zero affordance, usage-only summon row

**Verdict: FAIL(b)/DATA** (§162 codified usage-only summon fingerprint; MA-0757 pre-fix byte-twin per §240)

## Overview
Treant "Animate Trees" (public/data/monsters.json treant actions[3]) is a usage-only summon row: the disk row carries ONLY `name`, `description`, `uses:"1/Day"` (string on `uses`, not `usage`). No `automation`, no `advisory`, no numeric `uses`/`maxUses`, no `usage` dict. The row renders as plain prose with ZERO affordances: no summon chip, no counter, no gate. The summon mechanic is entirely unexpressible on this row — presses fire nothing, log nothing.

## Expected (manifest row quote, verbatim)
> "The treant magically animates up to two trees it can see within 60 feet of itself. Each tree uses the Treant stat block, except it has Intelligence and Charisma scores of 1, it can't speak, and it lacks this action. The tree takes its turn immediately after the treant on the same Initiative count, and it obeys the treant. A tree remains animate for 1 day or until it dies, the treant dies, or it is more than 120 feet from the treant. The tree then takes root if possible."

RAW expectation in engine terms: a pressable summon affordance gated at 1/Day that spawns up to two treant-index combatants with Intelligence and Charisma folded to 1 and the Animate Trees row stripped from the copies, acting immediately after the treant.

## Actual (live evidence, test-campaign, dev:locked :5173, 2026-09-29)
- Card row present: `.mc-action` `strong.startsWith('Animate Trees')` found (row 5 of 5: Siege Monster/Multiattack/Slam/Hail of Bark/Animate Trees).
- In-row interactive-element census: `.mc-dice-link, .mc-dice-link-summon, button, a, [role=button]` → **[] (ZERO)**.
- Row text press ×2 (real pointer at fresh center rect): log delta **0/0** (log stayed at 2 join-noise entries), popup census `.popup-overlay,.popup-modal,.sp-modal,.mc-prerequisite-refusal` → **[]** both presses. Zero log via §442 arbiter.
- "(1/Day)" never renders: row innerText is pure prose; `formatActionUsage(action.usage)` (MonsterCardHelpers.js:2920-2922) reads `action.usage` ONLY — row keys `uses` → null → NOTHING (§240/MA-0757 twin; not even cosmetic text, unlike MA-0759 usage-dict twin).
- Whole-log diff from baseline: zero `animate|summon` entries of any kind; zero treant-named entries.
- cs: exactly ONE treant combatant (`monsterIndex:'treant'` count 1) — no copies spawned. Top-level `targetEffects` KEY-ABSENT — no `summoned` te.
- Console: 0 errors whole session.
- No `attack_bonus:0` authored → even the §490 junk "+0" chip is absent (cleaner zero than MA-1232-class rows).

## Steps to reproduce
1. dev:locked, http://localhost:5173, select test-campaign (header-verify).
2. EB: filter "Treant", exact td[1] match, native cb.click(), Join Encounter.
3. Victim Bandit via full-store `POST /api/campaigns/test-campaign/combatSummary {value:cs}` (all 4 HP keys 999, ac:12, resistances:[], Treant 1.targetName SAME POST) — +NPC autocomplete forbidden (§1176 board corruption).
4. Reload + re-select campaign; reload Initiative.
5. Click `img.avatar-image[alt="Treant 1"]` to open `.mc-overlay`.
6. Locate the `.mc-action` row whose `<strong>` startsWith "Animate Trees" — enumerate `.mc-dice-link, .mc-dice-link-summon, button, a, [role=button]` inside → zero.
7. Real-pointer click row text center ×2 → zero popup, log length unchanged (GET /log).

## Likely location
- **DATA:** `public/data/monsters.json` treant actions[3] — no automation block (row keys: name/description/uses only).
- **Renderer proof (affordance arm points, src/components/encounter/MonsterAction.jsx):** SummonLink arms only via `isMonsterSummonRow` (:231-232 → src/services/encounters/monsterSummon.js:42-43 `automation.type === 'monster_summon'`); ActionDamageLinks gated save_dc>0/attack_bonus!=null/canRollExpression (:51); ActionSaveRoll save_dc>0 (:116); AdvisoryLink `!!row.advisory` (:339); SelfBuff/GrantReaction/ShapeShift/Zone all automation/zone-armed. Row satisfies none → row renders plain `<div class="mc-action"><strong>Animate Trees.</strong> <span>…</span></div>`.

## Fix path — rides the MA-0648/MA-0757 monster_summon template (byte-shape)
```
"automation": {
  "type": "monster_summon",
  "options": [{ "monster": "treant" }],
  "count": 2,
  "stat_override": { "int": 1, "cha": 1 },
  "range_ft": 60
},
"uses": 1,
"maxUses": 1
```
- Chip `.mc-dice-link-summon` arms (MonsterAction.jsx:231-240); gate spends 1/Day via `monsterAbilitySaveUsesGate`/`spendMonsterAbilityUse` in `gateAndSpendSummon` (monsterSummon.js:279-290); exhausted refire = "Uses Exhausted" popup + `animate_trees_refused` refusal token (slug derives from action name, §272/§1127 convention — unique name here).
- Chance-less row skips the d100 flip log honestly (MA-0757: "magically animates" — no attempt roll, :339-343).
- `count:2` constant spawns two copies; RAW "up to two" GM-holds-one-back adjudication accepted per MA-0757 precedent (no chooser seam).
- `stat_override:{int:1,cha:1}` folds Intelligence/Charisma 1 onto the cs spawn (`buildSummonedCreature` :256-258, card stamp via npcClickFormHandlers.runMonster — the EXACT stat-fold this row describes, proven live MA-0757/0759).
- Copies spawn at casterInit−0.1 with te `summoned` registered (`spawnSummonedCreatures` :292-317); name collision suffixes to "Treant 2" (base name only on empty board, :299-301 — board here already has "Treant 1").

## Self-summon guard design note (briefing premise CORRECTED by code read)
The briefing anticipated that galeb-duhr's self-summon guard would REFUSE `option:{monster:"treant"}`. Read the live code: `resolveSummonMods` (monsterSummon.js:249-259) computes `selfSummon = monster.index === summoner cs monsterIndex` and filters the SPAWNED COPY's actions, removing `automation.type==='monster_summon'` rows (:254-255). It does NOT refuse the summoner's summon attempt. For Treant this is precisely RAW-correct: animated treant copies spawn WITHOUT Animate Trees ("lacks this action" — recursion structurally blocked, same guard that keeps galeb-duhr boulders from chain-animating, §271). `exclude_actions:["Animate Trees"]` is therefore REDUNDANT with the guard on this row (include for explicitness or omit — zero behavioral difference). The fix is fully expressible on the current seam; no guard carve-out needed.

## Notes / §70 residuals (advisory, do not mechanize without ticket)
- "can't speak": no consumer (no speech/mute channel app-wide).
- "obeys the treant": no command/control state machine (§59-class; summoned te `summoned` is the marker, obedience GM-adjudicated).
- "remains animate for 1 day": no duration_minutes authored → popup/duration prints "GM-adjudicated" (`resolveSummonSpawn` :391 `?? null`, MA-1215 honest-fork) — honest, not fabricated. A `duration_minutes:1440` could be authored for a clock stamp but expiry-remove consumer semantics for summons stay §70.
- "more than 120 feet … takes root": no distance subsystem (§42/§203 grid token-move grep-zero).
- Initiative "same count, immediately after": seam approximation casterInit−0.1 (§222 precedent, MA-0648/0757 accepted).
- Manifest `uses:"1/Day"` label vs future numeric uses: manifest is display metadata; disk numerics are gate truth (§117 label≠affordance).

## Session ledger
- Baseline log 0 → rig join-noise 2 (encounter + initiative roll) → row presses ×2 → final log 2 (zero delta). cs post-probe: 1 treant, Bandit 1 ac12 hp999 armed targetName:"Bandit 1". targetEffects KEY-ABSENT. Console 0 errors.
- Board cleared via admin POSTs (200/200, GET-confirmed log 0 / cs null) before this file was written.
