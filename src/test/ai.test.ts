import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSystemPrompt,
  buildUserPrompt,
  cleanCommitMessage
} from '../ai.js';
import { StagedChanges } from '../types.js';

test('buildSystemPrompt contains conventional commit instructions', () => {
  const prompt = buildSystemPrompt();
  assert.ok(prompt.includes('Conventional Commits'));
  assert.ok(prompt.includes('feat:'));
  assert.ok(prompt.includes('fix:'));
});

test('buildUserPrompt formats changed files and diff correctly', () => {
  const changes: StagedChanges = {
    diff: '+ const token = generateRefreshToken();',
    files: ['M src/auth.ts'],
    hasChanges: true,
    isTruncated: false
  };

  const prompt = buildUserPrompt(changes, 'wip');
  assert.ok(prompt.includes('Work in progress'));
  assert.ok(prompt.includes('M src/auth.ts'));
  assert.ok(prompt.includes('+ const token = generateRefreshToken();'));
});

test('buildUserPrompt handles user draft message hint', () => {
  const changes: StagedChanges = {
    diff: '+ fixLogin();',
    files: ['M src/login.ts'],
    hasChanges: true,
    isTruncated: false
  };

  const prompt = buildUserPrompt(changes, 'fix login crash');
  assert.ok(prompt.includes('"fix login crash"'));
});

test('cleanCommitMessage removes backticks, quotes, and extra lines', () => {
  assert.equal(
    cleanCommitMessage('`feat(auth): add refresh token rotation`'),
    'feat(auth): add refresh token rotation'
  );

  assert.equal(
    cleanCommitMessage('"feat(auth): add refresh token rotation"'),
    'feat(auth): add refresh token rotation'
  );

  assert.equal(
    cleanCommitMessage('```\nfeat(auth): add refresh token rotation\n```'),
    'feat(auth): add refresh token rotation'
  );

  assert.equal(
    cleanCommitMessage('feat(auth): add refresh token rotation\n\nSome extra paragraph'),
    'feat(auth): add refresh token rotation'
  );
});
