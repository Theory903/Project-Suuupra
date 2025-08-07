#!/bin/bash

# Enhanced Markdown Linting Fix Script
# Fixes the remaining stubborn markdown linting issues

echo "🔧 Starting enhanced markdown linting fixes..."

# Function to fix a markdown file with more targeted fixes
fix_markdown_file_enhanced() {
    local file="$1"
    echo "Fixing: $file"
    
    # Create backup
    cp "$file" "$file.bak2"
    
    # Fix list marker spacing more thoroughly
    # Fix 2-space indented lists
    sed -i '' 's/^-  /- /g' "$file"
    # Fix 3-space indented lists  
    sed -i '' 's/^-   /- /g' "$file"
    # Fix 4+ space indented lists
    sed -i '' 's/^-    */- /g' "$file"
    
    # Fix nested list spacing (preserve indentation but fix marker spacing)
    sed -i '' 's/^\(  *\)-  /\1- /g' "$file"
    sed -i '' 's/^\(  *\)-   /\1- /g' "$file"
    sed -i '' 's/^\(  *\)-    */\1- /g' "$file"
    
    # Add blank lines before headings if missing
    sed -i '' '/^#/{
        x
        /./{
            x
            i\

            b
        }
        x
    }' "$file"
    
    # Add blank lines after headings if missing
    sed -i '' '/^#.*/{
        n
        /^$/{
            b
        }
        i\

    }' "$file"
    
    # Add blank lines before lists
    sed -i '' '/^- /{
        x
        /^$/{
            x
            b
        }
        /./{
            x
            i\

            b
        }
        x
    }' "$file"
    
    # Add blank lines after lists
    awk '
    BEGIN { in_list = 0 }
    /^- / { 
        print
        in_list = 1
        next
    }
    /^$/ {
        print
        in_list = 0
        next
    }
    !/^- / && in_list == 1 {
        print ""
        print
        in_list = 0
        next
    }
    { print }
    ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
    
    # Add blank lines around tables
    sed -i '' '/^|/{
        x
        /^$/{
            x
            b
        }
        /./{
            x
            i\

            b
        }
        x
    }' "$file"
    
    # Add blank lines around fenced code blocks
    sed -i '' '/^```/{
        x
        /^$/{
            x
            b
        }
        /./{
            x
            i\

            b
        }
        x
    }' "$file"
    
    # Fix fenced code blocks without language
    sed -i '' 's/^```$/```text/g' "$file"
    
    # Remove excessive blank lines (more than 2 consecutive)
    awk '
    /^$/ { 
        blank_count++
        if (blank_count <= 1) print
    }
    !/^$/ { 
        print
        blank_count = 0
    }
    ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
    
    # Ensure file ends with single newline
    if [ -s "$file" ]; then
        if [ "$(tail -c1 "$file" | wc -l)" -eq 0 ]; then
            echo "" >> "$file"
        fi
    fi
    
    echo "✅ Enhanced fix applied: $file"
}

# Focus on the main documentation files that have the most errors
main_docs=(
    "./README.md"
    "./docs/architecture/HLD-DataFlow.md"
    "./docs/architecture/HLD-DeploymentTopology.md"
    "./docs/architecture/HLD-SystemOverview.md"
    "./docs/architecture/HLD-ScalingStrategy.md"
    "./docs/architecture/HLD-SecurityArchitecture.md"
    "./docs/design/infrastructure/LLD-Monitoring.md"
    "./docs/design/infrastructure/LLD-Kubernetes.md"
    "./docs/design/infrastructure/LLD-Terraform.md"
    "./docs/design/commerce/LLD-CommerceService.md"
    "./docs/design/identity/LLD-IdentityService.md"
    "./docs/design/analytics/LLD-AnalyticsService.md"
    "./docs/design/intelligence/LLD-LLMTutorService.md"
    "./docs/design/intelligence/LLD-RecommendationService.md"
    "./docs/design/intelligence/LLD-SearchCrawlerService.md"
    "./docs/design/payments/LLD-PaymentGateway.md"
    "./docs/design/media/LLD-StreamingArchitecture.md"
    "./docs/design/media/LLD-VODService.md"
    "./docs/apis/api-gateway.md"
    "./docs/runbooks/api-gateway-operations.md"
)

for file in "${main_docs[@]}"; do
    if [ -f "$file" ]; then
        fix_markdown_file_enhanced "$file"
    fi
done

echo "🎉 Enhanced markdown linting fixes completed!"
echo "📝 Additional backup files created with .bak2 extension"
