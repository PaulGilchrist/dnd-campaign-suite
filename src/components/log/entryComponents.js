// Log render-dispatch registry (extracted from Log.jsx, backlog 2026-11-20 ZZ).
// Lives in a plain .js module so the server allowlist pin test
// (server/routes/log.schema-gate.test.js) can derive the rendered type list
// from the REAL registry: every key here MUST be in ALLOWED_LOG_TYPES
// (server/routes/log.js) or the producer of a new type silently 400s at the
// POST /log schema gate. Adding a key? Add it to the Set in the same change.
import { RollEntry } from './LogRollEntry.jsx';
import { NoteEntry } from './LogNoteEntry.jsx';
import { NarrativeEntry, RecapEntry } from './LogNarrativeEntry.jsx';
import { LootEntry } from './LogLootEntry.jsx';
import { TravelEntry } from './LogTravelEntry.jsx';
import { ConditionEntry } from './LogConditionEntry.jsx';
import { EncounterEntry } from './LogEncounterEntry.jsx';
import { HpChangeEntry, HealingEntry } from './LogHpHealingEntry.jsx';
import { DeathSaveEntry } from './LogDeathSaveEntry.jsx';
import { SpellEntry, MetamagicEntry } from './LogSpellEntry.jsx';
import { HealingPoolEntry } from './LogHealingPoolEntry.jsx';
import { AbilityUseEntry } from './LogAbilityUseEntry.jsx';
import { RestEntry } from './LogRestEntry.jsx';
import { AutomationEntry } from './LogAutomationEntry.jsx';
import { SaveResultEntry } from './LogSaveResultEntry.jsx';
import { PsionicSorceryEntry } from './LogPsionicSorceryEntry.jsx';
import { SummonsEntry } from './LogSummonsEntry.jsx';
import { SpellEffectEntry } from './LogSpellEffectEntry.jsx';
import { BuffEntry } from './LogBuffEntry.jsx';
import { MusicEntry } from './LogMusicEntry.jsx';
import { AiAuditEntry } from './LogAiAuditEntry.jsx';
import { WriteRejectedEntry } from './LogWriteRejectedEntry.jsx';
import { EnforcementDeniedEntry } from './LogEnforcementDeniedEntry.jsx';

export const ENTRY_COMPONENTS = {
  roll: RollEntry,
  note: NoteEntry,
  narrative: NarrativeEntry,
  session_recap: RecapEntry,
  travel: TravelEntry,
  loot: LootEntry,
  condition: ConditionEntry,
  encounter: EncounterEntry,
  hp_change: HpChangeEntry,
  healing: HealingEntry,
  death_save: DeathSaveEntry,
  spell: SpellEntry,
  metamagic: MetamagicEntry,
  metamagic_use: MetamagicEntry,
  healing_pool: HealingPoolEntry,
  ability_use: AbilityUseEntry,
  short_rest: RestEntry,
  long_rest: RestEntry,
  automation: AutomationEntry,
  save_result: SaveResultEntry,
  psionic_sorcery: PsionicSorceryEntry,
  summons: SummonsEntry,
  spell_effect: SpellEffectEntry,
  buff: BuffEntry,
  music: MusicEntry,
  // AI audit lanes (backlog ai-audit-log-rows-raw-json), whole family unified
  // (backlog 2026-11-22): every ai_* row renders through AiAuditEntry's
  // attributed .log-ai-audit chrome + category label. Producers already stamp
  // a readable description, which formatAiAuditLine renders verbatim — the
  // director/ruling/draft rows only swap chrome, never copy.
  ai_designer: AiAuditEntry,
  ai_refine: AiAuditEntry,
  ai_world: AiAuditEntry,
  ai_world_applied: AiAuditEntry,
  ai_authoring: AiAuditEntry,
  ai_dress: AiAuditEntry,
  ai_director: AiAuditEntry,
  ai_director_applied: AiAuditEntry,
  ai_ruling: AiAuditEntry,
  ai_ruling_applied: AiAuditEntry,
  ai_draft_approved: AiAuditEntry,
  ai_draft_rejected: AiAuditEntry,
  // Server-validator write refusals get their own row (GC improve 2026-11-10)
  // so they never share the enforcement_denied filter with gameplay denials.
  write_rejected: WriteRejectedEntry,
  // Gameplay-lane enforcement refusals get attributed rendering (GGG improve
  // 2026-11-21): creature → target + reason instead of the generic label row.
  enforcement_denied: EnforcementDeniedEntry
};
