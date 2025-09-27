# Makefile for Lianxin Platform Docker Operations

.PHONY: help build up down logs clean test prod dev

# Default target
help:
	@echo "Lianxin Platform Docker Commands:"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development environment"
	@echo "  make dev-build    - Build and start development environment"
	@echo "  make dev-down     - Stop development environment"
	@echo "  make dev-logs     - View development logs"
	@echo ""
	@echo "Production:"
	@echo "  make prod         - Start production environment"
	@echo "  make prod-build   - Build and start production environment"
	@echo "  make prod-down    - Stop production environment"
	@echo "  make prod-logs    - View production logs"
	@echo ""
	@echo "Testing:"
	@echo "  make test         - Run tests in containers"
	@echo "  make test-build   - Build and run tests"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean        - Remove all containers and volumes"
	@echo "  make clean-images - Remove all built images"
	@echo "  make backup       - Backup databases"
	@echo "  make restore      - Restore databases from backup"
	@echo ""
	@echo "Monitoring:"
	@echo "  make status       - Show container status"
	@echo "  make health       - Check service health"

# Development commands
dev:
	docker-compose -f docker-compose.dev.yml up -d

dev-build:
	docker-compose -f docker-compose.dev.yml up -d --build

dev-down:
	docker-compose -f docker-compose.dev.yml down

dev-logs:
	docker-compose -f docker-compose.dev.yml logs -f

# Production commands
prod:
	docker-compose -f docker-compose.prod.yml up -d

prod-build:
	docker-compose -f docker-compose.prod.yml up -d --build

prod-down:
	docker-compose -f docker-compose.prod.yml down

prod-logs:
	docker-compose -f docker-compose.prod.yml logs -f

# Default environment (development)
up: dev

build: dev-build

down: dev-down

logs: dev-logs

# Testing commands
test:
	docker-compose -f docker-compose.test.yml up --abort-on-container-exit

test-build:
	docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit

# Maintenance commands
clean:
	docker-compose -f docker-compose.yml down -v
	docker-compose -f docker-compose.dev.yml down -v
	docker-compose -f docker-compose.prod.yml down -v
	docker-compose -f docker-compose.test.yml down -v
	docker system prune -f

clean-images:
	docker rmi $$(docker images -q lianxin-* 2>/dev/null) 2>/dev/null || echo "No images to remove"
	docker image prune -f

clean-images-all:
	docker image prune -a

# Database operations
backup:
	@echo "Creating database backup..."
	mkdir -p ./backups/mysql
	docker exec lianxin-mysql mysqldump -u root -p${MYSQL_ROOT_PASSWORD} ${DB_NAME} > ./backups/mysql/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "Backup completed"

restore:
	@echo "Restoring database from backup..."
	@read -p "Enter backup file name: \" backup_file; \
	if [ -f "./backups/mysql/$$backup_file" ]; then \
		docker exec -i lianxin-mysql mysql -u root -p${MYSQL_ROOT_PASSWORD} ${DB_NAME} < ./backups/mysql/$$backup_file; \
		echo "Restore completed"; \
	else \
		echo "Backup file does not exist!"; \
	fi

# Monitoring commands
status:
	docker-compose ps

health:
	@echo "Checking service health..."
	@curl -s http://localhost:3000/health | jq '.' || echo "Gateway not responding"
	@curl -s http://localhost:3001/health | jq '.' || echo "User service not responding"

# Database migrations
migrate:
	docker exec lianxin-user-service-dev npm run migrate

migrate-undo:
	docker exec lianxin-user-service-dev npm run migrate:undo

seed:
	docker exec lianxin-user-service-dev npm run seed


# Service-specific commands
gateway-shell:
	docker exec -it lianxin-gateway sh

user-service-shell:
	docker exec -it lianxin-user-service sh

mysql-shell:
	docker exec -it lianxin-mysql mysql -u root -p

redis-shell:
	docker exec -it lianxin-redis redis-cli

# Log commands for specific services
gateway-logs:
	docker logs -f lianxin-gateway

user-service-logs:
	docker logs -f lianxin-user-service

mysql-logs:
	docker logs -f lianxin-mysql

redis-logs:
	docker logs -f lianxin-redis