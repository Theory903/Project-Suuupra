#!/bin/bash
set -e

# Node.js via nvm - find latest installed or LTS available
if ! command -v nvm &> /dev/null; then
  echo "Installing nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
else
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi

# Get latest LTS node version available via nvm
NODE_VERSION=$(nvm ls-remote --lts | tail -1 | awk '{print $1}' | tr -d 'v')
echo "$NODE_VERSION" > .nvmrc
echo "Using Node $NODE_VERSION"
nvm install "$NODE_VERSION"
nvm alias default "$NODE_VERSION"
nvm use "$NODE_VERSION"

# Python via pyenv - use highest stable, not rc/beta
if ! command -v pyenv &> /dev/null; then
  echo "Installing pyenv..."
  brew install pyenv
fi

PYTHON_VERSION=$(pyenv install --list | grep -E '^\s*3\.[0-9]+\.[0-9]+$' | tail -1 | xargs)
echo "$PYTHON_VERSION" > .python-version
echo "Using Python $PYTHON_VERSION"
if ! pyenv versions --bare | grep -q "^$PYTHON_VERSION$"; then
  pyenv install "$PYTHON_VERSION"
fi
pyenv global "$PYTHON_VERSION"

if ! grep -q 'pyenv init' ~/.zshrc 2>/dev/null; then
  echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.zshrc
  echo 'eval "$(pyenv init --path)"' >> ~/.zshrc
  echo 'eval "$(pyenv init -)"' >> ~/.zshrc
fi

# Go via gvm - latest stable only
if ! command -v gvm &> /dev/null; then
  echo "Installing gvm..."
  bash < <(curl -sSL https://raw.githubusercontent.com/moovweb/gvm/master/binscripts/gvm-installer)
fi

source ~/.gvm/scripts/gvm

GO_VERSION=$(gvm listall | grep -Eo '^go[0-9]+\.[0-9]+(\.[0-9]+)?$' | sort -V | tail -1 | sed 's/^go//')
echo "$GO_VERSION" > .go-version
echo "Using Go $GO_VERSION"
if ! gvm list | grep -q "go$GO_VERSION"; then
  gvm install "go$GO_VERSION"
fi
gvm use "go$GO_VERSION" --default

# Summary
echo "✔ Node.js version: $(node -v)"
echo "✔ Python version: $(python3 --version)"
echo "✔ Go version: $(go version)"
echo ""
echo "Pinned versions (in .nvmrc, .python-version, .go-version):"
cat .nvmrc
cat .python-version
cat .go-version
