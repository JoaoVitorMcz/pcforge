import { Request, Response } from "express";

jest.mock("../models/Endereco", () => ({
  __esModule: true,
  default: {
    findAndCountAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  },
}));
jest.mock("../models/Cliente", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn(),
  },
}));

import Endereco from "../models/Endereco";
import Cliente from "../models/Cliente";
import {
  atualizarEndereco,
  buscarEnderecoPorId,
  criarEndereco,
  deletarEndereco,
  listarEnderecos,
  listarEnderecosPorCliente,
} from "../controllers/endereco.controller";

const mockRequest = (
  body = {},
  params = {},
  query = {},
  cliente: Request["cliente"] | undefined = undefined
): Partial<Request> => ({ body, params, query, cliente });

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("endereco.controller", () => {
  it("1. lista enderecos com paginacao", async () => {
    (Endereco.findAndCountAll as jest.Mock).mockResolvedValue({
      rows: [{ id_endereco: 1, cidade: "Sao Paulo" }],
      count: 1,
    });
    const req = mockRequest({}, {}, { page: "1", limit: "10" });
    const res = mockResponse();

    await listarEnderecos(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("2. lista enderecos por cliente com paginacao", async () => {
    (Endereco.findAndCountAll as jest.Mock).mockResolvedValue({
      rows: [{ id_endereco: 1, id_cliente: 1 }],
      count: 1,
    });
    const req = mockRequest({}, { id_cliente: "1" }, { page: "1", limit: "10" });
    const res = mockResponse();

    await listarEnderecosPorCliente(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("3. busca endereco por id quando pertence ao cliente logado", async () => {
    (Endereco.findByPk as jest.Mock).mockResolvedValue({ id_endereco: 1, id_cliente: 1 });
    const req = mockRequest({}, { id: "1" }, {}, { id_cliente: 1, admin: false, email: "teste@teste.com" });
    const res = mockResponse();

    await buscarEnderecoPorId(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("4. bloqueia busca de endereco de outro cliente para usuario comum", async () => {
    (Endereco.findByPk as jest.Mock).mockResolvedValue({ id_endereco: 1, id_cliente: 2 });
    const req = mockRequest({}, { id: "1" }, {}, { id_cliente: 1, admin: false, email: "teste@teste.com" });
    const res = mockResponse();

    await expect(buscarEnderecoPorId(req as Request, res as Response)).rejects.toMatchObject({
      statusCode: 403,
      codigo: "ACESSO_NEGADO",
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it("5. cria endereco com sucesso para o proprio cliente", async () => {
    (Cliente.findByPk as jest.Mock).mockResolvedValue({ id_cliente: 1 });
    (Endereco.create as jest.Mock).mockResolvedValue({ id_endereco: 1 });
    const req = mockRequest(
      { cidade: "Sao Paulo" },
      {},
      {},
      { id_cliente: 1, admin: false, email: "teste@teste.com" }
    );
    const res = mockResponse();

    await criarEndereco(req as Request, res as Response);

    expect(Endereco.create).toHaveBeenCalledWith(
      expect.objectContaining({ id_cliente: 1 })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("6. atualiza endereco existente do proprio cliente", async () => {
    const enderecoMock = { id_cliente: 1, update: jest.fn().mockResolvedValue(true) };
    (Endereco.findByPk as jest.Mock).mockResolvedValue(enderecoMock);
    const req = mockRequest(
      { cidade: "Campinas" },
      { id: "1" },
      {},
      { id_cliente: 1, admin: false, email: "teste@teste.com" }
    );
    const res = mockResponse();

    await atualizarEndereco(req as Request, res as Response);

    expect(enderecoMock.update).toHaveBeenCalled();
  });

  it("7. deleta endereco existente do proprio cliente", async () => {
    const enderecoMock = { id_cliente: 1, destroy: jest.fn().mockResolvedValue(true) };
    (Endereco.findByPk as jest.Mock).mockResolvedValue(enderecoMock);
    const req = mockRequest({}, { id: "1" }, {}, { id_cliente: 1, admin: false, email: "teste@teste.com" });
    const res = mockResponse();

    await deletarEndereco(req as Request, res as Response);

    expect(enderecoMock.destroy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
