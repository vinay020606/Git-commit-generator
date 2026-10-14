import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

/**
 * 1. Simple Configuration
 * Reads from process.env or repository .env file
 */
export function getConfig() {
  let envFile = {};
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const [k, ...v] = line.trim().split('=');
        if (k && !k.startsWith('#')) {
          envFile[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    } catch {}
  }

  return {
    apiKey: process.env.OPENAI_API_KEY || envFile.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || envFile.OPENAI_MODEL || 'gpt-4o-mini',
    baseUrl: (process.env.OPENAI_BASE_URL || envFile.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    maxLines: parseInt(process.env.GIT_COMMIT_GENERATOR_MAX_LINES || process.env.GIT_COMMIT_FORMAT_MAX_LINES || envFile.GIT_COMMIT_GENERATOR_MAX_LINES || envFile.GIT_COMMIT_FORMAT_MAX_LINES || '200', 10),
    timeout: parseInt(process.env.GIT_COMMIT_GENERATOR_TIMEOUT || process.env.GIT_COMMIT_FORMAT_TIMEOUT || envFile.GIT_COMMIT_GENERATOR_TIMEOUT || envFile.GIT_COMMIT_FORMAT_TIMEOUT || '8000', 10)
  };
}

/**
 * 2. Git Helpers
 */
export function runGit(cmd) {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

export function getStagedDiff(maxLines = 200) {
  const diff = runGit('diff --cached --no-color');
  if (!diff) return null;

  const lines = diff.split('\n');
  return lines.slice(0, maxLines).join('\n');
}

export function getDraftMessage(msgFile) {
  if (!msgFile || !fs.existsSync(msgFile)) return '';
  try {
    return fs.readFileSync(msgFile, 'utf-8')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
      .join('\n');
  } catch {
    return '';
  }
}

export function saveCommitMessage(msgFile, text) {
  fs.writeFileSync(msgFile, text.trim() + '\n', 'utf-8');
}

/**
 * 3. AI Commit Message Generator
 */
export async function getAiCommitSuggestion(diff, draftHint, config) {
  if (!config.apiKey || !diff) return null;

  const systemPrompt = `You are a Git commit generator.
Analyze the git diff and output a single Conventional Commit message.
Format: <type>(<optional-scope>): <short description>
Types: feat, fix, docs, style, refactor, perf, test, build, chore.
Rules:
- Output ONLY the commit message line. No quotes, no markdown, no explanation.
- Present tense, imperative mood (e.g. "add" not "added").
- Lowercase description, no trailing period, under 72 characters.`;

  let userContent = `Git staged diff:\n${diff}\n`;
  if (draftHint && draftHint !== 'wip') {
    userContent = `User hint: "${draftHint}"\n\n` + userContent;
  }

  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.2,
        max_tokens: 80,
        store: false
      }),
      signal: AbortSignal.timeout(config.timeout)
    });

    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';

    // Clean formatting (remove backticks or quotes if any)
    const cleaned = raw.replace(/^[`"']|[`"']$/g, '').split('\n')[0].trim();
    return cleaned || null;
  } catch {
    return null;
  }
}

/**
 * 4. Cross-Platform Terminal Prompt
 */
function getTtyInputStream() {
  if (process.stdin.isTTY) return process.stdin;

  // On Windows, use the Win32 console device
  if (process.platform === 'win32') {
    for (const dev of ['\\\\.\\CON', 'CONIN$']) {
      try {
        const fd = fs.openSync(dev, 'r');
        return fs.createReadStream('', { fd });
      } catch {}
    }
  }

  // On macOS/Linux, use /dev/tty
  try {
    const fd = fs.openSync('/dev/tty', 'r');
    return fs.createReadStream('', { fd });
  } catch {}

  return null;
}

export async function promptUser(suggestion) {
  const tty = getTtyInputStream();
  if (!tty) return 'reject';

  process.stdout.write(
    `\n\x1b[1mSuggested:\x1b[0m \x1b[32m${suggestion}\x1b[0m\n` +
    `\x1b[2m[enter/a] accept  [e] edit  [r] reject\x1b[0m `
  );

  return new Promise((resolve) => {
    if (tty.setRawMode) {
      tty.setRawMode(true);
      tty.resume();

      const onData = (data) => {
        const char = data.toString('utf-8').toLowerCase();
        tty.setRawMode(false);
        tty.pause();
        tty.removeListener('data', onData);
        process.stdout.write('\n');

        if (char === '\r' || char === '\n' || char === 'a') {
          resolve('accept');
        } else if (char === 'e') {
          resolve('edit');
        } else {
          resolve('reject');
        }
      };
      tty.on('data', onData);
    } else {
      const rl = readline.createInterface({ input: tty, output: process.stdout });
      rl.question('', (answer) => {
        rl.close();
        const a = answer.trim().toLowerCase();
        if (a === '' || a === 'a') resolve('accept');
        else if (a === 'e') resolve('edit');
        else resolve('reject');
      });
    }
  });
}

export async function promptEdit(suggestion) {
  const tty = getTtyInputStream() || process.stdin;
  const rl = readline.createInterface({ input: tty, output: process.stdout });

  return new Promise((resolve) => {
    rl.question(`Edit message: `, (answer) => {
      rl.close();
      resolve(answer.trim() || suggestion);
    });
    rl.write(suggestion);
  });
}

/**
 * 5. Git Hook Setup
 */
export function getHookScript() {
  return `#!/bin/sh
# git-commit-generator hook
if command -v git-commit-generator >/dev/null 2>&1; then
  CMD="git-commit-generator"
elif command -v git-commit-format >/dev/null 2>&1; then
  CMD="git-commit-format"
elif [ -f "./bin/cli.js" ]; then
  CMD="node ./bin/cli.js"
else
  CMD="npx --no-install git-commit-generator"
fi

if ( : < /dev/tty ) 2>/dev/null; then
  $CMD hook "$1" "$2" "$3" < /dev/tty 2>/dev/null || true
else
  $CMD hook "$1" "$2" "$3" 2>/dev/null || true
fi
`;
}

export function installHook() {
  const hooksDir = path.join(process.cwd(), '.git', 'hooks');
  if (!fs.existsSync(hooksDir)) {
    return 'Error: Not inside a Git repository root.';
  }

  const hookFile = path.join(hooksDir, 'prepare-commit-msg');
  fs.writeFileSync(hookFile, getHookScript(), { encoding: 'utf-8', mode: 0o755 });
  return 'Installed prepare-commit-msg hook successfully.';
}

export function uninstallHook() {
  const hookFile = path.join(process.cwd(), '.git', 'hooks', 'prepare-commit-msg');
  if (fs.existsSync(hookFile)) {
    fs.unlinkSync(hookFile);
    return 'Removed prepare-commit-msg hook.';
  }
  return 'No hook found to remove.';
}

/**
 * 6. Main CLI Logic
 */
export async function main(args = process.argv.slice(2)) {
  const cmd = args[0];

  if (cmd === 'init') {
    console.log(installHook());
    return;
  }

  if (cmd === 'uninstall') {
    console.log(uninstallHook());
    return;
  }

  if (cmd === 'suggest') {
    const config = getConfig();
    const diff = getStagedDiff(config.maxLines);
    if (!diff) {
      console.log('No staged changes found. Run `git add <files>` first.');
      return;
    }
    const suggestion = await getAiCommitSuggestion(diff, '', config);
    if (suggestion) {
      console.log(`\nSuggested: ${suggestion}\n`);
    } else {
      console.log('Could not generate suggestion. Please check OPENAI_API_KEY.');
    }
    return;
  }

  if (cmd === 'hook') {
    const [msgFile, source] = args.slice(1);
    if (!msgFile || source === 'merge' || source === 'squash') return;

    const config = getConfig();
    if (!config.apiKey) return; // Never block commits if API key is not set

    const diff = getStagedDiff(config.maxLines);
    if (!diff) return;

    const draft = getDraftMessage(msgFile);
    const suggestion = await getAiCommitSuggestion(diff, draft, config);
    if (!suggestion) return;

    const action = await promptUser(suggestion);
    if (action === 'accept') {
      saveCommitMessage(msgFile, suggestion);
    } else if (action === 'edit') {
      const edited = await promptEdit(suggestion);
      if (edited) saveCommitMessage(msgFile, edited);
    }
    return;
  }

  console.log(`
git-commit-generator
Simple, zero-dependency AI commit message suggestions.

Commands:
  git-commit-generator init       Install git commit hook
  git-commit-generator uninstall  Remove git commit hook
  git-commit-generator suggest    Preview suggestion for staged changes
`);
}
