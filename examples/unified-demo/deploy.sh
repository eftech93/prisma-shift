#!/bin/bash
set -e

# Unified deployment script for blog platform
# This runs both schema migrations (Prisma) and data migrations (prisma-shift)

echo "🚀 Starting deployment of Blog Platform"
echo "======================================="
echo ""

# Use the unified deploy command
echo "📦 Running unified deployment..."
npx prisma-shift deploy

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Next steps:"
echo "  - View database: npm run studio"
echo "  - Run demo app: npm run dev"
