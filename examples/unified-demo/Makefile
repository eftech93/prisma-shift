.PHONY: help up down logs shell migrate deploy reset demo studio test clean

# Default target
help:
	@echo "Blog Platform Demo - Available Commands:"
	@echo ""
	@echo "  make up          - Start PostgreSQL database (Docker)"
	@echo "  make down        - Stop PostgreSQL database"
	@echo "  make logs        - View database logs"
	@echo "  make deploy      - Run all migrations (schema + data) - UNIFIED"
	@echo "  make reset       - Reset database and re-run all migrations"
	@echo "  make demo        - Run the demo application"
	@echo "  make studio      - Open Prisma Studio"
	@echo "  make test        - Run tests"
	@echo "  make clean       - Remove all containers and volumes"
	@echo ""
	@echo "The 'make deploy' command runs both schema and data migrations"
	@echo "in the correct sequence: prisma migrate deploy -> prisma generate -> data-migrate run"
	@echo ""

# Start infrastructure
up:
	@echo "🐳 Starting PostgreSQL database..."
	docker-compose up -d
	@echo "⏳ Waiting for database to be ready..."
	@sleep 3
	@echo "✅ Database ready!"
	@echo ""
	@echo "Adminer (DB UI): http://localhost:8080"
	@echo "  Server: postgres"
	@echo "  Username: bloguser"
	@echo "  Password: blogpass"
	@echo "  Database: blog_demo"

# Stop infrastructure
down:
	@echo "🛑 Stopping PostgreSQL database..."
	docker-compose down

# View logs
logs:
	docker-compose logs -f postgres

# Open shell in database
shell:
	docker-compose exec postgres psql -U bloguser -d blog_demo

# Unified deploy command (schema + data migrations + generate)
deploy:
	@echo "🚀 Running unified deployment..."
	npx prisma-shift deploy
	@echo ""
	@echo "✅ All migrations complete!"

# Legacy: Run only data migrations (use 'make deploy' instead)
migrate:
	@echo "⚠️  'make migrate' only runs data migrations"
	@echo "   Use 'make deploy' to run both schema and data migrations"
	@echo ""
	npx prisma-shift run

# Reset and re-run all migrations
reset:
	@echo "⚠️  Resetting database..."
	npx prisma migrate reset --force
	npx prisma-shift reset
	@echo ""
	@echo "🔄 Re-running unified deployment..."
	@make deploy
	@echo ""
	@echo "✅ Database reset complete!"

# Run demo application
demo:
	@echo "🚀 Running demo application..."
	npx ts-node src/app.ts

# Open Prisma Studio
studio:
	@echo "🎨 Opening Prisma Studio..."
	npx prisma studio

# Run tests
test:
	@echo "🧪 Running tests..."
	npm test

# Clean everything
clean:
	@echo "🧹 Cleaning up..."
	docker-compose down -v
	rm -rf node_modules
	rm -rf dist
	@echo "✅ Cleanup complete!"
