#!/usr/bin/env node

import { main } from '../dist/cli.js';

main().catch((err) => {
  // Graceful catch to ensure git commits are never blocked by unhandled exceptions
  console.error(err);
  process.exit(0);
});
