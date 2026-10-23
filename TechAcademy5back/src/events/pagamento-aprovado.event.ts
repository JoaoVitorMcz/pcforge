export const PAGAMENTO_APROVADO_EVENT = "pagamento.aprovado.v1";

export interface PagamentoAprovadoEvent {
  pedidoId: number;
  paymentId: number;
  aprovadoEm: string;
}

export function parsePagamentoAprovadoEvent(
  message: string
): PagamentoAprovadoEvent | null {
  try {
    const event: unknown = JSON.parse(message);

    if (!event || typeof event !== "object") {
      return null;
    }

    const payload = event as Record<string, unknown>;
    const aprovadoEm =
      typeof payload.aprovadoEm === "string" ? payload.aprovadoEm : "";

    if (
      !Number.isInteger(payload.pedidoId) ||
      Number(payload.pedidoId) < 1 ||
      !Number.isInteger(payload.paymentId) ||
      Number(payload.paymentId) < 1 ||
      !aprovadoEm ||
      Number.isNaN(Date.parse(aprovadoEm))
    ) {
      return null;
    }

    return {
      pedidoId: Number(payload.pedidoId),
      paymentId: Number(payload.paymentId),
      aprovadoEm,
    };
  } catch {
    return null;
  }
}
