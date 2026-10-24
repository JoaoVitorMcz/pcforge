jest.mock("../config/database", () => ({
  salvarPedido: jest.fn(),
}));

import { salvarPedido } from "../config/database";
import { processarPedidoCriado } from "../events/pedido-criado.consumer";

describe("consumidor de pedido.criado.v1", () => {
  const evento = {
    pedido_id: 42,
    cliente: {
      id_cliente: 7,
      nome: "Cliente de teste",
      email: "cliente@example.com",
    },
    itens: [
      {
        id_produto: 11,
        nome: "Produto de teste",
        quantidade: 2,
        preco_unitario: 25,
      },
    ],
    valor: 50,
    criado_em: "2026-10-23T20:00:00.000Z",
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

  it("persiste a cópia local dos dados do pedido recebido", async () => {
    (salvarPedido as jest.Mock).mockResolvedValue(true);

    await processarPedidoCriado(JSON.stringify(evento));

    expect(salvarPedido).toHaveBeenCalledWith(evento);
  });

  it("não sobrescreve pedido já recebido", async () => {
    (salvarPedido as jest.Mock).mockResolvedValue(false);

    await processarPedidoCriado(JSON.stringify(evento));

    expect(salvarPedido).toHaveBeenCalledTimes(1);
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "Evento pedido.criado.v1 duplicado ignorado para pedido 42."
    );
  });

  it("ignora evento inválido sem gravar no banco", async () => {
    await processarPedidoCriado("{invalido");

    expect(salvarPedido).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Evento pedido.criado.v1 ignorado: payload invalido."
    );
  });

  it("propaga falha de persistência para o consumidor registrar", async () => {
    const error = new Error("database unavailable");
    (salvarPedido as jest.Mock).mockRejectedValue(error);

    await expect(processarPedidoCriado(JSON.stringify(evento))).rejects.toBe(error);
  });
});
