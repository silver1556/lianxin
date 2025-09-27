# scripts/clamav-update.sh
#!/bin/bash

# ClamAV Database Update Script
# Safely update virus definitions and reload daemon

set -e

# Configuration
CLAMAV_HOST=${CLAMAV_HOST:-"localhost"}
CLAMAV_PORT=${CLAMAV_PORT:-3310}
FRESHCLAM_CONFIG=${FRESHCLAM_CONFIG:-"/etc/clamav/freshclam.conf"}
BACKUP_DIR=${BACKUP_DIR:-"/var/lib/clamav/backup"}
TIMEOUT=${TIMEOUT:-300}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" >&2
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Create backup of current database
backup_database() {
    log "Creating backup of current virus database..."
    
    mkdir -p "$BACKUP_DIR"
    
    if [ -f "/var/lib/clamav/main.cvd" ]; then
        cp /var/lib/clamav/*.cvd "$BACKUP_DIR/" 2>/dev/null || true
        cp /var/lib/clamav/*.cld "$BACKUP_DIR/" 2>/dev/null || true
        log "Database backup created in $BACKUP_DIR"
    else
        warning "No existing database found to backup"
    fi
}

# Update virus definitions
update_definitions() {
    log "Updating virus definitions..."
    
    # Run freshclam with custom config
    if freshclam --config-file="$FRESHCLAM_CONFIG" --verbose; then
        log "Virus definitions updated successfully"
        return 0
    else
        error "Failed to update virus definitions"
        return 1
    fi
}

# Reload daemon
reload_daemon() {
    log "Reloading ClamAV daemon..."
    
    # Send RELOAD command to daemon
    response=$(echo "RELOAD" | timeout $TIMEOUT nc "$CLAMAV_HOST" "$CLAMAV_PORT" 2>/dev/null || echo "ERROR")
    
    if echo "$response" | grep -q "RELOADING"; then
        log "Daemon reload initiated successfully"
        
        # Wait for reload to complete
        sleep 5
        
        # Verify daemon is responsive
        if echo "PING" | timeout 30 nc "$CLAMAV_HOST" "$CLAMAV_PORT" | grep -q "PONG"; then
            log "Daemon reload completed successfully"
            return 0
        else
            error "Daemon not responding after reload"
            return 1
        fi
    else
        error "Failed to reload daemon"
        return 1
    fi
}

# Test updated database
test_updated_database() {
    log "Testing updated database..."
    
    # Create EICAR test
    eicar_string="X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
    temp_file="/tmp/eicar_update_test_$$"
    
    echo "$eicar_string" > "$temp_file"
    
    # Test scan
    scan_result=$(echo "SCAN $temp_file" | timeout 30 nc "$CLAMAV_HOST" "$CLAMAV_PORT" 2>/dev/null || echo "ERROR")
    
    rm -f "$temp_file"
    
    if echo "$scan_result" | grep -q "FOUND"; then
        log "Database test passed - scanning is working"
        return 0
    else
        error "Database test failed - scanning may not be working"
        return 1
    fi
}

# Get database version info
show_database_info() {
    log "Current database information:"
    
    # Show file dates and sizes
    if [ -d "/var/lib/clamav" ]; then
        ls -la /var/lib/clamav/*.c?d 2>/dev/null || warning "No database files found"
    fi
    
    # Get version from daemon
    version=$(echo "VERSION" | timeout 30 nc "$CLAMAV_HOST" "$CLAMAV_PORT" 2>/dev/null | head -n1)
    if [ -n "$version" ]; then
        log "ClamAV version: $version"
    fi
}

# Main update function
main() {
    echo "ClamAV Database Update Starting..."
    echo "=================================="
    
    # Show current info
    show_database_info
    
    # Create backup
    backup_database
    
    # Update definitions
    if ! update_definitions; then
        error "Update failed, database backup available in $BACKUP_DIR"
        exit 1
    fi
    
    # Reload daemon
    if ! reload_daemon; then
        error "Daemon reload failed, may need manual restart"
        exit 1
    fi
    
    # Test updated database
    if ! test_updated_database; then
        warning "Database test failed, but update completed"
    fi
    
    # Show updated info
    echo "=================================="
    show_database_info
    echo "=================================="
    
    log "ClamAV database update completed successfully!"
}

# Run main function
main "$@"