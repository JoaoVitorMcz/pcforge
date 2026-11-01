import { randomUUID } from "node:crypto";
import { RequestHandler } from "express";
import { runWithRequestId } from "../utils/request-context";

const REQUEST_ID_HEADER = "X-Request-Id";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const requestLoggingMiddleware: RequestHandler = (req, res, next) => {
  const requestIdRecebido = req.get(REQUEST_ID_HEADER);
  const requestId =
    requestIdRecebido && UUID_PATTERN.test(requestIdRecebido)
      ? requestIdRecebido
      : randomUUID();
  const iniciadoEm = Date.now();

  res.setHeader(REQUEST_ID_HEADER, requestId);
  res.on("finish", () => {
    const nivel =
      res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    const registro = {
      timestamp: new Date().toISOString(),
      level: nivel,
      message: "Requisição HTTP concluída",
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - iniciadoEm,
    };

    console[nivel](JSON.stringify(registro));
  });

  runWithRequestId(requestId, next);
};

export default requestLoggingMiddleware;
