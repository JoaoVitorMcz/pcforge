import { Request, Response } from "express";
import Categoria from "../models/Categoria";
import {
  atualizarCategoria,
  criarCategoria,
  deletarCategoria,
} from "../controllers/categoria.controller";
import { invalidarCachePorPrefixo } from "../utils/cache";

jest.mock("../models/Categoria", () => ({
  __esModule: true,
  default: { create: jest.fn(), findByPk: jest.fn() },
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

describe("invalidação do cache de categorias", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("invalida categorias após criar", async () => {
    (Categoria.create as jest.Mock).mockResolvedValue({ id_categoria: 1 });

    await criarCategoria(
      criarRequisicao({ nome: "Placas" }) as Request,
      criarResposta() as Response
    );

    expect(invalidarCachePorPrefixo).toHaveBeenCalledWith("categorias:");
  });

  it("invalida categorias após atualizar ou excluir", async () => {
    const categoria = {
      update: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    (Categoria.findByPk as jest.Mock).mockResolvedValue(categoria);

    await atualizarCategoria(
      criarRequisicao({ nome: "Nova categoria" }, { id: "1" }) as Request,
      criarResposta() as Response
    );
    expect(invalidarCachePorPrefixo).toHaveBeenCalledWith("categorias:");

    jest.clearAllMocks();
    (Categoria.findByPk as jest.Mock).mockResolvedValue(categoria);
    await deletarCategoria(
      criarRequisicao({}, { id: "1" }) as Request,
      criarResposta() as Response
    );
    expect(invalidarCachePorPrefixo).toHaveBeenCalledWith("categorias:");
  });
});
