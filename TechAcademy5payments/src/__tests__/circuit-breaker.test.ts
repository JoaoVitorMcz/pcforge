import AppError from "../errors/app-error";
import CircuitBreaker from "../services/circuit-breaker";

describe("circuit breaker", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("abre após falhas transitórias consecutivas e fecha após uma chamada half-open bem-sucedida", async () => {
    jest.useFakeTimers();
    const logAbertura = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const logFechamento = jest
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 30_000,
    });
    const failure = new Error("temporariamente indisponível");
    const isTransient = (error: unknown) => error === failure;
    const operation = jest.fn().mockRejectedValue(failure);

    await expect(breaker.execute(operation, isTransient)).rejects.toBe(failure);
    await expect(breaker.execute(operation, isTransient)).rejects.toBe(failure);
    await expect(breaker.execute(operation, isTransient)).rejects.toMatchObject({
      statusCode: 503,
      code: "CIRCUIT_BREAKER_ABERTO",
    });
    expect(operation).toHaveBeenCalledTimes(2);
    expect(logAbertura).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(30_000);
    const probe = jest.fn().mockResolvedValue("recuperado");
    await expect(breaker.execute(probe, isTransient)).resolves.toBe("recuperado");
    expect(logFechamento).toHaveBeenCalledTimes(1);
    await expect(breaker.execute(probe, isTransient)).resolves.toBe("recuperado");
  });

  it("reabre após falha transitória no half-open", async () => {
    jest.useFakeTimers();
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 30_000,
    });
    const failure = new Error("temporariamente indisponível");
    const isTransient = (error: unknown) => error === failure;

    await expect(
      breaker.execute(() => Promise.reject(failure), isTransient)
    ).rejects.toBe(failure);
    await jest.advanceTimersByTimeAsync(30_000);
    await expect(
      breaker.execute(() => Promise.reject(failure), isTransient)
    ).rejects.toBe(failure);
    await expect(
      breaker.execute(jest.fn().mockResolvedValue(undefined), isTransient)
    ).rejects.toMatchObject({ code: "CIRCUIT_BREAKER_ABERTO" });
  });

  it("permite apenas uma chamada de teste concorrente no half-open", async () => {
    jest.useFakeTimers();
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 30_000,
    });
    const failure = new Error("temporariamente indisponível");
    const isTransient = (error: unknown) => error === failure;

    await expect(
      breaker.execute(() => Promise.reject(failure), isTransient)
    ).rejects.toBe(failure);
    await jest.advanceTimersByTimeAsync(30_000);

    let liberarTeste!: (value: string) => void;
    const chamadaTeste = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          liberarTeste = resolve;
        })
    );
    const testeEmAndamento = breaker.execute(chamadaTeste, isTransient);
    await expect(
      breaker.execute(jest.fn().mockResolvedValue("segunda chamada"), isTransient)
    ).rejects.toMatchObject({ code: "CIRCUIT_BREAKER_ABERTO" });

    liberarTeste("recuperado");
    await expect(testeEmAndamento).resolves.toBe("recuperado");
    expect(chamadaTeste).toHaveBeenCalledTimes(1);
  });

  it("fecha o circuito quando o half-open recebe uma resposta não transitória", async () => {
    jest.useFakeTimers();
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 30_000,
    });
    const transientError = new Error("indisponível");

    await expect(
      breaker.execute(
        () => Promise.reject(transientError),
        (error) => error === transientError
      )
    ).rejects.toBe(transientError);
    await jest.advanceTimersByTimeAsync(30_000);

    const clientError = new AppError(400, "requisição inválida", "REQUISICAO_INVALIDA");
    await expect(
      breaker.execute(
        () => Promise.reject(clientError),
        (error) => error === transientError
      )
    ).rejects.toBe(clientError);

    await expect(
      breaker.execute(jest.fn().mockResolvedValue("fechado"), () => false)
    ).resolves.toBe("fechado");
  });
});
