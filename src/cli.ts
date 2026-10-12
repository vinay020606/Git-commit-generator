import { resolveConfig } from './config.js';
import {
  getStagedChanges,
  getDraftMessage,
  writeCommitMessage,
  installHook,
  uninstallHook,
  isInsideGitRepo
} from './git.js';
import { generateCommitSuggestion } from './ai.js';
import { promptUserAction, promptEditMessage } from './prompt.js';

const VERSION = '1.0.0';

function printHelp(): void {
  console.log(`
git-commit-format v${VERSION}
Stop writing 'wip' and 'fix stuff'. AI-powered Conventional Commit messages.

Usage:
  git-commit-format init               Install prepare-commit-msg hook in current repository
  git-commit-format uninstall          Remove prepare-commit-msg hook from current repository
  git-commit-format hook <file> [src]  Internal handler called by Git prepare-commit-msg hook
  git-commit-format suggest            Generate and print a suggestion for current staged changes
  git-commit-format --help             Show this help message
  git-commit-format --version          Show version

Configuration:
  OPENAI_API_KEY      Your OpenAI API key (or set in .env)
  OPENAI_MODEL        Model to use (default: gpt-4o-mini)
  OPENAI_BASE_URL     Custom OpenAI-compatible endpoint (e.g. Ollama, Groq, OpenRouter)
  GIT_COMMIT_FORMAT_MAX_LINES  Max diff lines sent to AI (default: 200)
`);
}

/**
 * Handles the git prepare-commit-msg hook invocation.
 * Arguments from Git:
 * $1: path to commit message draft file (.git/COMMIT_EDITMSG)
 * $2: source of commit message (message, template, merge, squash, commit)
 * $3: commit SHA (if amend or commit source)
 */
async function handleHook(args: string[]): Promise<void> {
  const [msgFilePath, commitSource] = args;

  // 1. Guard against missing file path
  if (!msgFilePath) {
    process.exit(0);
  }

  // 2. Ignore merge and squash commits
  if (commitSource === 'merge' || commitSource === 'squash') {
    process.exit(0);
  }

  // 3. Load configuration
  const config = resolveConfig();
  if (!config.apiKey) {
    // Graceful exit: no API key configured, do not block the commit
    process.exit(0);
  }

  // 4. Verify staged changes exist
  const changes = getStagedChanges(config.maxDiffLines);
  if (!changes.hasChanges) {
    process.exit(0);
  }

  // 5. Read draft commit message (e.g. from git commit -m "wip")
  const draftMessage = getDraftMessage(msgFilePath);

  // 6. Generate suggestion via AI
  try {
    const suggestion = await generateCommitSuggestion(changes, draftMessage, config);
    if (!suggestion || !suggestion.message) {
      process.exit(0);
    }

    // 7. Interactive user prompt
    const action = await promptUserAction(suggestion.message);

    if (action === 'accept') {
      writeCommitMessage(msgFilePath, suggestion.message);
    } else if (action === 'edit') {
      const edited = await promptEditMessage(suggestion.message);
      if (edited) {
        writeCommitMessage(msgFilePath, edited);
      }
    }
    // If action === 'reject', do nothing: keeps original message
  } catch (err) {
    // Never block commits on unhandled errors
  }

  process.exit(0);
}

/**
 * Standalone suggestion command to inspect what suggestion would be produced.
 */
async function handleSuggest(): Promise<void> {
  if (!isInsideGitRepo()) {
    console.error('Error: Not inside a Git repository.');
    process.exit(1);
  }

  const config = resolveConfig();
  if (!config.apiKey) {
    console.error('Error: OPENAI_API_KEY is not set. Set OPENAI_API_KEY in your environment or repository .env file.');
    process.exit(1);
  }

  const changes = getStagedChanges(config.maxDiffLines);
  if (!changes.hasChanges) {
    console.log('No staged changes found. Run `git add <files>` first.');
    process.exit(0);
  }

  console.log(`Analyzing staged changes (${changes.files.length} files) using ${config.model}...`);
  const suggestion = await generateCommitSuggestion(changes, undefined, config);

  if (!suggestion) {
    console.log('Failed to generate suggestion (check your API key, network, or model settings).');
    process.exit(1);
  }

  console.log(`\nSuggested commit message:\n${suggestion.message}\n`);
}

/**
 * Main CLI entry point.
 */
export async function main(argv = process.argv.slice(2)): Promise<void> {
  const command = argv[0];

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printHelp();
    return;
  }

  if (command === '--version' || command === '-v' || command === 'version') {
    console.log(`git-commit-format v${VERSION}`);
    return;
  }

  if (command === 'init') {
    const res = installHook();
    console.log(res.message);
    return;
  }

  if (command === 'uninstall') {
    const res = uninstallHook();
    console.log(res.message);
    return;
  }

  if (command === 'hook') {
    await handleHook(argv.slice(1));
    return;
  }

  if (command === 'suggest') {
    await handleSuggest();
    return;
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}
