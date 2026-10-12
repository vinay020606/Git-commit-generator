#!/usr/bin/env node

import { main } from '../src/index.js';

main().catch(() => {
  // Always exit safely so commits are never blocked
  process.exit(0);
});
