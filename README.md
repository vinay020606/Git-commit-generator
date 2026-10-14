# git-commit-generator

> **Zero-dependency** AI tool that suggests clean [Conventional Commit](https://www.conventionalcommits.org/) messages directly when you run `git commit`. Accept with one keypress!

```
$ git commit

Suggested: feat(auth): add refresh token rotation
[enter/a] accept  [e] edit  [r] reject
```

---

## 💡 Why use this?

- **No more thinking of commit messages**: Automatically analyzes your staged code and writes a clean message.
- **Zero dependencies**: Pure Node.js. No heavy node_modules, no compilation step.
- **Never blocks your commits**: If you are offline or have no API key, Git commits normally with your original message.
- **Works on Windows, macOS, and Linux**.

---

## 🚀 Quick Start

### 1. Install globally

```bash
npm install -g git-commit-generator
```

*(Or use locally without installing: `node bin/cli.js init`)*

### 2. Set your OpenAI API key

Add to your terminal profile (`~/.bashrc` or `~/.zshrc`):
```bash
export OPENAI_API_KEY="sk-..."
```
*Or create a `.env` file in your repository:*
```env
OPENAI_API_KEY=sk-...
```

### 3. Enable in any Git repository

Run inside your repository:
```bash
git-commit-generator init
```

That's it! 

---

## 🎯 How to Use

Stage your files and commit normally:

```bash
git add .
git commit
```

The suggestion will pop up:
```text
Suggested: feat(auth): add login system
[enter/a] accept  [e] edit  [r] reject
```

| Key | Action |
| :--- | :--- |
| **Enter** or **a** | Accept the suggested message |
| **e** | Edit the message directly in terminal |
| **r** (or any other key) | Reject and keep your original message |

---

## ⚙️ Configuration

Set these in your environment or repository `.env`:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `OPENAI_API_KEY` | *(none)* | Your OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o-mini` | AI Model (`gpt-4o-mini`, `gpt-4o`, etc.) |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Optional: Compatible with Ollama, Groq, DeepSeek |
| `GIT_COMMIT_GENERATOR_MAX_LINES` | `200` | Max lines of diff sent to the AI |
| `GIT_COMMIT_GENERATOR_TIMEOUT` | `8000` | Timeout in ms for AI request |

### Using with Local Ollama (Free & Offline)

```bash
export OPENAI_BASE_URL="http://localhost:11434/v1"
export OPENAI_API_KEY="ollama"
export OPENAI_MODEL="llama3"
```

---

## 🛠️ CLI Commands

```bash
git-commit-generator init       # Enable in current repository
git-commit-generator uninstall  # Remove hook from repository
git-commit-generator suggest    # Preview suggestion without committing
```

---

## 🧪 Tests

```bash
npm test
```

---

## 📄 License

MIT
