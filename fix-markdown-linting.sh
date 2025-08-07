#!/bin/bash

# Automated Markdown Linting Fix Script
# Fixes common markdown linting issues across the entire project

echo "🔧 Starting automated markdown linting fixes..."

# Function to fix a markdown file
fix_markdown_file() {
    local file="$1"
    echo "Fixing: $file"
    
    # Create backup
    cp "$file" "$file.bak"
    
    # Fix list marker spacing (change multiple spaces after - to single space)
    sed -i '' 's/^-  /- /g' "$file"
    sed -i '' 's/^-   /- /g' "$file"
    
    # Add blank lines around headings
    sed -i '' '/^#/i\
' "$file"
    sed -i '' '/^#/a\
' "$file"
    
    # Add blank lines around lists (before lists starting with -)
    sed -i '' '/^- /i\
' "$file"
    sed -i '' '/^- /a\
' "$file"
    
    # Add blank lines around fenced code blocks
    sed -i '' '/^```/i\
' "$file"
    sed -i '' '/^```$/a\
' "$file"
    
    # Add blank lines around tables
    sed -i '' '/^|/i\
' "$file"
    sed -i '' '/^|.*|$/a\
' "$file"
    
    # Remove multiple consecutive blank lines (keep max 1)
    awk '
    /^$/ { 
        if (empty_lines < 1) {
            print
            empty_lines++
        }
    }
    !/^$/ { 
        print
        empty_lines = 0
    }
    ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
    
    # Ensure file ends with single newline
    sed -i '' -e '$a\' "$file"
    
    # Add language to fenced code blocks that don't have one
    sed -i '' 's/^```$/```text/g' "$file"
    
    echo "✅ Fixed: $file"
}

# Find all markdown files and fix them
find . -name "*.md" -type f | while read -r file; do
    fix_markdown_file "$file"
done

echo "🎉 Automated markdown linting fixes completed!"
echo "📝 Backup files created with .bak extension"
echo "🧹 Run 'find . -name \"*.bak\" -delete' to remove backups after verification"
