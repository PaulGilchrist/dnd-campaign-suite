# MA-0781 Ghost "Horrific Visage" — FAIL(a) / DATA one-field: `dc_success` absent → half-on-success leak

## Verdict
FAIL(a) — cone-picker + DC/type + fail-leg all LIVE and exact; SUCCESS leg pays HALF damage in violation of RAW (success = immunity, zero damage). One-field DATA fix: author `dc_success:"none"` on `monsters.json` ghost `actions[3]`. MA-0481 / MA-0622 / MA-0768 family.

## Disk (public/data/monsters.json, ghost actions[3], monster index 221)
```json
{
  "name": "Horrific Visage",
  "description": "Wisdom Saving Throw: DC 13, each creature in a 60-foot <strong>Cone</strong> that can see the ghost and isn't an Undead. Failure: 10 (2d6 + 3) Psychic damage, and the target has the <strong>Frightened</strong> condition until the start of the ghost's next turn. Success: The target is immune to this ghost's Horrific Visage for 24 hours.",
  "save_dc": 13,
  "save_type": "Wisdom",
  "range": "60-foot Cone",
  "save_effect": "The target has the Frightened condition until the start of the ghost's next turn.",
  "immunity": "Success: The target is immune to this ghost's Horrific Visage for 24 hours.",
  "damage_dice_primary": "2d6 + 3",
  "damage_type_primary": "Psychic"
}
```
- range "60-foot Cone" ✓ parses breathAoeShape → SaveAttackAoeModal picker (§62).
- save_dc 13 Wisdom ✓, "2d6 + 3" Psychic avg 10 ✓, save_effect carries canonical "Frightened" ✓ (§157).
- **`dc_success` ABSENT** — success prose = immunity ONLY, no damage mention → RAW success pays ZERO damage.

## Leak seam
- `resolveBlockSaveDcSuccess` MonsterCardModal.jsx:212-215 → `action.dc_success ?? 'half'` (MV-20 half default).
- Threaded into picker ctx (:328) → SaveAttackAoeModal.jsx:160 `computeDamageAfterEvasion(rawDamage, success, dcSuccess, ...)`.
- Picker UI honestly echoes the default: modal prints "On a successful save, target takes half damage."

## Live ledger (test-campaign, Ghost 1 + Bandit 1 + Knight 1, cs maxHp/currentHp 999, FULL-word saveBonuses via full-store cs POST §160/§119)
Volley 1 (`wisdom:-5` fail-rig — rolled high, became incidental success-legs):
- Knight 1: nat 19 −5 = 14 ✓ SUCCESS raw [6,5]+3=14 → **fd 7** (halved) — hp 999→992 Δ−7 exact
- Bandit 1: nat 18 −5 = 13 ✓ SUCCESS raw [2,2]+3=7 → **fd 3** (halved) — hp 999→996 Δ−3 exact
Volley 2 (`wisdom:-19` deterministic FAIL leg):
- Knight 1: nat 17 −19 = −2 ✗ raw [4,3]+3=10 → **fd 10 FULL** — 992→982 exact; Frightened `condition applied` w/ source meta "failed the Wisdom save (DC 13) … until the start of the ghost's next turn (GM-enforced)"; same-pass `condition removed reason:"took damage"` (§178 house-rule — grant judged by log+meta)
- Bandit 1: nat 4 −19 = −15 ✗ raw [2,5]+3=10 → **fd 10 FULL** — 999→986 exact; Frightened applied+removed twin
Volley 3 (`wisdom:+19` deterministic SUCCESS leg, nat-floor proof):
- Knight 1: nat 3 +19 = 22 ✓ raw [6,4]+3=13 → **fd 6 HALF — RAW says 0** — hp 982→976 exact
- Bandit 1: nat 2 +19 = 21 ✓ raw [5,1]+3=9 → **fd 4 HALF — RAW says 0** — hp 986→982 exact
- Every success entry stamps `dcSuccess:"half"`, `saveResult:"success"`, `finalDamage>0`. ZERO new condition grants on success legs (fail-only grant ✓).
- 4/4 success legs paid half (7,3,6,4). Machine log: rollType "save-damage", formula "2d6 + 3", damageType "Psychic".

## Picker/chrome (§62/§100/§160/§166)
- Save chip "DC 13 Wisdom" (mc-dice-link-save-clickable) — FIRST click absorbed, 2nd fired (§138); confirm lands first click; gridless cone picker opens, all non-attacker targets selectable; ability_use log "Horrific Visage: Selecting 2 target(s) for save (DC 13 Wisdom)" every volley; results = Close-only `.sp-modal` ("Horrific Visage — Results … Close"), damage applied at confirm, no Done.

## 24h immunity = advisory (§69 codified)
Only consumer of a 24h-success-immunity te is `frightful_presence_immunity` (targetEffectDefinitions.js:193) via frightfulPresenceService/clearExpirationEffects.js:408 — Frightful-Presence-service-only; generic block-save picker never grants it. Live: top-level targetEffects empty after success volleys. GM-adjudicated; not this row's defect axis.

## Fix
Add one field to ghost actions[3]: `"dc_success": "none"` (byte-twin MA-0481/MA-0622 Terrifying-presence rows). No code change — `resolveBlockSaveDcSuccess` honors authored value verbatim; SaveAttackAoeModal success leg → computeDamageAfterEvasion 0 via dcSuccess none.

## Ops notes (new for registry/playbook)
- Save chips absorb first click ×3/3 volleys here (real mouse route); picker confirm button never absorbed (3/3 first click).
- ±19 full-word `saveBonuses` flips via full-store cs POST give deterministic both-legs control on the picker route (§160 extended to −19 always-fail floor); −5 failed twice (nat 18/19), judge each save individually (§75).
- Erroring mid-script still landed the +19 flip+volley (§137 quadruple-confirmed) — audit log before refiring.
- Results-modal Close click: native in-evaluate click reliable.
- Admin clears + console: see checkpoint.
