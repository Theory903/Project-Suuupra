#!/bin/bash

echo "🔧 Fixing Windows compatibility issues..."

# Step 1: Remove all node_modules from Git tracking
echo "📦 Removing node_modules from Git tracking..."
git rm -r --cached node_modules/ 2>/dev/null || true
git rm -r --cached postman/node_modules/ 2>/dev/null || true

# Find and remove all node_modules directories from git tracking
find . -name "node_modules" -type d | while read dir; do
    echo "Removing $dir from Git tracking..."
    git rm -r --cached "$dir/" 2>/dev/null || true
done

# Step 2: Ensure .gitignore is comprehensive
echo "📝 Updating .gitignore for comprehensive coverage..."
cat >> .gitignore << EOF

# Windows compatibility - ensure node_modules are ignored
**/node_modules/
**/node_modules/**/*
node_modules/
node_modules/**/*

# Windows specific
Thumbs.db
Desktop.ini
$RECYCLE.BIN/
*.cab
*.msi
*.msm
*.msp
*.lnk

# Long path prevention
**/very/long/paths/**
EOF

# Step 3: Clean up any existing node_modules
echo "🧹 Cleaning up existing node_modules directories..."
find . -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true

# Step 4: Refresh Git index
echo "🔄 Refreshing Git index..."
git add .gitignore .gitattributes

echo "✅ Windows compatibility fixes applied!"
echo ""
echo "Next steps:"
echo "1. Commit these changes: git commit -m 'Fix Windows compatibility - remove node_modules from Git'"
echo "2. Contributors can now clone successfully on Windows"
echo "3. Share the WINDOWS_SETUP.md guide with Windows developers"
