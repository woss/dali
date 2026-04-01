interface DaliCommand {
  template: string;
  description?: string;
  agent?: string;
  model?: string;
  subtask?: boolean;
}

export const daliMigrateOpenCodeDb: DaliCommand = {
  template: `Migrate OpenCode database to DaliMemory db. run the dali_migrate_oc_db tool to perform the migration.`,
  description: `Migrate OpenCode database to DaliMemory db`,
  subtask: true,
};

export const daliRemember: DaliCommand = {
  template:
    'Manage persistent memories with SurrealDB backend. run the dali_memory tool with $ARGUMENTS to perform memory operations.',
  description: 'Manage persistent memories with SurrealDB backend',
  subtask: true,
};

export const daliExtractFacts: DaliCommand = {
  template:
    'Review the recent conversation for knowledge facts about the user, preferences, project decisions, or architecture. For each fact, call dali_memory mode=fact_add content="<the fact>". Optionally link to a memory with memoryId. Do not skip facts.',
  description: 'Extract and store knowledge facts from conversation',
  subtask: true,
};

export const noop: DaliCommand = {
  template: 'do nothing. just stop',
  subtask: false,
};
