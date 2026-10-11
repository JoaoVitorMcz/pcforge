import { Request, Response } from "express";

jest.mock("../models/Pedido", () => ({
  __esModule: true,
  default: {
    findAndCountAll: jest.fn(),
    findByPk: jest.fn(),
  },
}));
jest.mock("../models/Itempedido", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(),
  },
}));
jest.mock("../models/Produto", () => ({
  __esModule: true,
  default: {
    increment: jest.fn(),
  },
}));
jest.mock("../config/database", () => ({
  __esModule: true,
  default: {
    transaction: jest.fn(),
  },
}));
jest.mock("../models/Cliente", () => ({
  __esModule: true,
  default: {},
}));
jest.mock("../models/Endereco", () => ({
  __esModule: true,
  default: {},
}));
jest.mock("../services/pedido.service", () => {
  class MockHttpError extends Error {
    statusCode: number;

    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  }

  return {
    __esModule: true,
    HttpError: MockHttpError,
    criarPedidoComItens: jest.fn(),
  };
});

import Pedido from "../models/Pedido";
import ItemPedido from "../models/Itempedido";
import Produto from "../models/Produto";
import sequelize from "../config/database";
import {
  atualizarStatusPedido,
  buscarPedidoPorId,
  cancelarPedido,
  criarPedido,
  listarPedidos,
} from "../controllers/pedido.controller";
import { criarPedidoComItens, HttpError } from "../services/pedido.service";

let consoleErrorSpy: jest.SpyInstance;

const mockRequest = (
  body = {},
  params = {},
  query = {},
  cliente: Request["cliente"] | undefined = undefined
): Partial<Request> => ({
  body,
  params,
  query,
  cliente,
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

describe("pedido.controller", () => {
  it("1. retorna lista paginada de pedidos com status 200", async () => {
    (Pedido.findAndCountAll as jest.Mock).mockResolvedValue({
      rows: [{ id_pedido: 1, status: "pendente" }],
      count: 1,
    });

    const req = mockRequest({}, {}, { page: "1", limit: "10" });
    const res = mockResponse();

    await listarPedidos(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      dados: [{ id_pedido: 1, status: "pendente" }],
      paginacao: {
        paginaAtual: 1,
        porPagina: 10,
        totalItens: 1,
        totalPaginas: 1,
      },
    });
  });

  it("2. retorna pedido com status 200 para o dono", async () => {
    (Pedido.findByPk as jest.Mock).mockResolvedValue({
      id_pedido: 1,
      id_cliente: 1,
      status: "pendente",
    });

    const req = mockRequest({}, { id: "1" }, {}, { id_cliente: 1, admin: false, email: "teste@teste.com" });
    const res = mockResponse();

    await buscarPedidoPorId(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("3. bloqueia pedido de outro cliente para usuario comum", async () => {
    (Pedido.findByPk as jest.Mock).mockResolvedValue({
      id_pedido: 1,
      id_cliente: 2,
      status: "pendente",
    });

    const req = mockRequest({}, { id: "1" }, {}, { id_cliente: 1, admin: false, email: "teste@teste.com" });
    const res = mockResponse();

    await expect(buscarPedidoPorId(req as Request, res as Response)).rejects.toMatchObject({
      statusCode: 403,
      codigo: "ACESSO_NEGADO",
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it("4. retorna 400 se o service acusar dados invalidos", async () => {
    (criarPedidoComItens as jest.Mock).mockRejectedValue(
      new HttpError(400, "Informe pelo menos um item para criar o pedido.")
    );

    const req = mockRequest(
      { id_endereco_entrega: 1, itens: [] },
      {},
      {},
      { id_cliente: 1, admin: false, email: "teste@teste.com" }
    );
    const res = mockResponse();

    await expect(criarPedido(req as Request, res as Response)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it("5. cria pedido com sucesso e retorna 201", async () => {
    const pedidoMock = { id_pedido: 1, status: "pendente" };
    (criarPedidoComItens as jest.Mock).mockResolvedValue(pedidoMock);

    const req = mockRequest(
      {
        id_endereco_entrega: 1,
        metodo: "mercado_pago",
        itens: [{ id_produto: 1, quantidade: 2 }],
      },
      {},
      {},
      { id_cliente: 1, admin: false, email: "teste@teste.com" }
    );
    const res = mockResponse();

    await criarPedido(req as Request, res as Response);

    expect(criarPedidoComItens).toHaveBeenCalledWith(
      {
        id_cliente: 1,
        id_endereco_entrega: 1,
        metodo: "mercado_pago",
        itens: [{ id_produto: 1, quantidade: 2 }],
      },
      false
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("6. atualiza status com sucesso para admin", async () => {
    const pedidoMock = {
      id_pedido: 1,
      status: "pendente",
      data_pagamento: null,
      update: jest.fn().mockResolvedValue(true),
    };

    (Pedido.findByPk as jest.Mock).mockResolvedValue(pedidoMock);

    const req = mockRequest(
      { status: "pago" },
      { id: "1" },
      {},
      { id_cliente: 99, admin: true, email: "admin@teste.com" }
    );
    const res = mockResponse();

    await atualizarStatusPedido(req as Request, res as Response);

    expect(pedidoMock.update).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // A restricao a admin saiu do controller e vive na rota, em
  // authorizeRole(["admin"]) — coberta por auth-admin e rbac-authorize. O que
  // cabe aqui e a regra que o controller de fato decide: a transicao de status.
  it("7. recusa transicao de status invalida com 409", async () => {
    (Pedido.findByPk as jest.Mock).mockResolvedValue({
      id_pedido: 1,
      status: "entregue",
      update: jest.fn(),
    });

    const req = mockRequest(
      { status: "pendente" },
      { id: "1" },
      {},
      { id_cliente: 1, admin: true, email: "admin@teste.com" }
    );
    const res = mockResponse();

    await expect(atualizarStatusPedido(req as Request, res as Response)).rejects.toMatchObject({
      statusCode: 409,
      codigo: "CONFLITO",
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it("7b. aceita transicao de status valida", async () => {
    const pedidoMock = { id_pedido: 1, status: "pendente", update: jest.fn().mockResolvedValue(true) };
    (Pedido.findByPk as jest.Mock).mockResolvedValue(pedidoMock);

    const req = mockRequest(
      { status: "pago" },
      { id: "1" },
      {},
      { id_cliente: 1, admin: true, email: "admin@teste.com" }
    );
    const res = mockResponse();

    await atualizarStatusPedido(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(pedidoMock.update).toHaveBeenCalled();
  });

  it("8. cancela pedido pendente do proprio cliente e devolve o estoque", async () => {
    const pedidoMock = {
      id_cliente: 1,
      status: "pendente",
      update: jest.fn().mockResolvedValue(true),
    };
    const transactionMock = { commit: jest.fn(), rollback: jest.fn() };

    (Pedido.findByPk as jest.Mock).mockResolvedValue(pedidoMock);
    (sequelize.transaction as jest.Mock).mockResolvedValue(transactionMock);
    (ItemPedido.findAll as jest.Mock).mockResolvedValue([{ id_produto: 7, quantidade: 3 }]);

    const req = mockRequest({}, { id: "1" }, {}, { id_cliente: 1, admin: false, email: "teste@teste.com" });
    const res = mockResponse();

    await cancelarPedido(req as Request, res as Response);

    // O estoque volta e o status muda na mesma transacao: um sem o outro
    // deixaria produto preso num pedido que nao existe mais.
    expect(Produto.increment).toHaveBeenCalledWith(
      "estoque",
      expect.objectContaining({ by: 3, where: { id_produto: 7 } })
    );
    expect(pedidoMock.update).toHaveBeenCalledWith(
      { status: "cancelado" },
      expect.objectContaining({ transaction: transactionMock })
    );
    expect(transactionMock.commit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
