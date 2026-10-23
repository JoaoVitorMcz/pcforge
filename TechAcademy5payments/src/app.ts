import express, { NextFunction, Request, Response } from "express";
import AppError from "./errors/app-error";
import pagamentoRoutes from "./routes/pagamento.routes";

const app = express();

app.use(express.json());
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));
app.use("/pagamentos", pagamentoRoutes);
app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      mensagem: error.message,
      codigo: error.code,
    });
    return;
  }

  console.error("Erro inesperado no servico de Pagamentos:", error);
  res.status(500).json({
    mensagem: "Erro interno no servico de Pagamentos.",
    codigo: "ERRO_INTERNO",
  });
});

export default app;
