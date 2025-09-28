/**
 * Event Publisher Contract
 * Defines event publishing interface for domain events
 */
class EventPublisher {
  /**
   * Publish domain event
   * @param {DomainEvent} event - Domain event to publish
   * @returns {Promise<void>}
   */
  async publish(event) {
    throw new Error('Method must be implemented by concrete event publisher');
  }

  /**
   * Publish multiple events
   * @param {DomainEvent[]} events - Array of domain events
   * @returns {Promise<void>}
   */
  async publishBatch(events) {
    throw new Error('Method must be implemented by concrete event publisher');
  }

  /**
   * Subscribe to events
   * @param {string} eventType - Event type to subscribe to
   * @param {Function} handler - Event handler function
   * @returns {Promise<void>}
   */
  async subscribe(eventType, handler) {
    throw new Error('Method must be implemented by concrete event publisher');
  }

  /**
   * Unsubscribe from events
   * @param {string} eventType - Event type to unsubscribe from
   * @param {Function} handler - Event handler function
   * @returns {Promise<void>}
   */
  async unsubscribe(eventType, handler) {
    throw new Error('Method must be implemented by concrete event publisher');
  }
}

module.exports = EventPublisher;