export interface CommitFormatConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  maxDiffLines: number;
  timeoutMs: number;
}

export type UserAction = 'accept' | 'edit' | 'reject';

export interface StagedChanges {
  diff: string;
  files: string[];
  hasChanges: boolean;
  isTruncated: boolean;
}

export interface SuggestionResult {
  message: string;
  tokensUsed?: number;
}
