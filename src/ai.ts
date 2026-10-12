import { CommitFormatConfig, StagedChanges, SuggestionResult } from './types.js';

/**
 * Builds the system prompt enforcing Conventional Commits specification.
 */
export function buildSystemPrompt(): string {
  return `You are an expert Git commit assistant.
Your task is to analyze git staged diffs and suggest a single, high-quality commit message strictly following the Conventional Commits specification (v1.0.0).

Format:
<type>(<optional scope>): <description>

Types:
- feat: A new feature
- fix: A bug fix
- docs: Documentation changes only
- style: Code style/formatting changes that do not affect logic
- refactor: Code changes that neither fix a bug nor add a feature
- perf: Performance improvements
- test: Adding or updating tests
- build: Build system or external dependencies changes (package.json, tsconfig, etc.)
- ci: CI/CD configuration files and scripts
- chore: Tooling, configs, or maintenance tasks

Rules:
1. Provide ONLY the commit message as plain text. No markdown formatting, no code fences, no quotes, no explanations.
2. Must be a single line under 72 characters if possible.
3. Use imperative, present tense ("add" not "added", "fix" not "fixes").
4. Description must start with lowercase and end without a period.
5. Inferred scope should be a concise module name, file directory, or feature area (e.g. auth, api, cli, ui). If unclear, omit the scope.
6. If the user provided a draft message or hint, use it to infer user intent and steer the suggestion.`;
}

/**
 * Builds the user prompt containing file list, draft message hint, and staged diff.
 */
export function buildUserPrompt(changes: StagedChanges, draftMessage?: string): string {
  let prompt = '';

  if (draftMessage && draftMessage.trim() && draftMessage.trim() !== 'wip') {
    prompt += `User's draft commit message / hint:\n"${draftMessage.trim()}"\n\n`;
  } else if (draftMessage && draftMessage.trim() === 'wip') {
    prompt += `User noted: Work in progress (infer exact changes from diff)\n\n`;
  }

  if (changes.files.length > 0) {
    prompt += `Changed files:\n${changes.files.join('\n')}\n\n`;
  }

  prompt += `Staged diff:\n${changes.diff}\n`;

  if (changes.isTruncated) {
    prompt += `\n[Diff truncated to first 200 lines]`;
  }

  return prompt;
}

/**
 * Clean up LLM output to ensure it matches standard single-line commit format.
 */
export function cleanCommitMessage(raw: string): string {
  let msg = raw.trim();

  // Remove markdown code fences if present
  if (msg.startsWith('```')) {
    msg = msg.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  // Remove surrounding quotes
  if ((msg.startsWith('"') && msg.endsWith('"')) || (msg.startsWith("'") && msg.endsWith("'")) || (msg.startsWith('`') && msg.endsWith('`'))) {
    msg = msg.slice(1, -1).trim();
  }

  // Take first line if multiple lines returned
  const firstLine = msg.split('\n')[0].trim();
  return firstLine;
}

/**
 * Calls OpenAI API (or any OpenAI-compatible API) to generate the commit suggestion.
 * Times out after config.timeoutMs (default 8s) and does not store data on OpenAI (store: false).
 */
export async function generateCommitSuggestion(
  changes: StagedChanges,
  draftMessage: string | undefined,
  config: CommitFormatConfig
): Promise<SuggestionResult | null> {
  if (!config.apiKey) {
    return null;
  }

  if (!changes.hasChanges || (!changes.diff && changes.files.length === 0)) {
    return null;
  }

  const endpoint = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(changes, draftMessage);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);

    const bodyPayload: Record<string, any> = {
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 100,
      store: false // OpenAI privacy flag: do not retain for later retrieval
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!res.ok) {
      // In non-blocking design, log nothing or debug only and fail silently
      return null;
    }

    const data = (await res.json()) as any;
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent || typeof rawContent !== 'string') {
      return null;
    }

    const cleaned = cleanCommitMessage(rawContent);
    return {
      message: cleaned,
      tokensUsed: data.usage?.total_tokens
    };
  } catch (err) {
    // Timeout, network error, or abort -> return null silently
    return null;
  }
}
