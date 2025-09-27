# scripts/clamav-health-check.sh
#!/bin/bash

# ClamAV Health Check Script
# Comprehensive health check for ClamAV daemon

set -e

# Configuration
CLAMAV_HOST=${CLAMAV_HOST:-"localhost"}
CLAMAV_PORT=${CLAMAV_PORT:-3310}
TIMEOUT=${TIMEOUT:-30}
VERBOSE=${VERBOSE:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    if [ "$VERBOSE" = true ]; then
        echo -e "$1"
    fi
}

error() {
    echo -e "${RED}ERROR: $1${NC}" >&2
}

success() {
    echo -e "${GREEN}SUCCESS: $1${NC}"
}

warning() {
    echo -e "${YELLOW}WARNING: $1${NC}"
}

# Check if ClamAV daemon is listening
check_daemon_listening() {
    log "Checking if ClamAV daemon is listening on ${CLAMAV_HOST}:${CLAMAV_PORT}..."
    
    if timeout $TIMEOUT nc -z "$CLAMAV_HOST" "$CLAMAV_PORT" 2>/dev/null; then
        success "ClamAV daemon is listening on port $CLAMAV_PORT"
        return 0
    else
        error "ClamAV daemon is not listening on port $CLAMAV_PORT"
        return 1
    fi
}

# Check if daemon responds to PING
check_daemon_ping() {
    log "Sending PING command to ClamAV daemon..."
    
    response=$(echo "PING" | timeout $TIMEOUT nc "$CLAMAV_HOST" "$CLAMAV_PORT" 2>/dev/null || echo "ERROR")
    
    if echo "$response" | grep -q "PONG"; then
        success "ClamAV daemon responded to PING"
        return 0
    else
        error "ClamAV daemon did not respond to PING properly"
        return 1
    fi
}

# Check virus database status
check_virus_database() {
    log "Checking virus database status..."
    
    # Check if main database files exist
    if [ -f "/var/lib/clamav/main.cvd" ] || [ -f "/var/lib/clamav/main.cld" ]; then
        success "Main virus database found"
    else
        error "Main virus database not found"
        return 1
    fi
    
    if [ -f "/var/lib/clamav/daily.cvd" ] || [ -f "/var/lib/clamav/daily.cld" ]; then
        success "Daily virus database found"
    else
        warning "Daily virus database not found (may still be downloading)"
    fi
    
    # Check database age
    if [ -f "/var/lib/clamav/main.cvd" ]; then
        db_age=$(find /var/lib/clamav/main.cvd -mtime +7)
        if [ -n "$db_age" ]; then
            warning "Main virus database is older than 7 days"
        else
            success "Main virus database is recent"
        fi
    fi
    
    return 0
}

# Check daemon version
check_daemon_version() {
    log "Checking ClamAV daemon version..."
    
    version=$(echo "VERSION" | timeout $TIMEOUT nc "$CLAMAV_HOST" "$CLAMAV_PORT" 2>/dev/null | head -n1 || echo "ERROR")
    
    if [ "$version" != "ERROR" ] && [ -n "$version" ]; then
        success "ClamAV version: $version"
        return 0
    else
        error "Could not retrieve ClamAV version"
        return 1
    fi
}

# Test scanning with EICAR
test_scanning() {
    log "Testing scanning functionality with EICAR test file..."
    
    # Create EICAR test string
    eicar_string="X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
    temp_file="/tmp/eicar_test_$$"
    
    echo "$eicar_string" > "$temp_file"
    
    # Test scanning via daemon
    scan_result=$(echo "SCAN $temp_file" | timeout $TIMEOUT nc "$CLAMAV_HOST" "$CLAMAV_PORT" 2>/dev/null || echo "ERROR")
    
    # Cleanup
    rm -f "$temp_file"
    
    if echo "$scan_result" | grep -q "FOUND"; then
        success "Scanning test passed - EICAR detected"
        return 0
    else
        error "Scanning test failed - EICAR not detected"
        log "Scan result: $scan_result"
        return 1
    fi
}

# Check daemon statistics
check_daemon_stats() {
    log "Checking daemon statistics..."
    
    stats=$(echo "STATS" | timeout $TIMEOUT nc "$CLAMAV_HOST" "$CLAMAV_PORT" 2>/dev/null || echo "ERROR")
    
    if [ "$stats" != "ERROR" ] && [ -n "$stats" ]; then
        success "Daemon statistics retrieved"
        if [ "$VERBOSE" = true ]; then
            echo "Stats: $stats"
        fi
        return 0
    else
        warning "Could not retrieve daemon statistics"
        return 1
    fi
}

# Check log files
check_log_files() {
    log "Checking log files..."
    
    if [ -f "/var/log/clamav/clamd.log" ]; then
        success "ClamAV daemon log file exists"
        
        # Check for recent activity
        if find /var/log/clamav/clamd.log -mmin -60 | grep -q .; then
            success "Recent activity found in daemon log"
        else
            warning "No recent activity in daemon log"
        fi
        
        # Check for errors in log
        error_count=$(tail -100 /var/log/clamav/clamd.log 2>/dev/null | grep -i error | wc -l)
        if [ "$error_count" -gt 0 ]; then
            warning "Found $error_count errors in recent daemon log entries"
        else
            success "No recent errors in daemon log"
        fi
    else
        warning "ClamAV daemon log file not found"
    fi
    
    if [ -f "/var/log/clamav/freshclam.log" ]; then
        success "FreshClam log file exists"
    else
        warning "FreshClam log file not found"
    fi
}

# Main health check function
main() {
    echo "ClamAV Health Check Starting..."
    echo "=================================="
    
    failed_checks=0
    
    # Run all checks
    check_daemon_listening || ((failed_checks++))
    check_daemon_ping || ((failed_checks++))
    check_virus_database || ((failed_checks++))
    check_daemon_version || ((failed_checks++))
    check_daemon_stats || ((failed_checks++))
    test_scanning || ((failed_checks++))
    check_log_files || ((failed_checks++))
    
    echo "=================================="
    
    if [ $failed_checks -eq 0 ]; then
        success "All ClamAV health checks passed!"
        exit 0
    else
        error "$failed_checks health check(s) failed!"
        exit 1
    fi
}

# Run main function
main "$@"