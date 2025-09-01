#!/bin/bash

# Health Check Script for Lianxin Platform
# Monitors the health of all services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[HEALTHY]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

echo "🏥 Lianxin Platform Health Check"
echo "==============================="

# Check container status
check_containers() {
    print_info "Checking container status..."
    
    containers=("lianxin-mysql" "lianxin-redis" "lianxin-user-service" "lianxin-gateway")
    
    for container in "${containers[@]}"; do
        if docker ps --filter "name=$container" --filter "status=running" | grep -q "$container"; then
            health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "no-healthcheck")
            
            case $health in
                "healthy")
                    print_status "$container is running and healthy"
                    ;;
                "unhealthy")
                    print_error "$container is running but unhealthy"
                    ;;
                "starting")
                    print_warning "$container is starting up..."
                    ;;
                "no-healthcheck")
                    print_warning "$container is running (no health check configured)"
                    ;;
                *)
                    print_warning "$container status: $health"
                    ;;
            esac
        else
            print_error "$container is not running"
        fi
    done
}

# Check service endpoints
check_endpoints() {
    print_info "Checking service endpoints..."
    
    # Gateway health check
    if curl -s -f http://localhost:3000/health > /dev/null 2>&1; then
        print_status "Gateway endpoint is responding"
    else
        print_error "Gateway endpoint is not responding"
    fi
    
    # User service health check
    if curl -s -f http://localhost:3001/health > /dev/null 2>&1; then
        print_status "User service endpoint is responding"
    else
        print_error "User service endpoint is not responding"
    fi
    
    # Database connection check
    if docker exec lianxin-mysql mysqladmin ping -h localhost -u root -p${MYSQL_ROOT_PASSWORD:-Mahmud1334@} > /dev/null 2>&1; then
        print_status "MySQL database is responding"
    else
        print_error "MySQL database is not responding"
    fi
    
    # Redis connection check
    if docker exec lianxin-redis redis-cli ping > /dev/null 2>&1; then
        print_status "Redis cache is responding"
    else
        print_error "Redis cache is not responding"
    fi
}

# Check resource usage
check_resources() {
    print_info "Checking resource usage..."
    
    echo ""
    echo "📊 Container Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
    
    echo ""
    echo "💾 Docker Disk Usage:"
    docker system df
}

# Check logs for errors
check_logs() {
    print_info "Checking recent logs for errors..."
    
    containers=("lianxin-gateway" "lianxin-user-service")
    
    for container in "${containers[@]}"; do
        if docker ps --filter "name=$container" | grep -q "$container"; then
            error_count=$(docker logs --since=5m "$container" 2>&1 | grep -i error | wc -l)
            warning_count=$(docker logs --since=5m "$container" 2>&1 | grep -i warning | wc -l)
            
            if [ "$error_count" -gt 0 ]; then
                print_error "$container has $error_count errors in the last 5 minutes"
            elif [ "$warning_count" -gt 0 ]; then
                print_warning "$container has $warning_count warnings in the last 5 minutes"
            else
                print_status "$container logs look clean"
            fi
        fi
    done
}

# Generate health report
generate_report() {
    print_info "Generating health report..."
    
    report_file="health-report-$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "Lianxin Platform Health Report"
        echo "Generated: $(date)"
        echo "=============================="
        echo ""
        
        echo "Container Status:"
        docker ps --filter "name=lianxin-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        
        echo "Service Health:"
        curl -s http://localhost:3000/health | jq '.' 2>/dev/null || echo "Gateway not responding"
        echo ""
        curl -s http://localhost:3001/health | jq '.' 2>/dev/null || echo "User service not responding"
        echo ""
        
        echo "Resource Usage:"
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
        echo ""
        
        echo "Disk Usage:"
        docker system df
        
    } > "$report_file"
    
    print_status "Health report saved to: $report_file"
}

# Main execution
case "${1:-all}" in
    "containers")
        check_containers
        ;;
    "endpoints")
        check_endpoints
        ;;
    "resources")
        check_resources
        ;;
    "logs")
        check_logs
        ;;
    "report")
        generate_report
        ;;
    "all"|*)
        check_containers
        echo ""
        check_endpoints
        echo ""
        check_resources
        echo ""
        check_logs
        ;;
esac

echo ""
print_info "Health check completed"