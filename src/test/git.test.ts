import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  getDraftMessage,
  writeCommitMessage,
  generateHookScript,
  installHook,
  uninstallHook
} from '../git.js';

test('getDraftMessage filters out git comments and whitespace', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-test-'));
  const msgFile = path.join(tmpDir, 'COMMIT_EDITMSG');

  fs.writeFileSync(
    msgFile,
    'wip\n\n# Please enter the commit message for your changes.\n# Lines starting with \'#\' will be ignored.\n'
  );

  const draft = getDraftMessage(msgFile);
  assert.equal(draft, 'wip');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('writeCommitMessage overwrites the target file with trimmed message and newline', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-test-'));
  const msgFile = path.join(tmpDir, 'COMMIT_EDITMSG');

  writeCommitMessage(msgFile, '  feat(cli): add auto commit suggestion  ');
  const content = fs.readFileSync(msgFile, 'utf-8');
  assert.equal(content, 'feat(cli): add auto commit suggestion\n');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('generateHookScript returns executable shell script containing git-commit-format', () => {
  const script = generateHookScript();
  assert.ok(script.startsWith('#!/bin/sh'));
  assert.ok(script.includes('git-commit-format'));
  assert.ok(script.includes('hook "$1" "$2" "$3"'));
});
