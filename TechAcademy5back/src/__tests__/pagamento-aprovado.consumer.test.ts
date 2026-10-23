jest.mock("../models/Pedido", () => ({
  __esModule: true,
  default: {
    update: jest.fn(),
  },
}));

import Pedido from "../models/Pedido";
import { processarPagamentoAprovado } from "../events/pagamento-aprovado.consumer";

describe("consumidor de pagamento aprovado", () => {
  const evento = {
    pedidoId: 42,
    paymentId: 9001,
    aprovadoEm: "2026-10-23T20:00:00.000Z",
  };

  let consoleInfoSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleInfoSpy = jest.spyOn(console, "info").mockImplementation(() => undefined);
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("marca pedido pendente como pago com a data do evento", async () => {
    (Pedido.update as jest.Mock).mockResolvedValue([1]);

    await processarPagamentoAprovado(JSON.stringify(evento));

    expect(Pedido.update).toHaveBeenCalledWith(
      {
        status: "pago",
        data_pagamento: new Date(evento.aprovadoEm),
      },
      {
        where: { id_pedido: evento.pedidoId, status: "pendente" },
      }
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      `Evento pagamento.aprovado.v1 consumido para pedido ${evento.pedidoId}.`
    );
  });

  it("ignora evento duplicado ou de pedido inexistente", async () => {
    (Pedido.update as jest.Mock).mockResolvedValue([0]);

    await processarPagamentoAprovado(JSON.stringify(evento));

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      `Evento pagamento.aprovado.v1 ignorado para pedido ${evento.pedidoId}: inexistente ou fora do status pendente.`
    );
  });

  it("ignora payload inválido sem consultar o banco", async () => {
    await processarPagamentoAprovado("{invalido");

    expect(Pedido.update).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Evento pagamento.aprovado.v1 ignorado: payload invalido."
    );
  });

  it("propaga falha de banco para o consumidor registrar", async () => {
    const databaseError = new Error("database unavailable");
    (Pedido.update as jest.Mock).mockRejectedValue(databaseError);

    await expect(
      processarPagamentoAprovado(JSON.stringify(evento))
    ).rejects.toBe(databaseError);
  });
});
