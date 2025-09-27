const EventPublisherPort = require('../../../core/domain/user/ports/EventPublisherPort');

/**
 * In-Memory Event Adapter
 * Implements EventPublisherPort using in-memory event handling
 * For production, replace with Redis Pub/Sub or message queue
 */
class InMemoryEventAdapter extends EventPublisherPort {
  constructor() {
    super();
    this.subscribers = new Map();
    this.eventHistory = [];
    this.maxHistorySize = 1000;
  }

  async publish(event) {
    try {
      // Add metadata
      const enrichedEvent = {
        ...event,
        id: this._generateEventId(),
        timestamp: new Date().toISOString(),
        version: '1.0'
      };

      // Store in history
      this._addToHistory(enrichedEvent);

      // Notify subscribers
      const eventType = event.type;
      const handlers = this.subscribers.get(eventType) || [];
      const allHandlers = this.subscribers.get('*') || [];

      const allEventHandlers = [...handlers, ...allHandlers];

      // Execute handlers asynchronously
      const promises = allEventHandlers.map(handler => 
        this._executeHandler(handler, enrichedEvent)
      );

      await Promise.allSettled(promises);

      console.log(`Event published: ${eventType}`, {
        eventId: enrichedEvent.id,
        handlerCount: allEventHandlers.length
      });

    } catch (error) {
      console.error('Failed to publish event:', error);
      throw error;
    }
  }

  async publishBatch(events) {
    const promises = events.map(event => this.publish(event));
    await Promise.allSettled(promises);
  }

  async subscribe(eventType, handler) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }

    this.subscribers.get(eventType).push(handler);

    console.log(`Subscribed to event: ${eventType}`, {
      handlerCount: this.subscribers.get(eventType).length
    });
  }

  async unsubscribe(eventType, handler) {
    const handlers = this.subscribers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // Additional methods for debugging and monitoring
  getSubscribers() {
    const result = {};
    for (const [eventType, handlers] of this.subscribers.entries()) {
      result[eventType] = handlers.length;
    }
    return result;
  }

  getEventHistory(limit = 50) {
    return this.eventHistory.slice(-limit);
  }

  clearHistory() {
    this.eventHistory = [];
  }

  // Private helper methods
  _generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _addToHistory(event) {
    this.eventHistory.push(event);
    
    // Trim history if too large
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  async _executeHandler(handler, event) {
    try {
      await handler(event);
    } catch (error) {
      console.error(`Event handler failed for ${event.type}:`, error);
      // Don't throw - we want other handlers to continue
    }
  }
}

module.exports = InMemoryEventAdapter;