import { ErrorRequestHandler } from "express";
import multer from "multer";
import AppError from "../utils/app-error";
import { UploadValidationError } from "../utils/upload.errors";

const obterAppError = (erro: unknown): AppError | null => {
  if (erro instanceof AppError) {
    return erro;
  }
  if (erro instanceof multer.MulterError) {
    const statusCode = erro.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    const mensagem = erro.code === "LIMIT_FILE_SIZE"
      ? "Arquivo excede o tamanho máximo de 5MB."
      : `Erro no upload: ${erro.message}`;
    return new AppError(statusCode, mensagem, "UPLOAD_INVALIDO");
  }
  if (erro instanceof UploadValidationError) {
    return new AppError(400, erro.message, "UPLOAD_INVALIDO");
  }
  if (
    erro instanceof SyntaxError &&
    "status" in erro &&
    (erro as SyntaxError & { status?: number }).status === 400
  ) {
    return new AppError(400, "O corpo da requisição contém JSON inválido.");
  }
  return null;
};

const errorMiddleware: ErrorRequestHandler = (erro, _req, res, _next) => {
  const appError = obterAppError(erro);
  if (appError) {
    return res.status(appError.statusCode).json({
      erro: { codigo: appError.codigo, mensagem: appError.message },
    });
  }

  console.error("Erro inesperado na API:", erro);
  return res.status(500).json({
    erro: { codigo: "ERRO_INTERNO", mensagem: "Erro interno do servidor." },
  });
};

export default errorMiddleware;
