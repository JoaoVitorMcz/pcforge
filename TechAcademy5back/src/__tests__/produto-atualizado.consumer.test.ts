jest.mock("../utils/cache", () => ({
  invalidarCachePorPrefixo: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../utils/logger", () => ({
  logError: jest.fn(),
}));

import { processarProdutoAtualizado } from "../events/produto-atualizado.consumer";
import { invalidarCachePorPrefixo } from "../utils/cache";
import { logError } from "../utils/logger";

describe("consumidor produto.atualizado.v1", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("invalida as chaves do cache de produtos para evento válido", async () => {
    await processarProdutoAtualizado(
      JSON.stringify({
        produto_id: 42,
        atualizado_em: "2026-10-23T20:00:00.000Z",
      })
    );

    expect(invalidarCachePorPrefixo).toHaveBeenCalledWith("produtos:");
    expect(logError).not.toHaveBeenCalled();
  });

  it.each([
    "{invalido",
    JSON.stringify({ produto_id: 0, atualizado_em: "2026-10-23T20:00:00.000Z" }),
    JSON.stringify({ produto_id: 42, atualizado_em: "data-inválida" }),
  ])("ignora evento inválido (%s) sem invalidar cache", async (message) => {
    await processarProdutoAtualizado(message);

    expect(invalidarCachePorPrefixo).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(
      "Evento produto.atualizado.v1 ignorado: payload inválido",
      { eventName: "produto.atualizado.v1" }
    );
  });

  it("propaga falha de invalidação para o subscriber registrar", async () => {
    const cacheError = new Error("Redis indisponível");
    (invalidarCachePorPrefixo as jest.Mock).mockRejectedValue(cacheError);

    await expect(
      processarProdutoAtualizado(
        JSON.stringify({
          produto_id: 42,
          atualizado_em: "2026-10-23T20:00:00.000Z",
        })
      )
    ).rejects.toBe(cacheError);
  });
});
