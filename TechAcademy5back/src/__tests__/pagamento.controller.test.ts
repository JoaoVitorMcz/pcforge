import { Request, Response } from "express";

jest.mock("../models/Pedido", () => ({
  __esModule: true,
  default: {},
}));

jest.mock("../services/pedido.service", () => ({
  __esModule: true,
  HttpError: class MockHttpError extends Error {
    statusCode: number;

    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  carregarPedidoDetalhadoDoCliente: jest.fn(),
  criarPedidoComItens: jest.fn(),
}));

jest.mock("../services/mercadoPago.service", () => ({
  __esModule: true,
  buscarPagamentoMercadoPago: jest.fn(),
  criarPreferenciaMercadoPago: jest.fn(),
}));

jest.mock("../services/pagamento-event.service", () => ({
  __esModule: true,
  publicarPagamentoAprovado: jest.fn(),
}));

import { confirmarPagamentoMercadoPago } from "../controllers/pagamento.controller";
import { carregarPedidoDetalhadoDoCliente } from "../services/pedido.service";
import { buscarPagamentoMercadoPago } from "../services/mercadoPago.service";
import { publicarPagamentoAprovado } from "../services/pagamento-event.service";

const mockResponse = (): Partial<Response> => {
  const response: Partial<Response> = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

describe("confirmação de pagamento Mercado Pago", () => {
  const pedido = {
    id_pedido: 42,
    status: "pendente",
    update: jest.fn(),
  };
  const cliente = { id_cliente: 7, admin: false, email: "cliente@example.com" };
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    (carregarPedidoDetalhadoDoCliente as jest.Mock).mockResolvedValue(pedido);
    (buscarPagamentoMercadoPago as jest.Mock).mockResolvedValue({
      status: "approved",
      external_reference: "42",
    });
    (publicarPagamentoAprovado as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("publica evento versionado e responde enquanto o consumidor atualiza o pedido", async () => {
    const request = {
      body: { pedido_id: 42, payment_id: 9001 },
      params: {},
      cliente,
    } as unknown as Request;
    const response = mockResponse();

    await confirmarPagamentoMercadoPago(request, response as Response);

    expect(publicarPagamentoAprovado).toHaveBeenCalledWith(
      expect.objectContaining({
        pedidoId: 42,
        paymentId: 9001,
        aprovadoEm: expect.any(String),
      })
    );
    expect(pedido.update).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(202);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentStatus: "approved",
        sincronizacao: "processando",
        pedido,
      })
    );
  });

  it("não publica novo evento para um pedido já pago", async () => {
    (carregarPedidoDetalhadoDoCliente as jest.Mock).mockResolvedValue({
      ...pedido,
      status: "pago",
    });
    const request = {
      body: { pedido_id: 42, payment_id: 9001 },
      params: {},
      cliente,
    } as unknown as Request;
    const response = mockResponse();

    await confirmarPagamentoMercadoPago(request, response as Response);

    expect(publicarPagamentoAprovado).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
  });
});
