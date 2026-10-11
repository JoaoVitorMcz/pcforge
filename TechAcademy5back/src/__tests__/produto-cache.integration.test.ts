import express from "express";
import request from "supertest";
import redisClient from "../config/redis";
import Produto from "../models/Produto";
import * as ProdutoController from "../controllers/produto.controller";
import errorMiddleware from "../middleware/error.middleware";

const mockCache = new Map<string, string>();

jest.mock("../config/redis", () => ({
  __esModule: true,
  default: {
    isReady: true,
    get: jest.fn((chave: string) => Promise.resolve(mockCache.get(chave) ?? null)),
    set: jest.fn((chave: string, valor: string) => {
      mockCache.set(chave, valor);
      return Promise.resolve("OK");
    }),
    scanIterator: jest.fn(),
    del: jest.fn((chave: string) => Promise.resolve(Number(mockCache.delete(chave)))),
  },
}));
jest.mock("../models/Produto");

const redisMock = redisClient as unknown as {
  isReady: boolean;
  scanIterator: jest.Mock;
};

describe("cache de produtos via endpoints", () => {
  let produto: { id_produto: number; nome: string; ativo: boolean };
  let atualizarProduto: jest.Mock;
  let aplicacao: express.Express;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.clear();
    redisMock.isReady = true;
    produto = { id_produto: 1, nome: "GPU", ativo: true };
    atualizarProduto = jest.fn(async (dados: Partial<typeof produto>) => {
      Object.assign(produto, dados);
    });

    (Produto.findAndCountAll as jest.Mock).mockImplementation(async () => ({
      rows: [{ ...produto }],
      count: 1,
    }));
    (Produto.findOne as jest.Mock).mockResolvedValue({
      update: atualizarProduto,
    });
    redisMock.scanIterator.mockImplementation(({ MATCH }: { MATCH: string }) =>
      (async function* () {
        const prefixo = MATCH.replace(/\*$/, "");
        for (const chave of mockCache.keys()) {
          if (chave.startsWith(prefixo)) yield [chave];
        }
      })()
    );

    aplicacao = express();
    aplicacao.use(express.json());
    aplicacao.get("/produtos", ProdutoController.listarProdutos);
    aplicacao.get("/produtos/destaque", ProdutoController.listarProdutosDestaque);
    aplicacao.get("/produtos/buscar", ProdutoController.buscarProdutosPorNome);
    aplicacao.put("/produtos/:id", ProdutoController.atualizarProduto);
    aplicacao.use(errorMiddleware);
  });

  it("faz miss, hit e recarrega após invalidar no update", async () => {
    const primeiraConsulta = await request(aplicacao).get("/produtos");
    const segundaConsulta = await request(aplicacao).get("/produtos");

    expect(primeiraConsulta.body).toEqual([{ id_produto: 1, nome: "GPU", ativo: true }]);
    expect(segundaConsulta.body).toEqual(primeiraConsulta.body);
    expect(Produto.findAndCountAll).toHaveBeenCalledTimes(1);

    await request(aplicacao).put("/produtos/1").send({ nome: "GPU atualizada" }).expect(200);
    const consultaAtualizada = await request(aplicacao).get("/produtos").expect(200);

    expect(atualizarProduto).toHaveBeenCalledWith({ nome: "GPU atualizada" });
    expect(consultaAtualizada.body[0].nome).toBe("GPU atualizada");
    expect(Produto.findAndCountAll).toHaveBeenCalledTimes(2);
  });

  it("usa chaves diferentes para lista e destaques", async () => {
    await request(aplicacao).get("/produtos").expect(200);
    await request(aplicacao).get("/produtos/destaque").expect(200);

    expect(Produto.findAndCountAll).toHaveBeenCalledTimes(2);
    expect([...mockCache.keys()]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("produtos:lista:"),
        expect.stringContaining("produtos:destaque:"),
      ])
    );
  });

  it("inclui o termo de busca na chave de cache", async () => {
    await request(aplicacao).get("/produtos/buscar?nome=GPU").expect(200);
    await request(aplicacao).get("/produtos/buscar?nome=CPU").expect(200);

    expect(Produto.findAndCountAll).toHaveBeenCalledTimes(2);
    expect([...mockCache.keys()]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("termo=GPU"),
        expect.stringContaining("termo=CPU"),
      ])
    );
  });
});
