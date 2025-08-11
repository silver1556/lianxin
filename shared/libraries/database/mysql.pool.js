const mysql = require('mysql2/promise');
const logger = require('../logging/logger');

/**
 * MySQL Connection Pool Manager
 * Handles database connections, pooling, and health monitoring
 */
class MySQLPool {
  constructor() {
    this.pool = null;
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'lianxin',
      charset: 'utf8mb4',
      timezone: '+08:00',
      connectionLimit: parseInt(process.env.DB_POOL_MAX) || 10,
      acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000,
      timeout: parseInt(process.env.DB_TIMEOUT) || 60000,
      reconnect: true,
      multipleStatements: false,
      ssl: process.env.DB_SSL_ENABLED === 'true' ? {
        rejectUnauthorized: false
      } : false
    };
  }

  /**
   * Initialize connection pool
   */
  async initialize() {
    try {
      this.pool = mysql.createPool(this.config);
      
      // Test connection
      await this.testConnection();
      
      logger.info('MySQL connection pool initialized', {
        host: this.config.host,
        database: this.config.database,
        connectionLimit: this.config.connectionLimit
      });
      
      return this.pool;
    } catch (error) {
      logger.error('Failed to initialize MySQL pool', {
        error: error.message,
        config: {
          host: this.config.host,
          database: this.config.database
        }
      });
      throw error;
    }
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      
      logger.info('MySQL connection test successful');
      return true;
    } catch (error) {
      logger.error('MySQL connection test failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Execute query
   */
  async query(sql, params = []) {
    try {
      const [rows, fields] = await this.pool.execute(sql, params);
      return { rows, fields };
    } catch (error) {
      logger.error('MySQL query failed', {
        error: error.message,
        sql: sql.substring(0, 100)
      });
      throw error;
    }
  }

  /**
   * Get connection from pool
   */
  async getConnection() {
    try {
      return await this.pool.getConnection();
    } catch (error) {
      logger.error('Failed to get MySQL connection', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Close connection pool
   */
  async close() {
    try {
      if (this.pool) {
        await this.pool.end();
        logger.info('MySQL connection pool closed');
      }
    } catch (error) {
      logger.error('Error closing MySQL pool', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    if (!this.pool) return null;
    
    return {
      totalConnections: this.pool.pool._allConnections.length,
      freeConnections: this.pool.pool._freeConnections.length,
      acquiringConnections: this.pool.pool._acquiringConnections.length
    };
  }
}

// Export singleton instance
module.exports = new MySQLPool();