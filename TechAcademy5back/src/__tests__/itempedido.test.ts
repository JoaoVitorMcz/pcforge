import { Request, Response } from "express";

jest.mock("../models/Itempedido", () => ({
  __esModule: true,
  default: {
    findAndCountAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
  },
}));
jest.mock("../models/Pedido", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn(),
  },
}));
jest.mock("../models/Produto", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    decrement: jest.fn(),
    increment: jest.fn(),
  },
}));
jest.mock("../config/database", () => ({
  __esModule: true,
  default: {
    transaction: jest.fn().mockResolvedValue({
      commit: jest.fn(),
      rollback: jest.fn(),
    }),
  },
}));

import ItemPedido from "../models/Itempedido";
import Pedido from "../models/Pedido";
import Produto from "../models/Produto";
import sequelize from "../config/database";
import {
  adicionarItem,
  atualizarQuantidadeItem,
  buscarItemPorId,
  listarItensDoPedido,
  removerItem,
} from "../controllers/itempedido.controller";

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

describe("itempedido.controller", () => {
  it("1. lista itens do pedido com paginacao para o dono", async () => {
    (Pedido.findByPk as jest.Mock).mockResolvedValue({ id_pedido: 1, id_cliente: 1 });
    (ItemPedido.findAndCountAll as jest.Mock).mockResolvedValue({
      rows: [{ id_item: 1, quantidade: 2 }],
      count: 1,
    });
    const req = mockRequest(
      {},
      { id_pedido: "1" },
      { page: "1", limit: "10" },
      { id_cliente: 1, admin: false, email: "teste@teste.com" }
    );
    const res = mockResponse();

    await listarItensDoPedido(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("2. bloqueia listagem de itens de pedido de outro cliente", async () => {
    (Pedido.findByPk as jest.Mock).mockResolvedValue({ id_pedido: 1, id_cliente: 2 });
    const req = mockRequest(
      {},
      { id_pedido: "1" },
      {},
      { id_cliente: 1, admin: false, email: "teste@teste.com" }
    );
    const res = mockResponse();

    await expect(listarItensDoPedido(req as Request, res as Response)).rejects.toMatchObject({
      statusCode: 403,
      codigo: "ACESSO_NEGADO",
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it("3. busca item por id quando o pedido pertence ao cliente", async () => {
    (ItemPedido.findByPk as jest.Mock).mockResolvedValue({ id_item: 1, id_pedido: 1 });
    (Pedido.findByPk as jest.Mock).mockResolvedValue({ id_pedido: 1, id_cliente: 1 });
    const req = mockRequest({}, { id: "1" }, {}, { id_cliente: 1, admin: false, email: "teste@teste.com" });
    const res = mockResponse();

    await buscarItemPorId(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("4. adiciona item com sucesso", async () => {
    const transactionMock = { commit: jest.fn(), rollback: jest.fn() };
    (sequelize.transaction as jest.Mock).mockResolvedValue(transactionMock);
    (Pedido.findByPk as jest.Mock).mockResolvedValue({
      id_pedido: 1,
      id_cliente: 1,
      status: "pendente",
      update: jest.fn().mockResolvedValue(true),
    });
    (Produto.findOne as jest.Mock).mockResolvedValue({ id_produto: 1 });
    (Produto.findByPk as jest.Mock).mockResolvedValue({ id_produto: 1, nome: "RTX 4070", estoque: 10 });
    (ItemPedido.findOne as jest.Mock).mockResolvedValue(null);
    (ItemPedido.create as jest.Mock).mockResolvedValue({ id_item: 1, id_pedido: 1 });
    (ItemPedido.findAll as jest.Mock).mockResolvedValue([{ quantidade: 2, preco_unitario: 100 }]);

    const req = mockRequest(
      { id_produto: 1, quantidade: 2, preco_unitario: 100 },
      { id_pedido: "1" },
      {},
      { id_cliente: 1, admin: false, email: "teste@teste.com" }
    );
    const res = mockResponse();

    await adicionarItem(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(transactionMock.commit).toHaveBeenCalled();
    // O pedido ja baixou estoque na criacao, entao o item novo consome a
    // quantidade adicionada.
    expect(Produto.decrement).toHaveBeenCalledWith(
      "estoque",
      expect.objectContaining({ by: 2, where: { id_produto: 1 } })
    );
  });

  it("5. atualiza quantidade do item", async () => {
    const transactionMock = { commit: jest.fn(), rollback: jest.fn() };
    (sequelize.transaction as jest.Mock).mockResolvedValue(transactionMock);
    const itemMock = {
      id_pedido: 1,
      id_produto: 1,
      quantidade: 1,
      update: jest.fn().mockResolvedValue(true),
    };
    const pedidoMock = {
      id_cliente: 1,
      status: "pendente",
      update: jest.fn().mockResolvedValue(true),
    };
    (ItemPedido.findByPk as jest.Mock).mockResolvedValue(itemMock);
    (Pedido.findByPk as jest.Mock).mockResolvedValue(pedidoMock);
    (ItemPedido.findAll as jest.Mock).mockResolvedValue([{ quantidade: 3, preco_unitario: 100 }]);
    (Produto.findByPk as jest.Mock).mockResolvedValue({ id_produto: 1, nome: "RTX 4070", estoque: 10 });

    const req = mockRequest(
      { quantidade: 3 },
      { id: "1" },
      {},
      { id_cliente: 1, admin: false, email: "teste@teste.com" }
    );
    const res = mockResponse();

    await atualizarQuantidadeItem(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    // De 1 para 3: so a diferenca sai do estoque, nao a quantidade inteira.
    expect(Produto.decrement).toHaveBeenCalledWith(
      "estoque",
      expect.objectContaining({ by: 2, where: { id_produto: 1 } })
    );
  });

  it("6. remove item com sucesso", async () => {
    const transactionMock = { commit: jest.fn(), rollback: jest.fn() };
    (sequelize.transaction as jest.Mock).mockResolvedValue(transactionMock);
    const itemMock = {
      id_pedido: 1,
      id_produto: 1,
      quantidade: 2,
      destroy: jest.fn().mockResolvedValue(true),
    };
    const pedidoMock = {
      id_cliente: 1,
      status: "pendente",
      update: jest.fn().mockResolvedValue(true),
    };
    (ItemPedido.findByPk as jest.Mock).mockResolvedValue(itemMock);
    (Pedido.findByPk as jest.Mock).mockResolvedValue(pedidoMock);
    (ItemPedido.findAll as jest.Mock).mockResolvedValue([]);
    (Produto.findByPk as jest.Mock).mockResolvedValue({ id_produto: 1, nome: "RTX 4070", estoque: 8 });

    const req = mockRequest({}, { id: "1" }, {}, { id_cliente: 1, admin: false, email: "teste@teste.com" });
    const res = mockResponse();

    await removerItem(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    // Remover o item devolve ao estoque a quantidade que ele reservava.
    expect(Produto.increment).toHaveBeenCalledWith(
      "estoque",
      expect.objectContaining({ by: 2, where: { id_produto: 1 } })
    );
  });

  it("7. recusa aumento de quantidade sem estoque, com 409", async () => {
    const transactionMock = { commit: jest.fn(), rollback: jest.fn() };
    (sequelize.transaction as jest.Mock).mockResolvedValue(transactionMock);
    (ItemPedido.findByPk as jest.Mock).mockResolvedValue({
      id_pedido: 1,
      id_produto: 1,
      quantidade: 1,
      update: jest.fn(),
    });
    (Pedido.findByPk as jest.Mock).mockResolvedValue({
      id_cliente: 1,
      status: "pendente",
      update: jest.fn(),
    });
    (Produto.findByPk as jest.Mock).mockResolvedValue({
      id_produto: 1,
      nome: "RTX 4070",
      estoque: 1,
    });

    const req = mockRequest(
      { quantidade: 5 },
      { id: "1" },
      {},
      { id_cliente: 1, admin: false, email: "teste@teste.com" }
    );
    const res = mockResponse();

    await expect(atualizarQuantidadeItem(req as Request, res as Response)).rejects.toMatchObject({
      statusCode: 409,
      codigo: "CONFLITO",
    });

    // Precisaria de mais 4 e so ha 1: nada e gravado e a transacao volta atras.
    expect(res.status).not.toHaveBeenCalled();
    expect(transactionMock.rollback).toHaveBeenCalled();
    expect(transactionMock.commit).not.toHaveBeenCalled();
    expect(Produto.decrement).not.toHaveBeenCalled();
  });
});
