import fs from 'node:fs';
import readline from 'node:readline';
import { UserAction } from './types.js';

// ANSI color escape codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';

/**
 * Open the controlling terminal input stream across Windows, macOS, and Linux.
 */
function openTtyInputStream(): fs.ReadStream | null {
  // 1. If standard process.stdin is already a TTY, use it
  if (process.stdin.isTTY) {
    return process.stdin as unknown as fs.ReadStream;
  }

  // 2. Windows specific console device
  if (process.platform === 'win32') {
    const winDevices = ['\\\\.\\CON', 'CONIN$'];
    for (const dev of winDevices) {
      try {
        const fd = fs.openSync(dev, 'r');
        return fs.createReadStream('', { fd });
      } catch {
        // try next
      }
    }
  }

  // 3. Unix specific terminal device
  try {
    const fd = fs.openSync('/dev/tty', 'r');
    return fs.createReadStream('', { fd });
  } catch {
    // Cannot open tty
  }

  return null;
}

/**
 * Prompts the user with one-keypress response:
 * [enter/a] accept  [e] edit  [r] reject
 */
export async function promptUserAction(suggestedMessage: string): Promise<UserAction> {
  const ttyIn = openTtyInputStream();

  // If running in a headless CI / GUI environment with no terminal, default to reject
  if (!ttyIn) {
    return 'reject';
  }

  // Print suggested message with clean formatting
  process.stdout.write(
    `\n${BOLD}Suggested:${RESET} ${GREEN}${suggestedMessage}${RESET}\n` +
    `${DIM}[enter/a] accept  [e] edit  [r] reject${RESET} `
  );

  return new Promise<UserAction>((resolve) => {
    // If it's process.stdin or supports setRawMode
    const anyStream = ttyIn as any;
    const isRawSupported = Boolean(anyStream.setRawMode);

    if (isRawSupported) {
      anyStream.setRawMode(true);
      anyStream.resume();

      const onData = (data: Buffer) => {
        const str = data.toString('utf-8');
        anyStream.setRawMode(false);
        anyStream.pause();
        anyStream.removeListener('data', onData);
        process.stdout.write('\n');

        // Check keypress
        if (str === '\r' || str === '\n' || str.toLowerCase() === 'a') {
          resolve('accept');
        } else if (str.toLowerCase() === 'e') {
          resolve('edit');
        } else {
          // 'r', ESC (\u001b), Ctrl+C (\u0003), or any other key
          resolve('reject');
        }
      };

      anyStream.on('data', onData);
    } else {
      // Fallback for non-raw stream: read a single line
      const rl = readline.createInterface({
        input: ttyIn,
        output: process.stdout
      });

      rl.question('', (answer) => {
        rl.close();
        const trimmed = answer.trim().toLowerCase();
        if (trimmed === '' || trimmed === 'a' || trimmed === 'y') {
          resolve('accept');
        } else if (trimmed === 'e') {
          resolve('edit');
        } else {
          resolve('reject');
        }
      });
    }
  });
}

/**
 * When the user chooses 'edit', interactive prompt to type or adjust the commit message.
 */
export async function promptEditMessage(initialMessage: string): Promise<string> {
  const ttyIn = openTtyInputStream() || process.stdin;

  const rl = readline.createInterface({
    input: ttyIn as any,
    output: process.stdout
  });

  return new Promise<string>((resolve) => {
    process.stdout.write(`${CYAN}Edit message:${RESET}\n`);
    rl.question(`> `, (answer) => {
      rl.close();
      const finalMsg = answer.trim() || initialMessage;
      resolve(finalMsg);
    });
    // Write the initial suggestion into the input buffer if supported
    (rl as any).write(initialMessage);
  });
}
