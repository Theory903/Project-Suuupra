import { logger } from '@/utils/logger';

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  successThreshold: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;
  private options: CircuitBreakerOptions;
  private name: string;

  constructor(name: string, options?: Partial<CircuitBreakerOptions>) {
    this.name = name;
    this.options = {
      failureThreshold: options?.failureThreshold || 5,
      resetTimeout: options?.resetTimeout || 30000, // 30 seconds
      successThreshold: options?.successThreshold || 2,
    };
    logger.info(`Circuit Breaker "${this.name}" initialized in ${this.state} state`, { options: this.options });
  }

  public async execute<T>(command: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() > this.lastFailureTime + this.options.resetTimeout) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        logger.warn(`Circuit Breaker "${this.name}" is OPEN, command blocked.`, { state: this.state });
        throw new Error(`Circuit breaker "${this.name}" is open.`);
      }
    }

    try {
      const result = await command();
      this.handleSuccess();
      return result;
    } catch (error) {
      this.handleFailure(error);
      throw error;
    }
  }

  private handleSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    } else {
      this.failures = 0;
      this.successCount = 0;
    }
  }

  private handleFailure(error: any): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    logger.error(`Circuit Breaker "${this.name}" detected failure. Failures: ${this.failures}`, { error: error.message });

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
    } else if (this.failures >= this.options.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  private transitionTo(newState: CircuitState): void {
    logger.info(`Circuit Breaker "${this.name}" transitioning from ${this.state} to ${newState}.`, {
      oldState: this.state,
      newState: newState,
    });
    this.state = newState;
    if (newState === CircuitState.CLOSED) {
      this.failures = 0;
      this.successCount = 0;
    } else if (newState === CircuitState.OPEN) {
      this.lastFailureTime = Date.now();
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successCount = 0;
    }
  }

  public getState(): CircuitState {
    return this.state;
  }
}