import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  getConfig,
  getDraftMessage,
  saveCommitMessage,
  getHookScript
} from '../src/index.js';

test('getConfig loads default configuration', () => {
  const config = getConfig();
  assert.equal(typeof config.apiKey, 'string');
  assert.equal(config.model, process.env.OPENAI_MODEL || 'gpt-4o-mini');
  assert.equal(config.maxLines, 200);
});

test('getDraftMessage ignores git comments', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-test-'));
  const msgFile = path.join(tmpDir, 'COMMIT_EDITMSG');

  fs.writeFileSync(msgFile, 'fix auth login\n# Please enter commit message\n# lines starting with # are ignored');
  const draft = getDraftMessage(msgFile);
  assert.equal(draft, 'fix auth login');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('saveCommitMessage writes clean message to file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-test-'));
  const msgFile = path.join(tmpDir, 'COMMIT_EDITMSG');

  saveCommitMessage(msgFile, 'feat(auth): add login');
  const content = fs.readFileSync(msgFile, 'utf-8');
  assert.equal(content, 'feat(auth): add login\n');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('getHookScript contains executable shell logic', () => {
  const script = getHookScript();
  assert.ok(script.startsWith('#!/bin/sh'));
  assert.ok(script.includes('git-commit-format'));
});
