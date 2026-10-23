import {
  buscarPagamento,
  Pagamento,
  salvarPreferencia,
  salvarStatusPagamento,
} from "../config/database";
import { TokenPayload } from "../config/auth.middleware";
import AppError from "../errors/app-error";
import { publicarPagamentoAprovado } from "../events/publisher";
import {
  buscarPagamentoMercadoPago,
  criarPreferenciaMercadoPago,
} from "./mercado-pago.service";

function validarIdPedido(idPedido: number): void {
  if (!Number.isInteger(idPedido) || idPedido < 1) {
    throw new AppError(400, "pedido_id invalido.", "REQUISICAO_INVALIDA");
  }
}

function validarDonoDoPedido(pagamento: Pagamento, cliente: TokenPayload): void {
  if (!cliente.admin && pagamento.id_cliente !== cliente.id_cliente) {
    throw new AppError(
      403,
      "Voce nao tem permissao para acessar este pagamento.",
      "PERMISSAO_NEGADA"
    );
  }
}

async function buscarPedidoDePagamento(
  idPedido: number,
  cliente: TokenPayload
): Promise<Pagamento> {
  validarIdPedido(idPedido);
  const pagamento = await buscarPagamento(idPedido);

  if (!pagamento) {
    throw new AppError(
      409,
      "Pedido ainda nao disponivel no servico de Pagamentos; tente novamente.",
      "PEDIDO_AINDA_NAO_RECEBIDO"
    );
  }

  validarDonoDoPedido(pagamento, cliente);
  return pagamento;
}

function pedidoResposta(pagamento: Pagamento, status?: string) {
  return {
    id_pedido: pagamento.id_pedido,
    status: status || (pagamento.status === "approved" ? "pago" : "pendente"),
    valor: pagamento.valor,
  };
}

export async function gerarPreferencia(
  idPedido: number,
  cliente: TokenPayload,
  frontendUrl?: string
) {
  const pagamento = await buscarPedidoDePagamento(idPedido, cliente);

  if (pagamento.status === "approved") {
    throw new AppError(409, "Este pedido ja foi pago.", "CONFLITO");
  }

  if (["cancelled", "canceled", "refunded", "charged_back"].includes(pagamento.status)) {
    throw new AppError(409, "Nao e possivel gerar pagamento para este pedido.", "CONFLITO");
  }

  const preference = await criarPreferenciaMercadoPago(pagamento, frontendUrl);
  await salvarPreferencia(idPedido, preference.id);

  return {
    mensagem: "Checkout do Mercado Pago iniciado.",
    pedido: pedidoResposta(pagamento),
    ...preference,
  };
}

export async function confirmarPagamento(
  idPedido: number,
  paymentId: number | null,
  fallbackStatus: string,
  cliente: TokenPayload
) {
  const pagamento = await buscarPedidoDePagamento(idPedido, cliente);
  let paymentStatus = fallbackStatus || "pending";
  let verifiedWithMercadoPago = false;

  if (paymentId !== null) {
    if (!Number.isInteger(paymentId) || paymentId < 1) {
      throw new AppError(400, "payment_id invalido.", "REQUISICAO_INVALIDA");
    }

    const details = await buscarPagamentoMercadoPago(paymentId);

    if (details.external_reference !== String(idPedido)) {
      throw new AppError(
        409,
        "O pagamento retornado nao pertence ao pedido informado.",
        "CONFLITO"
      );
    }

    if (details.currency_id !== "BRL") {
      throw new AppError(409, "A moeda do pagamento nao corresponde ao pedido.", "CONFLITO");
    }

    if (
      typeof details.transaction_amount !== "number" ||
      !Number.isFinite(details.transaction_amount) ||
      Math.abs(details.transaction_amount - pagamento.valor) > 0.01
    ) {
      throw new AppError(409, "O valor do pagamento nao corresponde ao pedido.", "CONFLITO");
    }

    paymentStatus = details.status || "pending";
    verifiedWithMercadoPago = true;
    const aprovadoEm =
      paymentStatus === "approved"
        ? details.date_approved && !Number.isNaN(Date.parse(details.date_approved))
          ? new Date(details.date_approved)
          : new Date()
        : null;

    await salvarStatusPagamento(idPedido, paymentId, paymentStatus, aprovadoEm);

    if (paymentStatus === "approved") {
      await publicarPagamentoAprovado({
        pedidoId: idPedido,
        paymentId,
        aprovadoEm: (aprovadoEm || new Date()).toISOString(),
      });
    }
  }

  return {
    mensagem: "Status do pagamento consultado com sucesso.",
    paymentStatus,
    paymentId,
    verifiedWithMercadoPago,
    pedido: pedidoResposta(
      pagamento,
      paymentStatus === "approved" ? "pago" : undefined
    ),
  };
}
