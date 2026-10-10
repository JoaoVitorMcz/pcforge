import { Request, Response } from "express";
import Produto from "../models/Produto";
import { atualizarProduto, criarProduto, desativarProduto } from "../controllers/produto.controller";
import { invalidarCachePorPrefixo } from "../utils/cache";

jest.mock("../models/Produto", () => ({
  __esModule: true,
  default: { create: jest.fn(), findOne: jest.fn() },
}));
jest.mock("../utils/cache", () => ({
  cacheAside: jest.fn(),
  invalidarCachePorPrefixo: jest.fn().mockResolvedValue(undefined),
}));

const criarResposta = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const criarRequisicao = (body: object, params = {}): Partial<Request> => ({ body, params });

describe("invalidação de cache nas escritas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("invalida produtos depois de criar um produto", async () => {
    (Produto.create as jest.Mock).mockResolvedValue({ id_produto: 1 });
    const req = criarRequisicao({ nome: "GPU", valor: 100 });
    const res = criarResposta();

    await criarProduto(req as Request, res as Response);

    expect(invalidarCachePorPrefixo).toHaveBeenCalledWith("produtos:");
  });

  it("invalida produtos depois de atualizar ou desativar um produto", async () => {
    const produto = { update: jest.fn().mockResolvedValue(undefined) };
    (Produto.findOne as jest.Mock).mockResolvedValue(produto);

    await atualizarProduto(
      criarRequisicao({ nome: "GPU nova" }, { id: "1" }) as Request,
      criarResposta() as Response
    );
    expect(invalidarCachePorPrefixo).toHaveBeenCalledWith("produtos:");

    jest.clearAllMocks();
    (Produto.findOne as jest.Mock).mockResolvedValue(produto);
    await desativarProduto(
      criarRequisicao({}, { id: "1" }) as Request,
      criarResposta() as Response
    );
    expect(invalidarCachePorPrefixo).toHaveBeenCalledWith("produtos:");
  });
});
