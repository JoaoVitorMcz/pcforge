jest.mock("../config/redis", () => ({
  __esModule: true,
  default: {
    isReady: true,
    publish: jest.fn(),
  },
}));
jest.mock("../utils/logger", () => ({
  logError: jest.fn(),
}));

import redisClient from "../config/redis";
import { publicarProdutoAtualizado } from "../services/produto-event.service";
import { PRODUTO_ATUALIZADO_EVENT } from "../events/produto.event";
import { logError } from "../utils/logger";

describe("publicação do evento de atualização de produto", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(redisClient, "isReady", {
      configurable: true,
      value: true,
    });
    (redisClient.publish as jest.Mock).mockResolvedValue(1);
  });

  afterEach(() => {
    Reflect.deleteProperty(redisClient, "isReady");
  });

  it("publica produto atualizado com ID e data ISO 8601", async () => {
    await publicarProdutoAtualizado(42);

    expect(redisClient.publish).toHaveBeenCalledTimes(1);
    const [eventName, serializedEvent] = (redisClient.publish as jest.Mock).mock
      .calls[0] as [string, string];
    expect(eventName).toBe(PRODUTO_ATUALIZADO_EVENT);
    expect(JSON.parse(serializedEvent)).toEqual({
      produto_id: 42,
      atualizado_em: expect.any(String),
    });
    expect(Number.isNaN(Date.parse(JSON.parse(serializedEvent).atualizado_em))).toBe(false);
  });

  it("retorna erro explícito quando não há consumidores", async () => {
    (redisClient.publish as jest.Mock).mockResolvedValue(0);

    await expect(publicarProdutoAtualizado(42)).rejects.toMatchObject({
      statusCode: 503,
      codigo: "EVENTO_SEM_CONSUMIDOR",
      message: expect.stringContaining("Produto 42 foi persistido"),
    });
    expect(logError).toHaveBeenCalledWith(
      "Evento de produto sem consumidores",
      expect.objectContaining({ productId: 42 })
    );
  });

  it("não publica quando Redis está indisponível", async () => {
    Object.defineProperty(redisClient, "isReady", {
      configurable: true,
      value: false,
    });

    await expect(publicarProdutoAtualizado(42)).rejects.toMatchObject({
      statusCode: 503,
      codigo: "EVENTO_INDISPONIVEL",
    });
    expect(redisClient.publish).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalled();
  });

  it("converte falha na publicação em erro explícito", async () => {
    (redisClient.publish as jest.Mock).mockRejectedValue(
      new Error("Redis indisponível")
    );

    await expect(publicarProdutoAtualizado(42)).rejects.toMatchObject({
      statusCode: 503,
      codigo: "EVENTO_INDISPONIVEL",
      message: expect.stringContaining("Produto 42 foi persistido"),
    });
    expect(logError).toHaveBeenCalledWith(
      "Falha ao publicar evento de produto",
      expect.objectContaining({ productId: 42 }),
      expect.any(Error)
    );
  });
});
