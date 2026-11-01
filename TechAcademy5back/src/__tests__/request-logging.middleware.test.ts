import express from "express";
import request from "supertest";
import appApi from "../index";
import errorMiddleware from "../middleware/error.middleware";
import requestLoggingMiddleware from "../middleware/request-logging.middleware";

const REQUEST_ID_VALIDO = "7e3f63b2-49e1-4f13-8c5c-d72014b7a3a1";

describe("Middleware de log e identificador por requisição", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("expõe o identificador via CORS para clientes web", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);

    const resposta = await request(appApi)
      .get("/rota-inexistente")
      .set("Origin", "http://localhost:3000");

    expect(resposta.status).toBe(404);
    expect(resposta.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(resposta.headers["access-control-expose-headers"]).toBe("X-Request-Id");
  });

  it("preserva um UUID recebido e registra a requisição em JSON sem query string", async () => {
    const app = express();
    app.use(requestLoggingMiddleware);
    app.get("/produtos", (_req, res) => res.sendStatus(200));
    const consoleInfo = jest.spyOn(console, "info").mockImplementation(() => undefined);

    const resposta = await request(app)
      .get("/produtos?token=nao-registrar")
      .set("X-Request-Id", REQUEST_ID_VALIDO);

    expect(resposta.headers["x-request-id"]).toBe(REQUEST_ID_VALIDO);
    expect(consoleInfo).toHaveBeenCalledTimes(1);
    const registro = JSON.parse(consoleInfo.mock.calls[0][0] as string);
    expect(registro).toEqual(
      expect.objectContaining({
        timestamp: expect.any(String),
        level: "info",
        message: "Requisição HTTP concluída",
        requestId: REQUEST_ID_VALIDO,
        method: "GET",
        path: "/produtos",
        statusCode: 200,
        durationMs: expect.any(Number),
      })
    );
    expect(JSON.stringify(registro)).not.toContain("token=nao-registrar");
  });

  it("gera um novo UUID quando o identificador recebido é inválido", async () => {
    const app = express();
    app.use(requestLoggingMiddleware);
    app.get("/produtos", (_req, res) => res.sendStatus(400));
    const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    const resposta = await request(app)
      .get("/produtos")
      .set("X-Request-Id", "id-invalido");

    expect(resposta.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(resposta.headers["x-request-id"]).not.toBe("id-invalido");
    const registro = JSON.parse(consoleWarn.mock.calls[0][0] as string);
    expect(registro).toMatchObject({
      level: "warn",
      statusCode: 400,
      requestId: resposta.headers["x-request-id"],
    });
  });

  it("inclui o identificador no log de erros inesperados sem expor a mensagem", async () => {
    const app = express();
    app.use(requestLoggingMiddleware);
    app.get("/falha", () => {
      throw new Error("detalhe sensível");
    });
    app.use(errorMiddleware);
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const resposta = await request(app)
      .get("/falha")
      .set("X-Request-Id", REQUEST_ID_VALIDO);

    expect(resposta.status).toBe(500);
    expect(resposta.headers["x-request-id"]).toBe(REQUEST_ID_VALIDO);
    const registros = consoleError.mock.calls.map(([linha]) =>
      JSON.parse(linha as string)
    );
    expect(registros).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: "error",
          message: "Erro inesperado na API",
          requestId: REQUEST_ID_VALIDO,
          error: { name: "Error" },
        }),
        expect.objectContaining({
          level: "error",
          message: "Requisição HTTP concluída",
          requestId: REQUEST_ID_VALIDO,
          statusCode: 500,
        }),
      ])
    );
    expect(JSON.stringify(registros)).not.toContain("detalhe sensível");
  });
});
