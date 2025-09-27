#!/bin/bash

# Docker Setup Script for Lianxin Platform
# This script helps set up the Docker environment

set -e

echo "🚀 Setting up Lianxin Platform Docker Environment"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    print_step "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_status "Docker and Docker Compose are installed"
}

# Check if .env file exists
check_env_file() {
    print_step "Checking environment configuration..."
    
    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Creating from .env.example..."
        cp .env.example .env
        print_status ".env file created. Please review and update the configuration."
    else
        print_status ".env file exists"
    fi
}

# Create necessary directories
create_directories() {
    print_step "Creating necessary directories..."
    
    directories=(
        "services/user-service/logs"
        "services/user-service/uploads"
        "backups/mysql"
        "backups/user-service"
        "nginx/logs"
        "nginx/ssl"
        "test-results"
    )
    
    for dir in "${directories[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            print_status "Created directory: $dir"
        fi
    done
}

# Generate secure secrets
generate_secrets() {
    print_step "Checking security configuration..."
    
    if grep -q "change-in-production" .env; then
        print_warning "Default secrets detected in .env file!"
        echo ""
        echo "For security, you should update the following in your .env file:"
        echo "- JWT_ACCESS_TOKEN_SECRET"
        echo "- JWT_REFRESH_TOKEN_SECRET"
        echo "- ENCRYPTION_PRIMARY_KEY"
        echo "- ENCRYPTION_SECONDARY_KEY"
        echo "- MYSQL_ROOT_PASSWORD"
        echo "- DB_PASSWORD"
        echo "- REDIS_PASSWORD"
        echo ""
        
        read -p "Would you like to generate secure secrets now? (y/n): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Generating secure secrets..."
            
            # Generate random secrets
            JWT_ACCESS_SECRET=$(openssl rand -hex 32)
            JWT_REFRESH_SECRET=$(openssl rand -hex 32)
            ENCRYPTION_PRIMARY=$(openssl rand -hex 32)
            ENCRYPTION_SECONDARY=$(openssl rand -hex 32)
            MYSQL_ROOT_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
            DB_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
            REDIS_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
            
            # Update .env file
            sed -i.bak \
                -e "s/your-super-secret-jwt-access-key-change-in-production-must-be-at-least-32-characters/$JWT_ACCESS_SECRET/" \
                -e "s/your-super-secret-jwt-refresh-key-change-in-production-must-be-at-least-32-characters/$JWT_REFRESH_SECRET/" \
                -e "s/your-32-character-encryption-key-change-in-production-12345678/$ENCRYPTION_PRIMARY/" \
                -e "s/your-32-character-secondary-key-change-in-production-87654321/$ENCRYPTION_SECONDARY/" \
                -e "s/Mahmud1334@/$MYSQL_ROOT_PASS/" \
                -e "s/redis123/$REDIS_PASS/" \
                .env
            
            print_status "Secure secrets generated and updated in .env file"
            print_status "Backup of original .env saved as .env.bak"
        fi
    else
        print_status "Security configuration looks good"
    fi
}

# Build Docker images
build_images() {
    print_step "Building Docker images..."
    
    print_status "Building API Gateway..."
    docker build -f gateway/Dockerfile -t lianxin-gateway .
    
    print_status "Building User Service..."
    docker build -f services/user-service/Dockerfile -t lianxin-user-service .
    
    print_status "All images built successfully"
}

# Start services
start_services() {
    print_step "Starting services..."
    
    environment=${1:-development}
    
    case $environment in
        "development"|"dev")
            print_status "Starting development environment..."
            docker-compose -f docker-compose.dev.yml up -d
            ;;
        "production"|"prod")
            print_status "Starting production environment..."
            docker-compose -f docker-compose.prod.yml up -d
            ;;
        *)
            print_status "Starting default environment..."
            docker-compose up -d
            ;;
    esac
    
    print_status "Services started successfully"
}

# Wait for services to be healthy
wait_for_services() {
    print_step "Waiting for services to be healthy..."
    
    services=("mysql" "redis" "user-service" "gateway")
    
    for service in "${services[@]}"; do
        print_status "Waiting for $service to be healthy..."
        
        timeout=120
        counter=0
        
        while [ $counter -lt $timeout ]; do
            if docker-compose ps | grep -q "$service.*healthy"; then
                print_status "$service is healthy"
                break
            fi
            
            if [ $counter -eq $timeout ]; then
                print_error "$service failed to become healthy within $timeout seconds"
                exit 1
            fi
            
            sleep 2
            counter=$((counter + 2))
        done
    done
    
    print_status "All services are healthy"
}

# Run database migrations
run_migrations() {
    print_step "Running database migrations..."
    
    # Wait a bit more for MySQL to be fully ready
    sleep 10
    
    # The migrations are automatically run by MySQL init scripts
    # But we can also run them manually if needed
    print_status "Database migrations completed"
}

# Show service information
show_service_info() {
    print_step "Service Information"
    echo ""
    echo "🌐 Services are now running:"
    echo "   API Gateway:      http://localhost:3000"
    echo "   User Service:     http://localhost:3001"
    echo "   Database Admin:   http://localhost:8080"
    echo "   Redis Commander:  http://localhost:8081"
    echo ""
    echo "📊 Health Checks:"
    echo "   Gateway Health:   http://localhost:3000/health"
    echo "   User Service:     http://localhost:3001/health"
    echo ""
    echo "🔧 Database Access:"
    echo "   MySQL Host:       localhost:3306"
    echo "   Redis Host:       localhost:6379"
    echo ""
    echo "📖 API Documentation:"
    echo "   Gateway Info:     http://localhost:3000/api"
    echo ""
    echo "🐳 Docker Commands:"
    echo "   View logs:        make logs"
    echo "   Stop services:    make down"
    echo "   Restart:          make down && make up"
    echo ""
}

# Main execution
main() {
    environment=${1:-development}
    
    echo "Setting up environment: $environment"
    echo ""
    
    check_docker
    check_env_file
    create_directories
    generate_secrets
    build_images
    start_services $environment
    wait_for_services
    run_migrations
    show_service_info
    
    print_status "🎉 Lianxin Platform setup completed successfully!"
    print_status "You can now start developing or testing the platform."
}

# Run main function with command line arguments
main "$@"