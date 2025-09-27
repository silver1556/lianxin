/**
 * Event Publisher Port (Interface)
 * Defines the contract for publishing domain events
 */
class EventPublisherPort {
  /**
   * Publish domain event
   * @param {Object} event - Domain event
   * @returns {Promise<void>}
   */
  async publish(event) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Publish multiple events
   * @param {Object[]} events - Array of domain events
   * @returns {Promise<void>}
   */
  async publishBatch(events) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Subscribe to events
   * @param {string} eventType - Event type to subscribe to
   * @param {Function} handler - Event handler function
   * @returns {Promise<void>}
   */
  async subscribe(eventType, handler) {
    throw new Error('Method must be implemented by adapter');
  }

  /**
   * Unsubscribe from events
   * @param {string} eventType - Event type to unsubscribe from
   * @param {Function} handler - Event handler function
   * @returns {Promise<void>}
   */
  async unsubscribe(eventType, handler) {
    throw new Error('Method must be implemented by adapter');
  }
}

module.exports = EventPublisherPort;