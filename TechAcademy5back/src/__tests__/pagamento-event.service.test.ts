jest.mock("../config/redis", () => ({
  __esModule: true,
  default: {
    isReady: true,
    publish: jest.fn(),
  },
}));

import redisClient from "../config/redis";
import { publicarPagamentoAprovado } from "../services/pagamento-event.service";

describe("publicação do evento de pagamento aprovado", () => {
  const event = {
    pedidoId: 42,
    paymentId: 9001,
    aprovadoEm: "2026-10-23T20:00:00.000Z",
  };
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(redisClient, "isReady", {
      configurable: true,
      value: true,
    });
    (redisClient.publish as jest.Mock).mockResolvedValue(1);
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    Reflect.deleteProperty(redisClient, "isReady");
  });

  it("publica o payload no canal versionado", async () => {
    await publicarPagamentoAprovado(event);

    expect(redisClient.publish).toHaveBeenCalledWith(
      "pagamento.aprovado.v1",
      JSON.stringify(event)
    );
  });

  it("devolve indisponibilidade quando não há consumidor inscrito", async () => {
    (redisClient.publish as jest.Mock).mockResolvedValue(0);

    await expect(publicarPagamentoAprovado(event)).rejects.toMatchObject({
      statusCode: 503,
      codigo: "EVENTO_SEM_CONSUMIDOR",
    });
  });

  it("não tenta publicar quando o Redis não está pronto", async () => {
    Object.defineProperty(redisClient, "isReady", {
      configurable: true,
      value: false,
    });

    await expect(publicarPagamentoAprovado(event)).rejects.toMatchObject({
      statusCode: 503,
      codigo: "EVENTO_INDISPONIVEL",
    });
    expect(redisClient.publish).not.toHaveBeenCalled();
  });
});
