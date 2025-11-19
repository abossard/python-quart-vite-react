# Ubuntu 22.04 LTS Prerequisites Installation Guide

Complete guide for installing all prerequisites for the Quart + Vite + React Demo Application on **Ubuntu 22.04 LTS (Jammy Jellyfish)**.

## Table of Contents
- [Overview](#overview)
- [Quick Install](#quick-install)
- [Detailed Installation Steps](#detailed-installation-steps)
  - [1. System Update](#1-system-update)
  - [2. Git Installation](#2-git-installation)
  - [3. VS Code Installation](#3-vs-code-installation)
  - [4. Python 3.13 Installation](#4-python-313-installation)
  - [5. Node.js LTS Installation](#5-nodejs-lts-installation)
- [Verification](#verification)
- [Automatic Updates](#automatic-updates)
- [Next Steps](#next-steps)

## Overview

**Supported Ubuntu Version:**
- **Ubuntu 22.04 LTS (Jammy Jellyfish)**

**Required Software:**
- **Git** - Version control system (from Ubuntu repositories)
- **VS Code** - IDE with automatic updates via Snap
- **Python 3.13** - Latest stable Python with automatic updates via deadsnakes PPA
- **Node.js 20 LTS** - Frontend build tools with automatic updates via NodeSource

All tools are installed using package managers that provide automatic updates.

## Quick Install

Copy and paste these commands to install all prerequisites:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Git (from Ubuntu repositories)
sudo apt install -y git

# Install VS Code (auto-updates via Snap)
sudo snap install code --classic

# Install Python 3.13 with automatic updates
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt update
sudo apt install -y python3.13 python3.13-venv python3.13-dev
sudo apt install -y python3-pip build-essential

# Install Node.js 20 LTS (auto-updates via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installations
git --version
code --version
python3.13 --version
node --version
npm --version
```

All prerequisites are now installed and will receive automatic updates through their respective package managers.

## Detailed Installation Steps

### 1. System Update

Always start with a system update:

```bash
sudo apt update
sudo apt upgrade -y
```

### 2. Git Installation

Install Git from the Ubuntu system repositories:

```bash
# Install Git
sudo apt install -y git

# Verify installation
git --version

# Configure Git (replace with your details)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

Git will be automatically updated when you run `sudo apt update && sudo apt upgrade`.

### 3. VS Code Installation

Install VS Code via Snap for automatic updates:

```bash
# Install VS Code
sudo snap install code --classic

# Verify installation
code --version
```

**Auto-updates:** VS Code installed via Snap updates automatically in the background. You don't need to do anything to keep it current.

### 4. Python 3.13 Installation

Ubuntu 22.04 ships with Python 3.10 by default. To get Python 3.13 (latest stable version) with automatic updates, use the deadsnakes PPA:

```bash
# Add deadsnakes PPA for latest Python versions
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt update

# Install Python 3.13 and essential tools
sudo apt install -y python3.13 python3.13-venv python3.13-dev
sudo apt install -y python3-pip build-essential

# Verify installation
python3.13 --version
```

**What gets installed:**
- `python3.13` - Python 3.13 interpreter
- `python3.13-venv` - Virtual environment support
- `python3.13-dev` - Header files for C extensions
- `python3-pip` - Package installer for Python
- `build-essential` - Compiler and build tools

**Auto-updates:** The deadsnakes PPA provides automatic updates. When you run `sudo apt update && sudo apt upgrade`, Python 3.13 will be updated to the latest patch version.

**Using Python 3.13:**
```bash
# Create virtual environment with Python 3.13
python3.13 -m venv venv
source venv/bin/activate

# Now python and pip will use Python 3.13
python --version
```

### 5. Node.js LTS Installation

Install Node.js 20 LTS (latest LTS version) via the NodeSource repository for automatic updates:

```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

**Auto-updates:** NodeSource repository provides automatic updates. When you run `sudo apt update && sudo apt upgrade`, Node.js will be updated to the latest LTS patch version.

**What gets installed:**
- `nodejs` - Node.js runtime and npm package manager
- Includes npm for package management
- Includes npx for running packages

**Note:** This installs Node.js 20.x, which is the current LTS version and will receive updates until April 2026.

## Verification

After installation, verify all prerequisites:

```bash
# Check Git
git --version
# Expected: git version 2.x.x or higher

# Check VS Code
code --version
# Expected: Version number displayed

# Check Python 3.13
python3.13 --version
# Expected: Python 3.13.x

# Check Node.js
node --version
# Expected: v20.x.x

# Check npm
npm --version
# Expected: 10.x.x
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

All installed tools will receive automatic updates through their respective package managers.

### How Updates Work

**Git:**
- Updates automatically with system updates
- Run: `sudo apt update && sudo apt upgrade`

**VS Code:**
- Updates automatically in the background via Snap
- No manual action required

**Python 3.13:**
- Updates automatically via deadsnakes PPA
- Run: `sudo apt update && sudo apt upgrade`
- Gets latest Python 3.13 patch versions

**Node.js 20 LTS:**
- Updates automatically via NodeSource repository
- Run: `sudo apt update && sudo apt upgrade`
- Gets latest Node.js 20.x patch versions

### Recommended Update Schedule

```bash
# Weekly system update (updates Git, Python, and Node.js)
sudo apt update && sudo apt upgrade -y

# VS Code updates automatically, but you can manually trigger:
sudo snap refresh code
```

## Troubleshooting

### Common Issues

**"Permission denied" when installing npm packages:**
- Don't use sudo with npm
- Configure npm to use a local directory:
  ```bash
  mkdir ~/.npm-global
  npm config set prefix '~/.npm-global'
  echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
  source ~/.bashrc
  ```

**VS Code won't start after Snap installation:**
- Check if Snap is properly enabled: `sudo systemctl status snapd`
- Restart Snap daemon: `sudo systemctl restart snapd`

**"Unable to locate package" errors:**
- Run `sudo apt update` first
- Ensure you're on Ubuntu 22.04 LTS
- Check if PPA was added correctly: `apt-cache policy python3.13`

**Python 3.13 not found after installation:**
- Use `python3.13` explicitly (not `python3` or `python`)
- When creating venv: `python3.13 -m venv venv`

For more troubleshooting help, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Security Considerations

- Always verify scripts before running them (especially curl | bash commands)
- Keep your system updated regularly with `sudo apt update && sudo apt upgrade`
- Ubuntu 22.04 LTS receives security updates until April 2027

## Additional Resources

- [Official Ubuntu Documentation](https://help.ubuntu.com/)
- [Python Installation Guide](https://docs.python.org/3/using/unix.html)
- [Node.js Official Documentation](https://nodejs.org/en/download/package-manager/)
- [VS Code on Linux](https://code.visualstudio.com/docs/setup/linux)
- [Git Documentation](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)

---

**Last Updated:** November 2024  
**Target Platform:** Ubuntu 22.04 LTS (Jammy Jellyfish)
