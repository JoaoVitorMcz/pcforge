import { Request, Response } from "express";
import AppError from "../errors/app-error";
import { gerarPreferencia, confirmarPagamento } from "../services/pagamento.service";

function getCliente(req: Request) {
  if (!req.cliente) {
    throw new AppError(401, "Usuario nao autenticado.", "NAO_AUTENTICADO");
  }

  return req.cliente;
}

export async function gerarNovaPreferenciaMercadoPago(
  req: Request,
  res: Response
): Promise<void> {
  const idPedido = Number(req.params.id);
  const response = await gerarPreferencia(
    idPedido,
    getCliente(req),
    req.body?.frontend_url
  );

  res.status(200).json(response);
}

export async function confirmarPagamentoMercadoPago(
  req: Request,
  res: Response
): Promise<void> {
  const rawPaymentId = req.body?.payment_id;
  const paymentId =
    rawPaymentId === null || rawPaymentId === undefined || rawPaymentId === ""
      ? null
      : Number(rawPaymentId);
  const response = await confirmarPagamento(
    Number(req.body?.pedido_id),
    paymentId,
    String(req.body?.status || "").trim().toLowerCase(),
    getCliente(req)
  );

  res.status(200).json(response);
}
