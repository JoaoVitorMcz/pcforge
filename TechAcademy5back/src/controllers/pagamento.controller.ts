import { Request, Response } from "express";
import AppError from "../utils/app-error";
import {
  HttpError,
  carregarPedidoDetalhadoDoCliente,
  criarPedidoComItens,
} from "../services/pedido.service";
import {
  buscarPagamentoMercadoPago,
  criarPreferenciaMercadoPago,
} from "../services/mercadoPago.service";
import { publicarPagamentoAprovado } from "../services/pagamento-event.service";

function getAuthenticatedClienteId(req: Request) {
  const idCliente = req.cliente?.id_cliente;

  if (!idCliente) {
    throw new HttpError(401, "Usuario nao autenticado.");
  }

  return idCliente;
}

export const iniciarCheckoutMercadoPago = async (
  req: Request,
  res: Response
): Promise<void> => {

    const idCliente = getAuthenticatedClienteId(req);
    const isAdmin = req.cliente?.admin === true;
    const { id_endereco_entrega, itens, frontend_url } = req.body;

    const pedido = await criarPedidoComItens(
      {
        id_cliente: idCliente,
        id_endereco_entrega: Number(id_endereco_entrega),
        metodo: "mercado_pago",
        itens,
      },
      isAdmin
    );

    const preferencia = await criarPreferenciaMercadoPago(pedido, frontend_url);
    const preferenciaPayload =
      preferencia && typeof preferencia === "object" && !Array.isArray(preferencia)
        ? preferencia
        : {};

    res.status(201).json({
      mensagem: "Pedido criado e checkout do Mercado Pago iniciado.",
      pedido,
      ...preferenciaPayload,
    });

};

export const gerarNovaPreferenciaMercadoPago = async (
  req: Request,
  res: Response
): Promise<void> => {

    const idCliente = getAuthenticatedClienteId(req);
    const isAdmin = req.cliente?.admin === true;
    const idPedido = Number(req.params.id);
    const { frontend_url } = req.body;

    if (!Number.isInteger(idPedido) || idPedido < 1) {
      throw new AppError(400, "ID do pedido invalido.", "REQUISICAO_INVALIDA");

    }

    const pedido = await carregarPedidoDetalhadoDoCliente(idPedido, idCliente, isAdmin);

    if (pedido.status === "pago") {
      throw new AppError(409, "Este pedido ja foi pago.", "CONFLITO");

    }

    if (pedido.status === "cancelado" || pedido.status === "entregue") {
      throw new AppError(409, `Nao e possivel gerar pagamento para um pedido com status "${pedido.status}".`, "CONFLITO");

    }

    const preferencia = await criarPreferenciaMercadoPago(pedido, frontend_url);
    const preferenciaPayload =
      preferencia && typeof preferencia === "object" && !Array.isArray(preferencia)
        ? preferencia
        : {};

    res.status(200).json({
      mensagem: "Novo link do Mercado Pago gerado com sucesso.",
      pedido,
      ...preferenciaPayload,
    });

};

export const confirmarPagamentoMercadoPago = async (
  req: Request,
  res: Response
): Promise<void> => {

    const idCliente = getAuthenticatedClienteId(req);
    const isAdmin = req.cliente?.admin === true;
    const idPedido = Number(req.body.pedido_id);
    const paymentId =
      req.body.payment_id !== null &&
      req.body.payment_id !== undefined &&
      req.body.payment_id !== ""
        ? Number(req.body.payment_id)
        : null;
    const fallbackStatus = String(req.body.status || "").trim().toLowerCase();

    if (!Number.isInteger(idPedido) || idPedido < 1) {
      throw new AppError(400, "pedido_id invalido.", "REQUISICAO_INVALIDA");

    }

    if (paymentId !== null && (!Number.isInteger(paymentId) || paymentId < 1)) {
      throw new AppError(400, "payment_id invalido.", "REQUISICAO_INVALIDA");

    }

    const pedido = await carregarPedidoDetalhadoDoCliente(idPedido, idCliente, isAdmin);
    let paymentStatus = fallbackStatus || "pending";
    let paymentDetails: Record<string, unknown> | null = null;

    if (paymentId) {
      const paymentResponse = await buscarPagamentoMercadoPago(paymentId);

      if (
        !paymentResponse ||
        typeof paymentResponse !== "object" ||
        Array.isArray(paymentResponse)
      ) {
        throw new HttpError(
          502,
          "Mercado Pago retornou um payload invalido ao consultar o pagamento."
        );
      }

      paymentDetails = paymentResponse as Record<string, unknown>;
      const returnedStatus =
        typeof paymentDetails.status === "string"
          ? paymentDetails.status
          : paymentStatus || "pending";

      paymentStatus = String(returnedStatus || "pending").toLowerCase();

      const externalReference =
        typeof paymentDetails.external_reference === "string"
          ? paymentDetails.external_reference
          : "";

      if (externalReference && externalReference !== String(pedido.id_pedido)) {
        throw new AppError(409, "O pagamento retornado nao pertence ao pedido informado.", "CONFLITO");

      }
    }

    const pagamentoAprovado = paymentId && paymentStatus === "approved";

    if (pagamentoAprovado && pedido.status !== "pago") {
      await publicarPagamentoAprovado({
        pedidoId: idPedido,
        paymentId,
        aprovadoEm: new Date().toISOString(),
      });
    }

    const respostaPendente = pagamentoAprovado && pedido.status !== "pago";
    res.status(respostaPendente ? 202 : 200).json({
      mensagem: "Status do pagamento consultado com sucesso.",
      paymentStatus,
      paymentId,
      verifiedWithMercadoPago: Boolean(paymentDetails),
      sincronizacao: respostaPendente ? "processando" : "concluida",
      pedido,
    });

};
