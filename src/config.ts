import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { CommitFormatConfig } from './types.js';

/**
 * Lightweight .env parser to avoid external dependencies.
 */
function parseEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return result;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIndex = line.indexOf('=');
      if (eqIndex === -1) continue;
      const key = line.slice(0, eqIndex).trim();
      let val = line.slice(eqIndex + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  } catch {
    // Ignore read errors
  }
  return result;
}

/**
 * Finds .env file by traversing up from cwd until root or .git
 */
function findRepoEnv(): Record<string, string> {
  let curr = process.cwd();
  while (true) {
    const envPath = path.join(curr, '.env');
    if (fs.existsSync(envPath)) {
      return parseEnvFile(envPath);
    }
    const gitDir = path.join(curr, '.git');
    if (fs.existsSync(gitDir)) {
      break;
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return {};
}

/**
 * Resolves the configuration from process.env, repository .env, and global config.
 */
export function resolveConfig(): CommitFormatConfig {
  const repoEnv = findRepoEnv();

  // Try global config file ~/.git-commit-format/config.json if it exists
  let globalConfig: Record<string, any> = {};
  try {
    const globalPath = path.join(os.homedir(), '.git-commit-format', 'config.json');
    if (fs.existsSync(globalPath)) {
      globalConfig = JSON.parse(fs.readFileSync(globalPath, 'utf-8'));
    }
  } catch {
    // Ignore json parse error
  }

  const apiKey =
    process.env.OPENAI_API_KEY ||
    repoEnv.OPENAI_API_KEY ||
    globalConfig.apiKey ||
    '';

  const model =
    process.env.OPENAI_MODEL ||
    repoEnv.OPENAI_MODEL ||
    globalConfig.model ||
    'gpt-4o-mini';

  const baseUrl =
    process.env.OPENAI_BASE_URL ||
    repoEnv.OPENAI_BASE_URL ||
    globalConfig.baseUrl ||
    'https://api.openai.com/v1';

  const maxDiffLines = parseInt(
    process.env.GIT_COMMIT_FORMAT_MAX_LINES ||
    repoEnv.GIT_COMMIT_FORMAT_MAX_LINES ||
    globalConfig.maxDiffLines ||
    '200',
    10
  );

  const timeoutMs = parseInt(
    process.env.GIT_COMMIT_FORMAT_TIMEOUT ||
    repoEnv.GIT_COMMIT_FORMAT_TIMEOUT ||
    globalConfig.timeoutMs ||
    '8000',
    10
  );

  return {
    apiKey,
    model,
    baseUrl,
    maxDiffLines: isNaN(maxDiffLines) ? 200 : maxDiffLines,
    timeoutMs: isNaN(timeoutMs) ? 8000 : timeoutMs
  };
}
