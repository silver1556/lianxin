#!/bin/bash

# Docker Cleanup Script for Lianxin Platform
# This script helps clean up Docker resources

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

echo "🧹 Lianxin Platform Docker Cleanup"
echo "=================================="

# Stop all running containers
stop_containers() {
    print_step "Stopping all Lianxin containers..."
    
    docker-compose -f docker-compose.yml down 2>/dev/null || true
    docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
    docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
    docker-compose -f docker-compose.test.yml down 2>/dev/null || true
    
    print_status "All containers stopped"
}

# Remove containers
remove_containers() {
    print_step "Removing Lianxin containers..."
    
    containers=$(docker ps -a --filter "name=lianxin-" --format "{{.Names}}" 2>/dev/null || true)
    
    if [ -n "$containers" ]; then
        echo "$containers" | xargs docker rm -f 2>/dev/null || true
        print_status "Containers removed"
    else
        print_status "No containers to remove"
    fi
}

# Remove images
remove_images() {
    print_step "Removing Lianxin images..."
    
    images=$(docker images --filter "reference=lianxin-*" --format "{{.Repository}}:{{.Tag}}" 2>/dev/null || true)
    
    if [ -n "$images" ]; then
        echo "$images" | xargs docker rmi -f 2>/dev/null || true
        print_status "Images removed"
    else
        print_status "No images to remove"
    fi
}

# Remove volumes
remove_volumes() {
    print_warning "This will permanently delete all data!"
    read -p "Are you sure you want to remove all volumes? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_step "Removing volumes..."
        
        docker-compose -f docker-compose.yml down -v 2>/dev/null || true
        docker-compose -f docker-compose.dev.yml down -v 2>/dev/null || true
        docker-compose -f docker-compose.prod.yml down -v 2>/dev/null || true
        docker-compose -f docker-compose.test.yml down -v 2>/dev/null || true
        
        volumes=$(docker volume ls --filter "name=lianxin" --format "{{.Name}}" 2>/dev/null || true)
        
        if [ -n "$volumes" ]; then
            echo "$volumes" | xargs docker volume rm 2>/dev/null || true
            print_status "Volumes removed"
        else
            print_status "No volumes to remove"
        fi
    else
        print_status "Volume removal cancelled"
    fi
}

# Remove networks
remove_networks() {
    print_step "Removing networks..."
    
    networks=$(docker network ls --filter "name=lianxin" --format "{{.Name}}" 2>/dev/null || true)
    
    if [ -n "$networks" ]; then
        echo "$networks" | xargs docker network rm 2>/dev/null || true
        print_status "Networks removed"
    else
        print_status "No networks to remove"
    fi
}

# Clean Docker system
clean_system() {
    print_step "Cleaning Docker system..."
    
    docker system prune -f
    docker image prune -f
    docker volume prune -f
    docker network prune -f
    
    print_status "Docker system cleaned"
}

# Show disk usage
show_usage() {
    print_step "Docker disk usage:"
    docker system df
}

# Main cleanup function
cleanup_all() {
    stop_containers
    remove_containers
    remove_images
    remove_volumes
    remove_networks
    clean_system
    show_usage
    
    print_status "🎉 Cleanup completed successfully!"
}

# Partial cleanup (keeps data)
cleanup_partial() {
    stop_containers
    remove_containers
    remove_images
    remove_networks
    clean_system
    show_usage
    
    print_status "🎉 Partial cleanup completed! (Data volumes preserved)"
}

# Show help
show_help() {
    echo "Usage: $0 [option]"
    echo ""
    echo "Options:"
    echo "  all       - Complete cleanup (removes everything including data)"
    echo "  partial   - Partial cleanup (preserves data volumes)"
    echo "  containers - Remove only containers"
    echo "  images    - Remove only images"
    echo "  volumes   - Remove only volumes (WARNING: deletes data)"
    echo "  networks  - Remove only networks"
    echo "  system    - Clean Docker system cache"
    echo "  usage     - Show Docker disk usage"
    echo "  help      - Show this help message"
    echo ""
}

# Main execution
case "${1:-help}" in
    "all")
        cleanup_all
        ;;
    "partial")
        cleanup_partial
        ;;
    "containers")
        stop_containers
        remove_containers
        ;;
    "images")
        remove_images
        ;;
    "volumes")
        remove_volumes
        ;;
    "networks")
        remove_networks
        ;;
    "system")
        clean_system
        ;;
    "usage")
        show_usage
        ;;
    "help"|*)
        show_help
        ;;
esac