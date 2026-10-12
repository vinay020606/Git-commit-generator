import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../config.js';

test('resolveConfig returns default options', () => {
  const origKey = process.env.OPENAI_API_KEY;
  const origModel = process.env.OPENAI_MODEL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;

  const cfg = resolveConfig();
  assert.equal(cfg.model, 'gpt-4o-mini');
  assert.equal(cfg.baseUrl, 'https://api.openai.com/v1');
  assert.equal(cfg.maxDiffLines, 200);
  assert.equal(cfg.timeoutMs, 8000);

  // Restore
  if (origKey) process.env.OPENAI_API_KEY = origKey;
  if (origModel) process.env.OPENAI_MODEL = origModel;
});

test('resolveConfig respects environment overrides', () => {
  process.env.OPENAI_API_KEY = 'test-key-123';
  process.env.OPENAI_MODEL = 'gpt-5-mini';
  process.env.GIT_COMMIT_FORMAT_MAX_LINES = '350';

  const cfg = resolveConfig();
  assert.equal(cfg.apiKey, 'test-key-123');
  assert.equal(cfg.model, 'gpt-5-mini');
  assert.equal(cfg.maxDiffLines, 350);

  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  delete process.env.GIT_COMMIT_FORMAT_MAX_LINES;
});
