jest.mock("../config/redis", () => ({
  __esModule: true,
  default: {
    isReady: true,
    publish: jest.fn(),
  },
}));

import redisClient from "../config/redis";
import AppError from "../utils/app-error";
import {
  PEDIDO_CRIADO_EVENT,
  PEDIDO_STATUS_ALTERADO_EVENT,
  PedidoCriadoEvent,
  PedidoStatusAlteradoEvent,
} from "../events/pedido.event";
import {
  publicarPedidoCriado,
  publicarPedidoStatusAlterado,
} from "../services/pedido-event.service";
import { runWithRequestId } from "../utils/request-context";

const REQUEST_ID = "7e3f63b2-49e1-4f13-8c5c-d72014b7a3a1";

describe("publicação de eventos de pedido", () => {
  const pedidoCriado: PedidoCriadoEvent = {
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
  const statusAlterado: PedidoStatusAlteradoEvent = {
    pedido_id: 42,
    status_anterior: "pendente",
    status_atual: "pago",
    alterado_em: "2026-10-23T20:00:00.000Z",
  };
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(redisClient, "isReady", {
      configurable: true,
      value: true,
    });
    (redisClient.publish as jest.Mock).mockResolvedValue(1);
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    Reflect.deleteProperty(redisClient, "isReady");
  });

  it("publica pedido.criado.v1 com os dados necessários ao serviço consumidor", async () => {
    await publicarPedidoCriado(pedidoCriado);

    expect(redisClient.publish).toHaveBeenCalledWith(
      PEDIDO_CRIADO_EVENT,
      JSON.stringify(pedidoCriado)
    );
  });

  it("publica pedido.status-alterado.v1 com os estados anterior e atual", async () => {
    await publicarPedidoStatusAlterado(statusAlterado);

    expect(redisClient.publish).toHaveBeenCalledWith(
      PEDIDO_STATUS_ALTERADO_EVENT,
      JSON.stringify(statusAlterado)
    );
  });

  it("retorna erro explícito quando não há consumidores inscritos", async () => {
    (redisClient.publish as jest.Mock).mockResolvedValue(0);

    await expect(publicarPedidoCriado(pedidoCriado)).rejects.toMatchObject({
      statusCode: 503,
      codigo: "EVENTO_SEM_CONSUMIDOR",
      message: expect.stringContaining("Pedido 42 foi persistido"),
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("não tenta publicar quando o Redis não está pronto", async () => {
    Object.defineProperty(redisClient, "isReady", {
      configurable: true,
      value: false,
    });

    await expect(publicarPedidoStatusAlterado(statusAlterado)).rejects.toMatchObject({
      statusCode: 503,
      codigo: "EVENTO_INDISPONIVEL",
      message: expect.stringContaining("Pedido 42 foi persistido"),
    });
    expect(redisClient.publish).not.toHaveBeenCalled();
  });

  it("registra o identificador ao converter uma falha do Redis em erro explícito", async () => {
    const redisError = new Error("redis unavailable");
    (redisClient.publish as jest.Mock).mockRejectedValue(redisError);

    await runWithRequestId(REQUEST_ID, async () => {
      await expect(publicarPedidoStatusAlterado(statusAlterado)).rejects.toMatchObject({
        statusCode: 503,
        codigo: "EVENTO_INDISPONIVEL",
        message: expect.stringContaining("Pedido 42 foi persistido"),
      });
    });

    const registro = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
    expect(registro).toMatchObject({
      level: "error",
      message: "Falha ao publicar evento de pedido",
      requestId: REQUEST_ID,
      eventName: PEDIDO_STATUS_ALTERADO_EVENT,
      orderId: 42,
      error: { name: "Error" },
    });
    expect(JSON.stringify(registro)).not.toContain(redisError.message);
  });

  it("usa AppError para expor a falha ao middleware HTTP", async () => {
    (redisClient.publish as jest.Mock).mockResolvedValue(0);

    await expect(publicarPedidoStatusAlterado(statusAlterado)).rejects.toBeInstanceOf(AppError);
  });
});
