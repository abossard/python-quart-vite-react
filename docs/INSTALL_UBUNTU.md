# Ubuntu Prerequisites Installation Guide

Complete guide for installing all prerequisites for the Quart + Vite + React Demo Application on **Ubuntu 22.04 LTS and Ubuntu 24.04 LTS**.

## Table of Contents
- [Overview](#overview)
- [Quick Install](#quick-install)
- [Detailed Installation Steps](#detailed-installation-steps)
  - [1. System Update](#1-system-update)
  - [2. Git Installation](#2-git-installation)
  - [3. VS Code Installation](#3-vs-code-installation)
  - [4. Python 3.10+ Installation](#4-python-310-installation)
  - [5. Node.js LTS Installation](#5-nodejs-lts-installation)
- [Alternative Installation Methods](#alternative-installation-methods)
- [Verification](#verification)
- [Automatic Updates](#automatic-updates)
- [Next Steps](#next-steps)

## Overview

**Supported Ubuntu Versions:**
- **Ubuntu 22.04 LTS (Jammy Jellyfish)** - Recommended, stable
- **Ubuntu 24.04 LTS (Noble Numbat)** - Latest LTS release

**Required Software:**
- **Git** - Version control system
- **VS Code** - Recommended IDE with auto-update capabilities
- **Python 3.10+** - Backend runtime (3.10 in 22.04, 3.12 in 24.04)
- **Node.js 18+ (LTS)** - Frontend build tools and runtime

All tools will be installed using package managers for automatic updates.

## Quick Install

One-command installation for all prerequisites:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Git
sudo apt install -y git

# Install VS Code via Snap (auto-updates)
sudo snap install code --classic

# Install Python 3.10+ and development tools (already included in 22.04+)
sudo apt install -y python3 python3-pip python3-venv python3-dev build-essential

# Install Node.js LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installations
git --version
code --version
python3 --version
node --version
npm --version
```

That's it! All prerequisites are now installed with automatic update capabilities.

For more control or alternative methods, continue with the detailed steps below.

## Detailed Installation Steps

### 1. System Update

Always start with a system update:

```bash
sudo apt update
sudo apt upgrade -y
```

### 2. Git Installation

Git is available in the default Ubuntu repositories:

```bash
# Install Git
sudo apt install -y git

# Verify installation
git --version

# Configure Git (replace with your details)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

**For the latest Git version**, use the official Git PPA:

```bash
# Add Git PPA for latest stable version
sudo add-apt-repository ppa:git-core/ppa -y
sudo apt update
sudo apt install -y git
```

### 3. VS Code Installation

VS Code can be installed via Snap (recommended for auto-updates) or the official Microsoft repository.

#### Option A: Snap (Recommended - Auto-updates)

```bash
# Install VS Code via Snap
sudo snap install code --classic

# Verify installation
code --version
```

**Advantages:**
- Automatic updates managed by Snap
- Works on all Ubuntu versions
- Sandboxed for security

#### Option B: Microsoft Repository (Traditional)

```bash
# Import Microsoft GPG key
wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
sudo install -D -o root -g root -m 644 packages.microsoft.gpg /etc/apt/keyrings/packages.microsoft.gpg
rm packages.microsoft.gpg

# Add VS Code repository
echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/keyrings/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" | sudo tee /etc/apt/sources.list.d/vscode.list > /dev/null

# Update and install
sudo apt update
sudo apt install -y code

# Verify installation
code --version
```

**Advantages:**
- Integrates with system package manager
- Updates via `apt upgrade`

### 4. Python 3.10+ Installation

Both Ubuntu 22.04 LTS and 24.04 LTS ship with Python 3.10+ by default:

- **Ubuntu 22.04 LTS:** Python 3.10
- **Ubuntu 24.04 LTS:** Python 3.12

Installation is straightforward:

```bash
# Install Python and essential development tools
sudo apt install -y python3 python3-pip python3-venv python3-dev build-essential

# Verify version
python3 --version
# Ubuntu 22.04: Python 3.10.x
# Ubuntu 24.04: Python 3.12.x
```

**What gets installed:**
- `python3` - Python interpreter
- `python3-pip` - Package installer for Python
- `python3-venv` - Virtual environment support
- `python3-dev` - Header files for Python C extensions
- `build-essential` - Compiler and build tools (gcc, make, etc.)

**Verify pip installation:**

```bash
pip3 --version
# or
python3 -m pip --version
```

### 5. Node.js LTS Installation

Multiple installation methods are available. Choose based on your needs.

#### Option A: NodeSource Repository (Recommended)

Provides the latest LTS version with automatic updates via apt:

```bash
# Install Node.js 20 LTS (recommended)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

**For Node.js 18 LTS** (if you need the previous LTS):

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

#### Option B: NVM (Node Version Manager)

Best for developers who need multiple Node.js versions:

```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Reload shell configuration
source ~/.bashrc
# or for zsh:
# source ~/.zshrc

# Install Node.js LTS
nvm install --lts

# Set default version
nvm alias default node

# Verify installation
node --version
npm --version
```

**NVM Advantages:**
- Switch between Node.js versions easily
- Per-project Node.js versions
- No sudo required for global packages

#### Option C: Snap (Quick but limited)

```bash
# Install Node.js via Snap
sudo snap install node --classic

# Verify installation
node --version
npm --version
```

**Note:** Snap version may lag behind latest LTS and has some limitations with file permissions.

## Alternative Installation Methods

### Using pyenv for Python (Advanced)

For fine-grained Python version control:

```bash
# Install dependencies
sudo apt install -y make build-essential libssl-dev zlib1g-dev \
libbz2-dev libreadline-dev libsqlite3-dev wget curl llvm \
libncursesw5-dev xz-utils tk-dev libxml2-dev libxmlsec1-dev \
libffi-dev liblzma-dev

# Install pyenv
curl https://pyenv.run | bash

# Add to shell configuration (~/.bashrc or ~/.zshrc)
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.bashrc
echo 'command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.bashrc
echo 'eval "$(pyenv init -)"' >> ~/.bashrc

# Reload shell
source ~/.bashrc

# Install Python 3.10
pyenv install 3.10.13
pyenv global 3.10.13

# Verify
python --version
```

### Using Snap for Everything (Simple but Isolated)

All tools can be installed via Snap for maximum isolation:

```bash
sudo snap install code --classic
sudo snap install node --classic
# Note: Git and Python are best installed via apt
```

## Verification

After installation, verify all prerequisites:

```bash
# Check Git
git --version
# Expected: git version 2.x.x or higher

# Check VS Code
code --version
# Expected: Version number displayed

# Check Python
python3 --version
# Expected: Python 3.10.x or higher

# Check pip
pip3 --version
# Expected: pip 20.x or higher

# Check Node.js
node --version
# Expected: v18.x.x or v20.x.x

# Check npm
npm --version
# Expected: 9.x.x or 10.x.x
```

**Create a test script** to verify everything:

```bash
cat > /tmp/verify-install.sh << 'EOF'
#!/bin/bash
echo "Verification Script for Quart + React Prerequisites"
echo "===================================================="
echo ""

check_command() {
    if command -v $1 &> /dev/null; then
        echo "✅ $1: $($1 --version 2>&1 | head -n1)"
    else
        echo "❌ $1: NOT FOUND"
    fi
}

check_command git
check_command code
check_command python3
check_command pip3
check_command node
check_command npm

echo ""
echo "Python version check:"
PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
if [ $(echo "$PYTHON_VERSION >= 3.10" | bc -l) -eq 1 ]; then
    echo "✅ Python $PYTHON_VERSION (>= 3.10 required)"
else
    echo "❌ Python $PYTHON_VERSION (>= 3.10 required)"
fi

echo ""
echo "Node.js version check:"
NODE_MAJOR=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -ge 18 ]; then
    echo "✅ Node.js v$NODE_MAJOR (>= 18 required)"
else
    echo "❌ Node.js v$NODE_MAJOR (>= 18 required)"
fi
EOF

chmod +x /tmp/verify-install.sh
/tmp/verify-install.sh
```

## Next Steps

Once all prerequisites are installed:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/abossard/python-quart-vite-react.git
   cd python-quart-vite-react
   ```

2. **Run the setup script:**
   ```bash
   ./setup.sh
   ```

3. **Start the development servers:**
   ```bash
   ./start-dev.sh
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3001`

For more details, see:
- [Quick Start Guide](QUICKSTART.md)
- [README.md](../README.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)

## Automatic Updates

### Keeping Tools Updated

#### Git (via PPA)
```bash
sudo apt update && sudo apt upgrade git
```

#### VS Code
- **Snap:** Updates automatically in the background
- **Apt:** Run `sudo apt update && sudo apt upgrade code`

#### Python
- **System packages:** `sudo apt update && sudo apt upgrade python3`
- **pyenv:** `pyenv install <new-version>` and `pyenv global <new-version>`

#### Node.js
- **NodeSource:** `sudo apt update && sudo apt upgrade nodejs`
- **NVM:** `nvm install --lts` and `nvm alias default node`

### Recommended Update Schedule

```bash
# Weekly system update (includes Git, VS Code via apt, Node.js via NodeSource)
sudo apt update && sudo apt upgrade -y

# Check for VS Code updates (if using Snap)
snap refresh code

# Check for Node.js LTS updates (if using NVM)
nvm install --lts --reinstall-packages-from=current
```

## Troubleshooting

### Common Issues

**"Permission denied" when installing npm packages:**
- Don't use sudo with npm
- If using system Node.js, configure npm to use a local directory:
  ```bash
  mkdir ~/.npm-global
  npm config set prefix '~/.npm-global'
  echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
  source ~/.bashrc
  ```

**VS Code won't start after Snap installation:**
- Check if Snap is properly enabled: `sudo systemctl status snapd`
- Restart Snap daemon: `sudo systemctl restart snapd`

**Node.js version conflicts:**
- If using NVM, ensure NVM is loaded: `source ~/.bashrc`
- Check active version: `nvm current`
- Switch version: `nvm use --lts`

**"Unable to locate package" errors:**
- Run `sudo apt update` first
- Ensure you're on Ubuntu 22.04 LTS or 24.04 LTS

For more troubleshooting help, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Security Considerations

- Always verify scripts before running them (especially curl | bash commands)
- Keep your system updated regularly
- Use LTS versions for production environments
- Consider using version managers (pyenv, nvm) in development for isolation

## Additional Resources

- [Official Ubuntu Documentation](https://help.ubuntu.com/)
- [Python Installation Guide](https://docs.python.org/3/using/unix.html)
- [Node.js Official Documentation](https://nodejs.org/en/download/package-manager/)
- [VS Code on Linux](https://code.visualstudio.com/docs/setup/linux)
- [Git Documentation](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)

---

**Last Updated:** November 2024  
**Tested On:** Ubuntu 22.04 LTS (Jammy Jellyfish), Ubuntu 24.04 LTS (Noble Numbat)
