# Windows Development Setup Guide

This guide helps Windows contributors successfully clone and work with the Project-Suuupra repository.

## Prerequisites for Windows Contributors

### 1. Enable Git Long Path Support
Windows has a 260-character path limit that can cause cloning issues. Enable long path support:

```powershell
# Run PowerShell as Administrator
git config --system core.longpaths true
```

### 2. Configure Git Line Endings
Set up Git to handle line endings correctly for cross-platform development:

```bash
git config --global core.autocrlf true
git config --global core.safecrlf warn
```

### 3. Install Git for Windows
Download and install Git from: https://git-scm.com/download/win

Make sure to select these options during installation:
- ✅ Use Git from the Windows Command Prompt
- ✅ Checkout Windows-style, commit Unix-style line endings
- ✅ Enable symbolic links

## Clone Instructions for Windows

### Option 1: Standard Clone
```bash
git clone https://github.com/Theory903/Project-Suuupra.git
cd Project-Suuupra
```

### Option 2: Shallow Clone (Faster, Recommended)
If you encounter timeout issues:
```bash
git clone --depth 1 https://github.com/Theory903/Project-Suuupra.git
cd Project-Suuupra
# Later, if you need full history:
git fetch --unshallow
```

### Option 3: Clone to Shorter Path
To avoid path length issues:
```bash
# Clone to C:\dev\ instead of deeper folders
cd C:\
mkdir dev
cd dev
git clone https://github.com/Theory903/Project-Suuupra.git suuupra
```

## Common Windows Issues & Solutions

### Issue 1: "Filename too long" Error
**Solution**: Enable long paths in Git and Windows
```powershell
# Run as Administrator
git config --system core.longpaths true

# For Windows 10 version 1607+, enable in registry:
# Computer\HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\FileSystem
# Set LongPathsEnabled to 1
```

### Issue 2: Line Ending Issues
**Solution**: The repository now includes `.gitattributes` that automatically handles this.
```bash
# Refresh line endings after cloning:
git rm --cached -r .
git reset --hard
```

### Issue 3: Permission Denied on Shell Scripts
**Solution**: Use Git Bash or WSL for running shell scripts:
```bash
# In Git Bash:
chmod +x scripts/*.sh
./scripts/build-all.sh
```

### Issue 4: Node.js Path Issues
**Solution**: Use shorter paths or WSL:
```bash
# Set npm to use shorter cache paths
npm config set cache C:\npm-cache
npm config set tmp C:\tmp
```

## Recommended Windows Development Environment

### Option 1: WSL2 (Windows Subsystem for Linux)
Best compatibility with the Unix-based development environment:
```bash
# Install WSL2 Ubuntu
wsl --install Ubuntu-20.04

# Clone inside WSL
cd ~
git clone https://github.com/Theory903/Project-Suuupra.git
```

### Option 2: Git Bash + VS Code
Use Git Bash terminal in VS Code:
1. Install VS Code
2. Set default terminal to Git Bash
3. Clone using Git Bash commands above

### Option 3: Docker Development
Use Docker containers for consistent environment:
```bash
# Use the provided docker-compose files
docker-compose up -d
```

## Testing Your Setup

After cloning, verify everything works:

```bash
# Test basic commands
git status
git log --oneline -5

# Test script execution (in Git Bash or WSL)
chmod +x scripts/test-setup.sh
./scripts/test-setup.sh
```

## Getting Help

If you still encounter issues:
1. Check that you've followed all steps above
2. Try cloning to a shorter path (C:\dev\suuupra)
3. Use WSL2 for the most compatible experience
4. Open an issue with your specific error message

## Environment Variables for Windows

Create a `.env` file in the project root:
```env
# Windows-specific paths
DOCKER_HOST=npipe:////./pipe/docker_engine
# Add other Windows-specific configurations here
```

## IDE Setup for Windows

### VS Code Extensions
Install these extensions for best experience:
- Remote - WSL (if using WSL)
- Docker
- GitLens
- ESLint
- Prettier

### IntelliJ IDEA / WebStorm
- Enable WSL integration in Settings → Build, Execution, Deployment → WSL
- Configure Git executable to use WSL git if using WSL2

---

**Note**: This repository uses Unix-style line endings (LF) for consistency. The `.gitattributes` file automatically handles conversion to Windows line endings (CRLF) where appropriate.
