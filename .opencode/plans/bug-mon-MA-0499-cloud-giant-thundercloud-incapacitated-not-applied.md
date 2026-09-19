# bug-mon-MA-0499 — Cloud Giant / Thundercloud: condition half of attack never lands (DATA twin of MA-0434/0487/0490)

**Verdict: FAIL (b) — DATA twin**
**Date:** 2026-09-18 · **Campaign:** test-campaign (`Frostpeak: The Company of the Willing Oath`) · **Row:** MA-0499 (actions[2])

## Row under test
```json
{"id":"MA-0499","monster":"Cloud Giant","monsterIndex":"cloud-giant","actionIndex":2,
 "actionName":"Thundercloud","actionType":"attack","attackBonus":12,
 "saveEffect":"The target has the Incapacitated condition until the end of its next turn.",
 "damageDicePrimary":"3d6 + 8","damageTypePrimary":"Thunder","range":"240 ft.",
 "conditions":["incapacitated"]}
```

## Evidence — attack + damage HALF: VERIFIED (4/4 rolls adjudicated, formula exact)
Static disk shape `public/data/monsters.json` @10676–10718:
```json
{"index":2,"name":"Thundercloud","type":"attack","attack_bonus":12,
 "damage":{"dice_count":3,"dice faces":"d6","modifier":8,"damage_type":"Thunder"},
 "range":"240 ft."}
```
- **Absent:** `hit_conditions`, `hit_target_effect`, `secondary_damage`, any condition/effect field → prose-only "Incapacitated" in `description`.

Live GM-mode, Chip attacks, all Thundercloud dice POSTed + logged with full bodies (log ids 8c4652, 208a89, d2c43d, fc922d):

| Hit | d20 | target AC | formula | finalDamage | hp Δ | type:condition | activeConditions |
|---|---|---|---|---|---|---|---|
| 1 | 15 | Knight 18 | 12+15=27 ≥18 | **14** | 76→62 | **0** | [] |
| 2 | 22 | Knight 18 | 12+22=34 ≥18 | **22** | 62→40 | **0** | [] |
| 3 | 7  | Bandit 12 | 12+7=19 ≥12 | **12** | 22→10 | **0** | [] |
| miss | 7 | Knight 18 | 12+7=19 <18 | miss | 0 | 0 | [] |

- Damage exact on every hit: `total == finalDamage == |hpΔ|`, thunder dice {4-6,4-6,2-6}, no rider dice of any kind.
- Bonus/range/flagship AC18 boundary + AC12 consistent: 3 hits + 1 natural miss, as directed.

## Evidence — INCAPACITATED HALF: NEVER LANDS (fingerprint match)
After 3 landed Thundercloud hits (≥2 threshold met):
- `combatSummary` type:effect inspection: **0** chips of type `condition` anywhere; effect chips only ever the native `damage:1` chip (damage-only adjudication, §20 twin pattern).
- Knight + both Bandits: `activeConditions == []` after every hit.
- No INCAPACITATED anywhere in UI or runtime state.

Disk cause: `actions[2]` carries **no `hit_conditions` array**; adjudicator (§20 attack-hit condition channel) has nothing to apply — prose in `description` is display-only. Identical fingerprint to:
- **MA-0434** (`bug-mon-MA-0434-claw-prone-inert.md`) — "every damage-bearing monster attack with inline condition prose is inert"
- **MA-0487** — Tarrasque Swarm Fists prone-inert
- **MA-0490** — Morkoth Lightning Bolt stun-inert

## Fix spec (orchestrator-side)
In `public/data/monsters.json`, cloud-giant `actions[2]` (Thundercloud) add:
```json
"hit_conditions": ["incapacitated"]
```
so the §20 hit-condition channel applies INCAPACITATED on hit.
- **Advisory (§38):** the runtime has no expiry clock for the "until the end of its next turn" duration — same advisory as prior condition rows; duration-bound expiry remains a separate platform gap.
- Optional consistency: same missing-`hit_conditions` pattern should be swept across all monster attack rows with inline condition prose (MA-0434 family).

## Cleanup state at close
- Chip.json reverted to empty (`{hp_current:{}, hp_max:{}, sp_current:{}, sp_max:{}, spells:{}, conditions:[]}`, 407 B), reloaded after disk edit.
- `/api/log` API-empty (0 files, 0 events) after DELETE of all 8 event files.
- `combatSummary` empty, all monsters restored to full starting HP.
- Verify screenshots removed from `public/pipeline-verify/`.
- No writes to save files; `server/pipeline-verify/` never existed on disk ("No such file" — all prior suite rows likewise unverifiable via that path).

## ENVIRONMENT EVENTS (reported, not repaired — per stop-and-report rule)
1. **Mid-session untracked-file sweep:** `docs/pipeline-verify/` (incl. `monster-attack-row-manifest.json`, 514 rows, read verbatim earlier this session) and `public/` runtime dirs vanished from disk between tool calls, then a public tree re-appeared containing **production campaigns** (Frostfall, Testing G1/G2/G3) + test-campaign. HEAD unchanged (d9415823c main) → filesystem-level sweep, NOT a checkout. **This agent ran no git mutation, rm outside public screenshots, or campaign-touching deletes.** All production campaigns were never selected/POSTed; Frostpeak runtime state was already API/JSON-empty before its directory disappeared.
2. **Registry merge-append could not persist:** target `docs/pipeline-verify/monster-attack-row-manifest.json` deleted externally before write landed. Intended record (for orchestrator rebuild):
```json
{"id":"MA-0499","monster":"Cloud Giant","monsterIndex":"cloud-giant","actionIndex":2,
 "actionName":"Thundercloud","actionType":"attack","attackBonus":12,
 "saveEffect":"The target has the Incapacitated condition until the end of its next turn.",
 "damageDicePrimary":"3d6 + 8","damageTypePrimary":"Thunder","range":"240 ft.",
 "conditions":["incapacitated"],
 "verified":"not verified",
 "evidence":"FAIL(b) DATA twin MA-0434/0487/0490 2026-09-18: disk actions[2] prose-only, no hit_conditions/hit_target_effect; live 3 Thundercloud hits Knight AC18 nat15=27 dmg14, nat22=34 dmg22 + Bandit AC12 nat7=19 dmg12, 1 miss nat7 19<18; total==finalDamage==|hpΔ| exact thunder every hit; type:condition count=0 + activeConditions=[] on all targets post-hits → Incapacitated inert; adjudicator damage-only (§20 twin); fix hit_conditions:[incapacitated]; §38 expiry advisory; NOTE docs/pipeline-verify swept from disk mid-session"}
```

## NEW pitfalls
- **Working-tree instability under the suite:** untracked suite artifacts (`docs/pipeline-verify/`, campaign runtime dirs under `public/`) can be swept mid-session by external processes while HEAD stays identical. Registry/`server/pipeline-verify/`-style persistence steps must be disk-checked **immediately after** write, and evidence captured in-session (network trace bodies here were NOT retained on disk — `~/.local/share/opencode/playwright-mcp/` does not exist; only the tool-result inline bodies survived).
- **Dice POSTs are NOT logged** (playbook §dice corrected by observation): `/api/dice/roll` produces no log event; only `POST /api/log` (`{type:"roll", text}`) is persisted and echoed. Roll text POSTed with full `d20=`/`formula=` fields survives as auditable evidence.
- **Quick-picker target swap:** once Chip has a valid-range target, clicking another combatant's initiative arrow re-arms attack mode with that new target in one click — no need to re-click the action chip.
- **Save-damage rolls are not auto-forwarded** (re-confirmed §6): every `save:true` roll auto-POSTs raw dice and strands a pending prompt until manual Apply.
- **Vite serves deleted JSON with 304** from cache: after a disk delete of a previously-fetched file, the browser still answers 304 — do not trust a successful fetch to prove a file exists; disk-check separately.
