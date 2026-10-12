import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { StagedChanges } from './types.js';

/**
 * Execute a git command synchronously, returning output as a string.
 */
export function execGit(command: string, cwd = process.cwd()): string {
  try {
    return execSync(`git ${command}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
  } catch (err: any) {
    return '';
  }
}

/**
 * Check whether current directory is inside a git work tree.
 */
export function isInsideGitRepo(cwd = process.cwd()): boolean {
  const res = execGit('rev-parse --is-inside-work-tree', cwd);
  return res === 'true';
}

/**
 * Get the path to the git hooks directory for the repository.
 * Handles normal repositories as well as worktrees and submodule git dirs.
 */
export function getGitHooksDir(cwd = process.cwd()): string {
  const hooksPath = execGit('rev-parse --git-path hooks', cwd);
  if (!hooksPath) {
    return path.join(cwd, '.git', 'hooks');
  }
  return path.isAbsolute(hooksPath) ? hooksPath : path.resolve(cwd, hooksPath);
}

/**
 * Get the staged changes (staged files and unified diff).
 */
export function getStagedChanges(maxLines = 200, cwd = process.cwd()): StagedChanges {
  // Check changed files
  const statusOutput = execGit('diff --cached --name-status', cwd);
  if (!statusOutput) {
    return {
      diff: '',
      files: [],
      hasChanges: false,
      isTruncated: false
    };
  }

  const files = statusOutput
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  // Get unified diff without ANSI color codes
  const fullDiff = execGit('diff --cached --no-color', cwd);
  if (!fullDiff) {
    return {
      diff: '',
      files,
      hasChanges: files.length > 0,
      isTruncated: false
    };
  }

  const lines = fullDiff.split('\n');
  const isTruncated = lines.length > maxLines;
  const truncatedDiff = isTruncated ? lines.slice(0, maxLines).join('\n') : fullDiff;

  return {
    diff: truncatedDiff,
    files,
    hasChanges: true,
    isTruncated
  };
}

/**
 * Read the draft commit message from the file passed by git prepare-commit-msg hook.
 * Discards Git's default comments (lines starting with #).
 */
export function getDraftMessage(msgFilePath: string): string {
  if (!fs.existsSync(msgFilePath)) return '';
  try {
    const raw = fs.readFileSync(msgFilePath, 'utf-8');
    const meaningfulLines = raw
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'));
    return meaningfulLines.join('\n').trim();
  } catch {
    return '';
  }
}

/**
 * Write the new commit message into the prepare-commit-msg target file.
 */
export function writeCommitMessage(msgFilePath: string, message: string): void {
  fs.writeFileSync(msgFilePath, message.trim() + '\n', 'utf-8');
}

/**
 * Prepare hook script content.
 * Designed to work across Linux, macOS, and Windows (Git Bash).
 */
export function generateHookScript(): string {
  return `#!/bin/sh
# git-commit-format hook
# Generates AI-assisted Conventional Commit suggestions

# Resolve executable command
if command -v git-commit-format >/dev/null 2>&1; then
  CMD="git-commit-format"
elif [ -f "./node_modules/.bin/git-commit-format" ]; then
  CMD="./node_modules/.bin/git-commit-format"
else
  CMD="npx --no-install git-commit-format"
fi

# Run with terminal input if a valid controlling TTY exists, otherwise fallback safely
if [ -t 0 ]; then
  $CMD hook "$1" "$2" "$3" 2>/dev/null || true
elif ( : < /dev/tty ) 2>/dev/null; then
  $CMD hook "$1" "$2" "$3" < /dev/tty 2>/dev/null || true
elif ( : < /dev/console ) 2>/dev/null; then
  $CMD hook "$1" "$2" "$3" < /dev/console 2>/dev/null || true
else
  $CMD hook "$1" "$2" "$3" 2>/dev/null || true
fi
`;
}

/**
 * Install the prepare-commit-msg hook into .git/hooks.
 */
export function installHook(cwd = process.cwd()): { success: boolean; message: string } {
  if (!isInsideGitRepo(cwd)) {
    return { success: false, message: 'Not inside a Git repository.' };
  }

  const hooksDir = getGitHooksDir(cwd);
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const hookFile = path.join(hooksDir, 'prepare-commit-msg');

  if (fs.existsSync(hookFile)) {
    const existing = fs.readFileSync(hookFile, 'utf-8');
    if (existing.includes('git-commit-format')) {
      return { success: true, message: 'Hook is already installed in prepare-commit-msg.' };
    }

    // Append to existing hook without breaking Husky or other scripts
    const appendedContent = `\n# git-commit-format\nif ( : < /dev/tty ) 2>/dev/null; then\n  git-commit-format hook "$1" "$2" "$3" < /dev/tty 2>/dev/null || true\nelse\n  git-commit-format hook "$1" "$2" "$3" 2>/dev/null || true\nfi\n`;
    fs.appendFileSync(hookFile, appendedContent, 'utf-8');
    try {
      fs.chmodSync(hookFile, 0o755);
    } catch {}
    return { success: true, message: 'Appended git-commit-format to existing prepare-commit-msg hook.' };
  }

  // Create new hook file
  fs.writeFileSync(hookFile, generateHookScript(), { encoding: 'utf-8', mode: 0o755 });
  try {
    fs.chmodSync(hookFile, 0o755);
  } catch {}
  return { success: true, message: 'Installed prepare-commit-msg hook successfully.' };
}

/**
 * Uninstall the prepare-commit-msg hook.
 */
export function uninstallHook(cwd = process.cwd()): { success: boolean; message: string } {
  if (!isInsideGitRepo(cwd)) {
    return { success: false, message: 'Not inside a Git repository.' };
  }

  const hooksDir = getGitHooksDir(cwd);
  const hookFile = path.join(hooksDir, 'prepare-commit-msg');

  if (!fs.existsSync(hookFile)) {
    return { success: true, message: 'No prepare-commit-msg hook found.' };
  }

  const content = fs.readFileSync(hookFile, 'utf-8');
  if (!content.includes('git-commit-format')) {
    return { success: true, message: 'git-commit-format is not in prepare-commit-msg.' };
  }

  // If the hook only contains git-commit-format, delete it
  if (content.trim() === generateHookScript().trim() || !content.replace(/#.*git-commit-format[\s\S]*?(?:fi|true)/g, '').trim()) {
    fs.unlinkSync(hookFile);
    return { success: true, message: 'Removed prepare-commit-msg hook.' };
  }

  // If it's chained with other hooks, remove only our section
  const cleaned = content
    .replace(/\n# git-commit-format[\s\S]*?(?:fi|true)\n/g, '')
    .trim();
  fs.writeFileSync(hookFile, cleaned + '\n', 'utf-8');
  return { success: true, message: 'Removed git-commit-format from prepare-commit-msg hook.' };
}
