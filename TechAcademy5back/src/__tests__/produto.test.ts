import { Request, Response } from "express";
import Produto from "../models/Produto";
import {
  atualizarProduto,
  buscarProdutoPorId,
  buscarProdutosPorNome,
  criarProduto,
  desativarProduto,
  listarProdutos,
} from "../controllers/produto.controller";

jest.mock("../models/Produto");

let consoleErrorSpy: jest.SpyInstance;

const mockRequest = (body = {}, params = {}, query = {}): Partial<Request> => ({
  body,
  params,
  query,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe("listarProdutos", () => {
  it("1. Retorna lista de produtos ativos com status 200", async () => {
    (Produto.findAndCountAll as jest.Mock).mockResolvedValue({
      rows: [{ id_produto: 1, nome: "RTX 4070", ativo: true }],
      count: 1,
    });

    const req = mockRequest();
    const res = mockResponse();

    await listarProdutos(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ id_produto: 1, nome: "RTX 4070", ativo: true }]);
  });

  it("2. Retorna 500 em caso de erro", async () => {
    (Produto.findAndCountAll as jest.Mock).mockRejectedValue(new Error("Erro no banco"));

    const req = mockRequest();
    const res = mockResponse();

    await expect(listarProdutos(req as Request, res as Response)).rejects.toThrow("Erro no banco");
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("buscarProdutoPorId", () => {
  it("3. Retorna produto com status 200", async () => {
    (Produto.findOne as jest.Mock).mockResolvedValue({
      id_produto: 1,
      nome: "RTX 4070",
      ativo: true,
    });

    const req = mockRequest({}, { id: "1" });
    const res = mockResponse();

    await buscarProdutoPorId(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("4. Retorna 404 se produto nao encontrado", async () => {
    (Produto.findOne as jest.Mock).mockResolvedValue(null);

    const req = mockRequest({}, { id: "999" });
    const res = mockResponse();

    await expect(buscarProdutoPorId(req as Request, res as Response)).rejects.toMatchObject({
      statusCode: 404,
      codigo: "NAO_ENCONTRADO",
    });
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("criarProduto", () => {
  it("5. Cria produto com sucesso e retorna 201", async () => {
    (Produto.create as jest.Mock).mockResolvedValue({
      id_produto: 1,
      nome: "RTX 4070",
      valor: 3899,
    });

    const req = mockRequest({ nome: "RTX 4070", valor: 3899 });
    const res = mockResponse();

    await criarProduto(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("6. Retorna 400 se faltar nome ou valor", async () => {
    const req = mockRequest({ nome: "RTX 4070" });
    const res = mockResponse();

    await expect(criarProduto(req as Request, res as Response)).rejects.toMatchObject({
      statusCode: 400,
      codigo: "REQUISICAO_INVALIDA",
    });
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("atualizarProduto", () => {
  it("7. Atualiza produto com sucesso e retorna 200", async () => {
    const produtoMock = {
      id_produto: 1,
      update: jest.fn().mockResolvedValue(true),
    };

    (Produto.findOne as jest.Mock).mockResolvedValue(produtoMock);

    const req = mockRequest({ nome: "RTX 4070 Super" }, { id: "1" });
    const res = mockResponse();

    await atualizarProduto(req as Request, res as Response);

    expect(produtoMock.update).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("desativarProduto", () => {
  it("8. Desativa produto e retorna 200", async () => {
    const produtoMock = {
      update: jest.fn().mockResolvedValue(true),
    };

    (Produto.findOne as jest.Mock).mockResolvedValue(produtoMock);

    const req = mockRequest({}, { id: "1" });
    const res = mockResponse();

    await desativarProduto(req as Request, res as Response);

    expect(produtoMock.update).toHaveBeenCalledWith({ ativo: false });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("buscarProdutosPorNome", () => {
  it("9. Retorna produtos encontrados com status 200", async () => {
    (Produto.findAndCountAll as jest.Mock).mockResolvedValue({
      rows: [{ id_produto: 1, nome: "RTX 4070" }],
      count: 1,
    });

    const req = mockRequest({}, {}, { nome: "RTX" });
    const res = mockResponse();

    await buscarProdutosPorNome(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ id_produto: 1, nome: "RTX 4070" }]);
  });
});
