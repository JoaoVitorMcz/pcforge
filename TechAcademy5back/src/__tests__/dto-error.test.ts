import express from "express";
import request from "supertest";
import errorMiddleware from "../middleware/error.middleware";
import AppError from "../utils/app-error";

describe("Middleware de erro", () => {
  it("não expõe detalhes internos na resposta 500", async () => {
    const erroApp = express();
    erroApp.get("/erro", () => {
      throw new Error("detalhe sensível");
    });
    erroApp.use(errorMiddleware);
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const resposta = await request(erroApp).get("/erro");

    expect(resposta.status).toBe(500);
    expect(resposta.body).toEqual({
      erro: { codigo: "ERRO_INTERNO", mensagem: "Erro interno do servidor." },
    });
    expect(JSON.stringify(resposta.body)).not.toContain("detalhe sensível");
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("normaliza erros conhecidos no formato padrão", async () => {
    const erroApp = express();
    erroApp.get("/erro", () => {
      throw new AppError(404, "Produto não encontrado.", "NAO_ENCONTRADO");
    });
    erroApp.use(errorMiddleware);

    const resposta = await request(erroApp).get("/erro");

    expect(resposta.status).toBe(404);
    expect(resposta.body).toEqual({
      erro: { codigo: "NAO_ENCONTRADO", mensagem: "Produto não encontrado." },
    });
  });
});
