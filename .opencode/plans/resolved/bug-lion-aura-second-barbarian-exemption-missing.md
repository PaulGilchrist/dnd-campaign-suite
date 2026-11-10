# Lion rage aura never exempts "another Barbarian who has this option active" — the clause the stance copy advertises has zero implementation (orphaned deferral)

## Summary

Power of the Wilds (Lion) reads "any of your enemies within 5 feet of you have Disadvantage on attack rolls against targets other than you **or another Barbarian who has this option active**". The engine implements only the "other than you" axis (`player.name === targetName` skip in `lionAuraUtils.js`). The second clause is explicitly deferred in a code NOTE that points at a bug file — and that file (`resolved/bug-lion-aura-self-target-exclusion-inert.md`) was resolved without ever tracking this axis, so the deferral is ORPHANED: no open tracker, nothing scheduled, while two pieces of app-authored copy (`combatStanceHandler.js:444` stance text + the classes.json feature description) still promise the full clause. An enemy attacking a second Lion Barbarian is punished with Disadvantage that RAW says is safe.

## Steps to reproduce

1. In test-campaign (gridless, no active map; enforcement OFF): stamp two Lion-option holders via full-store bucket POSTs —
   `POST /:campaign/ElderPaladin {value:{activeBuffs:[{optionName:'Lion',name:'Power of the Wilds (Lion)',effect:'lion',range:'5 ft',duration:'until end of your next turn',source:'Rage'}],hitPoints:200,currentHitPoints:200}}` and the same for `DraconicDragon` (a Barbarian — the faithful second-holder face); stamp `Wild_Sage_Druid` with the same HP keys but NO Lion buff (control victim).
2. EB-Join a Goblin (attacker; unplaced → `resolveMonsterLionAura` lenient `skipRangeCheck` face).
3. FACE 1 (the bug): arm the Goblin card target-select → `DraconicDragon`; open the stat-block; press Scimitar. LIVE BYTES: `mode:"disadvantage"` `rolls:[2,12] total:2`, attribution row "Goblin has Disadvantage on Scimitar: rage aura of ElderPaladin applied — proximity unmeasured (gridless) — GM-enforced", popup chip "Disadv (Lion rage aura — raging ElderPaladin …)". RAW: the attack is EXEMPT (DD is another Barbarian with the option active) → normal roll.
4. CONTROL (aura verifiably live): same press vs `Wild_Sage_Druid` → disadvantage from the DD aura (first-matching bearer) — the aura engine works; only the exemption axis is missing.
5. MIRROR FACE: same press vs `ElderPaladin` → disadvantaged by the *other* bearer's aura (only bearer-self exemption fires) — same missing axis seen from the other side.

Live-proved 2026-11-10 (run GB, follow-up pass): 2 penalty faces + 1 honest control face, bytes above.

## Expected behavior

Per the clause the app itself displays: an enemy attacker pays the Lion Disadvantage for attacking any target within 5 ft of the bearer EXCEPT the bearer itself or another Barbarian who has the Lion option active. FACE 1 and the mirror face should roll `mode:"normal"` (absent any other modifier), with NO aura attribution row/chip for the exempt target.

## Actual behavior

Only `targetName === bearerName` exempts. A second Lion holder gets Disadvantage'd by the first bearer's aura like any other ally.

## Likely location

Confident (code NOTE + census): `src/services/combat/auras/lionAuraUtils.js getLionDisadvantageAgainst` — per-bearer loop, the block at the `if (player.name === targetName) continue;` skip; the NOTE immediately above it states verbatim: "the full clause also exempts 'another Barbarian who has this option active'; that second axis needs a scan for other Lion-buff holders matching the target and is deferred (see bug file)" — the pointed-to bug file is in `resolved/` and contains no such tracker. BOTH production lanes inherit the gap: the sheet sync lane (`resolveLionAura`) and the monster lane (`MonsterCardModal.jsx resolveMonsterLionAura`).

## Suggested fix

Inside the bearer loop, after the self-skip: `const targetHolder = await lionBuffForName(targetName, campaignName); if (targetHolder && targetHolder !== player.name) continue;` — i.e., a per-bearer skip mirroring the existing shape when the TARGET itself carries the Lion option (`activeBuffs` entry `optionName === 'Lion'`, the engine's only runtime proxy for "Barbarian who has this option"; buff presence is sufficient — the option is not otherwise obtainable, per the existing stamp-the-buff rig doctrine). Complexity is already at the module's ceiling per the file's comments — extract the per-bearer predicate. Extend `lionAuraUtils.test.js`: (a) second-holder target ⇒ no disadvantage from the other bearer; (b) control non-holder ⇒ disadvantage; (c) both-lanes parity. Then the code NOTE and the two copy sites match the engine again.

## Severity

Rules correctness (close-but-not-exact): right aura, wrong exemption set — silently punishes the exact tank-the-second-Lion-barbarian tactic the printed feature text invites. Also a process defect: a documented deferral referencing a resolved bug file is untracked work — per owner ruling 2026-11-10 ("bugs take highest priority; nothing parked"), this file is now its tracker.

## Resolution

FIXED 2026-11-10 (fix run). Root cause confirmed exactly as filed: `lionAuraUtils.getLionDisadvantageAgainst` implemented only the bearer-self skip (`player.name === targetName`); the NOTE above it deferred the "another Barbarian who has this option active" axis to an already-resolved bug file (orphaned deferral). Canonical ground truth re-verified: `public/data/2024/classes.json` (Path of the Beast, Power of the Wilds — Lion) prints the full clause, so app copy and engine now agree.

**Fix** (`src/services/combat/auras/lionAuraUtils.js`): the target-holder exemption is bearer-independent (a Lion-stamped target is exempt from EVERY bearer's aura — the stance lane is the only producer of the `optionName:'Lion'` stamp, so stamp presence is the runtime proxy per rig doctrine), so it lands as ONE name-keyed read BEFORE the bearer loop, not per-bearer inside it:
- `lionBuffForName(name, campaignName)` extracted (the old `lionBuffFor(player,…)` delegates to it — same `getRuntimeValue(name,'activeBuffs')` + `optionName==='Lion'` matcher);
- `targetIsExemptFromLionAuras(targetName, campaignName)` predicate (null/omitted target stays lenient, mirroring the self-skip law) + pre-loop early return `{disadvantage:false}`;
- orphaned NOTE retired into a comment pointing at this file.
Both production lanes inherit the fix structurally — sheet sync (`contextBuilder-sync.resolveLionAura`), sheet map (`contextBuilder-map` accumulateAuraCounts) and monster-card (`MonsterCardModal.resolveMonsterLionAura`) all thread `targetName` into this single util. The complexity-15 ceiling the bug file warned about is real: the early return tripped `complexity:16`, resolved by extracting `lionRangeFeet(lionBuff)` (behaviour-preserving, mirrors the module's existing per-axis predicate idiom).

**Regression tests** (`src/services/combat/auras/lionAuraUtils.test.js`): new describe block "second-holder target exemption" — (a) measured grid lane exempt face, (b) skipRangeCheck lenient face, (c) gridless combat-context face (monster-lane parity), (d) control: non-holder target still penalized by the first bearer, (e) near-miss `optionName:'Bear'` stamp grants no exemption. One PRE-EXISTING test ("a second in-range bearer still forces disadvantage when the target is the first bearer") pinned the old self-only semantics and contradicted RAW once axis 2 was implemented (a Lion-holder target is exempt from the second bearer too) — rewritten to preserve its never-masks intent with a NON-holder target and an out-of-range first bearer.

**Live re-verification (test-campaign, monster-card lane, gridless/unplaced attacker, enforcement off)** — exact repro of the filed faces:
- PRE-FIX: Scimitar vs `DraconicDragon` (2nd holder) → `mode:"disadvantage"` rolls [11,15] + row "Goblin has Disadvantage on Scimitar: rage aura of ElderPaladin applied — proximity unmeasured (gridless) — GM-enforced" + popup chip "Disadv (Lion rage aura — raging ElderPaladin …)". Control vs `Wild_Sage_Druid` → disadvantaged (aura live). Mirror vs `ElderPaladin` → disadvantaged by the DD aura. Bug reproduced byte-for-byte per the filing.
- POST-FIX, same rig re-ridden after reload: vs `DraconicDragon` → popup "d20 16 +4" single die, log row `mode:"normal"` total 16, NO aura attribution row; vs `ElderPaladin` → `mode:"normal"` total 20 (nat-20 crit), NO aura row; vs `Wild_Sage_Druid` → `mode:"disadvantage"` kept WITH the "rage aura of DraconicDragon" row (adjacent behavior intact). The two exempt post-fix rolls carry `rolls:[a,b]` second entries — that is the separate known open bug `bug-monster-attacks-log-phantom-second-die` (mode is the truth per that law), untouched here.
- Exit ritual: closed tab → admin clear-change-data + clear-log → GET `{}`/`[]` re-checked two-pass (no rehydration); servers killed; `git status --porcelain public/campaigns/` empty.

**Suites**: `npx vitest run src/services/combat/auras` → 12 files / 249 tests PASS (lion file 37/37); consumer lanes (`contextBuilder-sync.wolf-aura`, `contextBuilder-map`, `src/components/encounter/`) → 394 files / 2017 tests PASS; `npm run lint` → zero warnings; `node .opencode/plans/no-timers-guard.mjs` → OK.

Files changed: `src/services/combat/auras/lionAuraUtils.js`, `src/services/combat/auras/lionAuraUtils.test.js`, `docs/test-setup-playbook.md` (§Auras bullet edited in place). No changes needed in `MonsterCardModal.jsx` / `contextBuilder-*.js` (single-source util covers all lanes) and none in the 5e twin — the Lion stance is 2024-only data with one shared util.
