import type { MemoryService } from '../utils/memory-service.ts';

export interface ParsedMemoryToolArgs {
  mode:
    | 'add'
    | 'search'
    | 'list'
    | 'forget'
    | 'help'
    | 'profile'
    | 'fact_add'
    | 'fact_list'
    | 'fact_verify';
  content?: string;
  query?: string;
  tags?: string[];
  type?: string;
  id?: string;
  scope?: 'project' | 'all-projects';
  memoryId?: string;
  factId?: string;
}

export interface ToolContext {
  sessionID: string;
}

export interface ToolResult {
  output: string;
}

export interface HooksContext {
  memoryService: MemoryService;
  directory: string;
  projectDbId: string;
}
