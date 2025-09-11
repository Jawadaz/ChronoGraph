#!/bin/bash

echo "🔍 Checking ChronoGraph compilation errors..."
echo "============================================="

cd src-tauri
source "$HOME/.cargo/env" 2>/dev/null

echo "Running cargo check..."
if cargo check 2>&1 | tee /tmp/cargo_check.log; then
    echo ""
    echo "✅ Compilation successful!"
else
    echo ""
    echo "❌ Compilation errors found:"
    echo ""
    # Show just the errors and warnings
    grep -E "(error|warning):" /tmp/cargo_check.log | head -20
    
    echo ""
    echo "📄 Full error log saved to: /tmp/cargo_check.log"
    echo "Run 'cat /tmp/cargo_check.log' to see complete output"
fi