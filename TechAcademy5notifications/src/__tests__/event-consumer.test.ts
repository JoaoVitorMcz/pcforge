import { salvarEvento } from "../config/database";
import { processarEvento } from "../events/event-consumer";
import { EVENTOS_NOTIFICACOES } from "../events/event-types";

jest.mock("../config/database", () => ({
  salvarEvento: jest.fn(),
}));

const salvarEventoMock = jest.mocked(salvarEvento);

describe("processarEvento", () => {
  beforeEach(() => {
    salvarEventoMock.mockResolvedValue({
      id: 17,
      recebidoEm: "2026-10-23T20:00:00.000Z",
    });
  });

  it.each(EVENTOS_NOTIFICACOES)(
    "armazena o payload do evento %s e registra o recebimento",
    async (tipoEvento) => {
      const logSpy = jest.spyOn(console, "info").mockImplementation(() => {});
      const payload = { pedido_id: 12, status: "aprovado" };

      await processarEvento(tipoEvento, JSON.stringify(payload));

      expect(salvarEventoMock).toHaveBeenCalledWith(tipoEvento, payload);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Evento ${tipoEvento} recebido e armazenado`)
      );
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("id=17"));
      logSpy.mockRestore();
    }
  );

  it("rejeita payload inválido sem gravá-lo", async () => {
    await expect(
      processarEvento("pedido.criado.v1", "{ inválido")
    ).rejects.toThrow("Payload JSON inválido recebido em pedido.criado.v1.");
    expect(salvarEventoMock).not.toHaveBeenCalled();
  });

  it("propaga falhas de persistência", async () => {
    salvarEventoMock.mockRejectedValueOnce(new Error("Banco indisponível"));

    await expect(
      processarEvento("pagamento.aprovado.v1", JSON.stringify({ pedidoId: 12 }))
    ).rejects.toThrow("Banco indisponível");
  });
});
