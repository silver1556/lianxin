/**
 * Base Domain Event
 * All domain events should extend this class
 */
class DomainEvent {
  constructor(eventType, aggregateId, eventData = {}, metadata = {}) {
    this.eventId = this._generateEventId();
    this.eventType = eventType;
    this.aggregateId = aggregateId;
    this.eventData = eventData;
    this.metadata = {
      ...metadata,
      occurredAt: new Date().toISOString(),
      version: '1.0'
    };
  }

  /**
   * Get event ID
   */
  getId() {
    return this.eventId;
  }

  /**
   * Get event type
   */
  getType() {
    return this.eventType;
  }

  /**
   * Get aggregate ID
   */
  getAggregateId() {
    return this.aggregateId;
  }

  /**
   * Get event data
   */
  getData() {
    return this.eventData;
  }

  /**
   * Get metadata
   */
  getMetadata() {
    return this.metadata;
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      aggregateId: this.aggregateId,
      eventData: this.eventData,
      metadata: this.metadata
    };
  }

  /**
   * Generate unique event ID
   */
  _generateEventId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `evt_${timestamp}_${random}`;
  }
}

module.exports = DomainEvent;