# git-commit-format

> Stop writing `wip` and `fix stuff`. **git-commit-format** reads your staged changes when you run `git commit` and suggests a clean [Conventional Commit](https://www.conventionalcommits.org/) message. Accept it with a single keypress.

```
$ git commit -m "wip"

Suggested: feat(auth): add refresh token rotation
[enter/a] accept  [e] edit  [r] reject
```

---

## ✨ Features

- **⚡ Zero Interruptions**: Commits are **never** blocked. If anything goes wrong (offline, missing API key, rate limits, timeout), your original message is kept and Git proceeds smoothly.
- **🎯 Conventional Commits 1.0.0**: Outputs standard `<type>(<scope>): <description>` messages in imperative tense (`feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, etc.).
- **⌨️ One-Keypress Interactive Acceptance**: Press `Enter` or `a` to accept, `e` to edit in-place, or `r` (or any other key) to reject.
- **💡 Context-Aware Intent Steering**: Draft messages like `git commit -m "login crash"` are used as hints to steer the AI toward the right type and context.
- **🔒 Privacy & Cost Focused**: Uses `store: false` flag with OpenAI. Only the first 200 lines of staged unified diffs are sent.
- **🖥️ Cross-Platform Support**: Built for **Windows**, **macOS**, and **Linux**.
- **🪶 Zero Runtime Dependencies**: Fast startup and lightweight footprint using native Node.js 18+ capabilities.
- **🔌 Flexible LLM Support**: Supports OpenAI (`gpt-4o-mini`, `gpt-5-mini`) as well as any OpenAI-compatible API (Ollama, Groq, OpenRouter, DeepSeek).

---

## 🔍 How It Works Under The Hood

### 1. Intercepting Changes with `prepare-commit-msg`
When you execute `git commit` or `git commit -m "..."`, Git triggers the `.git/hooks/prepare-commit-msg` hook before opening your editor or finalizing the commit:

1. **Parameters Passed by Git**:
   - `$1` (`msgFilePath`): Path to Git's temporary commit message buffer (usually `.git/COMMIT_EDITMSG`).
   - `$2` (`commitSource`): The source of the commit (`message` if `-m` was used, `template`, `merge`, `squash`, or empty).
   - `$3` (`sha`): Commit SHA if amending or rebasing.

2. **Inspecting Staged Changes**:
   - The tool runs `git diff --cached --no-color` and `git diff --cached --name-status` to inspect the exact additions and deletions staged in Git's index.
   - It reads `$1` to extract your draft message (e.g., `-m "wip"` or `-m "auth fix"`).

3. **Skipping Irrelevant Commits**:
   - Automatically skips merges, squashes, or runs without staged changes.
   - Gracefully skips in non-interactive CI/CD or GUI clients without hanging.

### 2. Generating & Formatting the Suggestion
- The diff (capped at 200 lines) and draft hint are fed into the LLM with a strict Conventional Commits prompt.
- The request uses an 8-second timeout (`AbortSignal.timeout(8000)`) and sets `store: false`.

### 3. User Decision & Writing Back
- Prompt displayed on the terminal TTY:
  - **`Enter` or `a`**: Writes the suggested string directly into `$1` (`COMMIT_EDITMSG`). Git reads this file to complete the commit.
  - **`e`**: Allows editing the suggestion inline before writing.
  - **`r` / any key**: Leaves `$1` untouched, using your original message.

---

## 🚀 Installation

### Global Install (Recommended)

```bash
npm install -g git-commit-format
```

### Local Development / From Source

```bash
git clone https://github.com/your-username/git-commit-format.git
cd git-commit-format
npm install
npm run build
npm link
```

---

## ⚙️ Configuration

### 1. Set your OpenAI API key

#### Option A: For all repositories (Global)
Add to your `~/.bashrc`, `~/.zshrc`, or Windows Environment Variables:
```bash
export OPENAI_API_KEY="sk-..."
```

#### Option B: Per repository (.env)
Create a `.env` in your project root:
```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```
> **Note**: Add `.env` to your `.gitignore` so your secret is never committed!

### 2. Configuration Options

| Variable | Default | Description |
| :--- | :--- | :--- |
| `OPENAI_API_KEY` | *(none)* | **Required**. Your OpenAI or compatible API key |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model to use (`gpt-4o-mini`, `gpt-5-mini`, etc.) |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Base URL for custom LLM providers (Ollama, Groq, etc.) |
| `GIT_COMMIT_FORMAT_MAX_LINES` | `200` | Maximum lines of diff sent to the model |
| `GIT_COMMIT_FORMAT_TIMEOUT` | `8000` | Request timeout in milliseconds |

---

## 🛠️ Usage

### Enable in a Git Repository

Run inside any repository:

```bash
git-commit-format init
```

*This installs a non-intrusive hook into `.git/hooks/prepare-commit-msg`. If Husky or another hook manager already exists, `git-commit-format` appends safely without overwriting it.*

### Make Commits As Usual

```bash
# Stage your changes
git add .

# Commit with a quick hint or standard commit
git commit -m "wip"
```

The interactive prompt will appear:
```
Suggested: feat(user-profile): implement avatar upload handler
[enter/a] accept  [e] edit  [r] reject
```

| Key | Action |
| :--- | :--- |
| `Enter` or `a` | Accept and use the suggested message |
| `e` | Edit the suggested message inline |
| `r` (or any other key) | Reject and keep your original message |

### Standalone Suggestion (Without Committing)

To test what suggestion will be generated without running `git commit`:

```bash
git-commit-format suggest
```

### Uninstalling from a Repository

```bash
git-commit-format uninstall
```

---

## 🌐 Using with Alternative LLMs (Ollama / Local / Groq)

Because `git-commit-format` supports `OPENAI_BASE_URL`, you can run it 100% locally or with other providers!

### With Local Ollama:
```bash
export OPENAI_BASE_URL="http://localhost:11434/v1"
export OPENAI_API_KEY="ollama"
export OPENAI_MODEL="llama3"
```

---

## 🧪 Testing

Run the test suite using Node.js native test runner:

```bash
npm test
```

---

## 🤝 Contributing & Open Source Publishing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Publishing to npm:
```bash
npm run build
npm test
npm publish --access public
```

---

## 📄 License

MIT © [Open Source Contributors](LICENSE)
