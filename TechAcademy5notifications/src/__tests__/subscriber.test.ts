import { redisSubscriberClient } from "../config/redis";
import { processarEvento } from "../events/event-consumer";
import { iniciarConsumidorEventos } from "../events/subscriber";
import { EVENTOS_NOTIFICACOES } from "../events/event-types";

jest.mock("../config/redis", () => ({
  redisSubscriberClient: {
    subscribe: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../events/event-consumer", () => ({
  processarEvento: jest.fn().mockResolvedValue(undefined),
}));

const subscribeMock = jest.mocked(redisSubscriberClient.subscribe);
const processarEventoMock = jest.mocked(processarEvento);

describe("iniciarConsumidorEventos", () => {
  it("assina todos os eventos versionados de notificações", async () => {
    const logSpy = jest.spyOn(console, "info").mockImplementation(() => {});

    await iniciarConsumidorEventos();

    expect(subscribeMock).toHaveBeenCalledTimes(EVENTOS_NOTIFICACOES.length);
    for (const tipoEvento of EVENTOS_NOTIFICACOES) {
      expect(subscribeMock).toHaveBeenCalledWith(
        tipoEvento,
        expect.any(Function)
      );
    }
    expect(logSpy).toHaveBeenCalledWith(
      `Consumindo eventos: ${EVENTOS_NOTIFICACOES.join(", ")}.`
    );
    logSpy.mockRestore();
  });

  it("registra falha de processamento sem deixar rejeição não tratada", async () => {
    processarEventoMock.mockRejectedValueOnce(new Error("Banco indisponível"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await iniciarConsumidorEventos();
    const callback = subscribeMock.mock.calls[0][1] as (message: string) => void;
    callback("{\"pedido_id\":12}");
    await Promise.resolve();
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalledWith(
      `Falha ao processar evento ${EVENTOS_NOTIFICACOES[0]}:`,
      expect.any(Error)
    );
    errorSpy.mockRestore();
  });
});
