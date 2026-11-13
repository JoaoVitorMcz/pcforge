import AppError from "../errors/app-error";

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
}

export default class CircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;
  private halfOpenRequestInFlight = false;

  constructor(private readonly options: CircuitBreakerOptions) {}

  async execute<T>(
    operation: () => Promise<T>,
    isTransientFailure: (error: unknown) => boolean
  ): Promise<T> {
    const halfOpen = this.isOpen() && this.isResetTimeoutElapsed();

    if (this.isOpen() && !halfOpen) {
      throw this.openError();
    }

    if (halfOpen && this.halfOpenRequestInFlight) {
      throw this.openError();
    }

    if (halfOpen) {
      this.halfOpenRequestInFlight = true;
    }

    try {
      const result = await operation();
      this.reset();
      return result;
    } catch (error) {
      if (isTransientFailure(error)) {
        if (halfOpen || ++this.failures >= this.options.failureThreshold) {
          this.open();
        }
      } else {
        this.reset();
      }

      throw error;
    } finally {
      if (halfOpen) {
        this.halfOpenRequestInFlight = false;
      }
    }
  }

  private isOpen(): boolean {
    return this.openedAt !== null;
  }

  private isResetTimeoutElapsed(): boolean {
    return (
      this.openedAt !== null &&
      Date.now() - this.openedAt >= this.options.resetTimeoutMs
    );
  }

  private openError(): AppError {
    return new AppError(
      503,
      "Mercado Pago temporariamente indisponível; tente novamente.",
      "CIRCUIT_BREAKER_ABERTO"
    );
  }

  private open(): void {
    this.openedAt = Date.now();
    console.warn("Circuit breaker do Mercado Pago aberto.", {
      failureThreshold: this.options.failureThreshold,
      resetTimeoutMs: this.options.resetTimeoutMs,
    });
  }

  private reset(): void {
    if (this.isOpen()) {
      console.info("Circuit breaker do Mercado Pago fechado.");
    }

    this.failures = 0;
    this.openedAt = null;
    this.halfOpenRequestInFlight = false;
  }
}
