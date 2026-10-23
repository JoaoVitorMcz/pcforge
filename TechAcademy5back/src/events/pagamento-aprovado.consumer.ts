import Pedido from "../models/Pedido";
import {
  PAGAMENTO_APROVADO_EVENT,
  parsePagamentoAprovadoEvent,
} from "./pagamento-aprovado.event";

export async function processarPagamentoAprovado(message: string): Promise<void> {
  const event = parsePagamentoAprovadoEvent(message);

  if (!event) {
    console.error("Evento pagamento.aprovado.v1 ignorado: payload invalido.");
    return;
  }

  const [pedidosAtualizados] = await Pedido.update(
    {
      status: "pago",
      data_pagamento: new Date(event.aprovadoEm),
    },
    {
      where: {
        id_pedido: event.pedidoId,
        status: "pendente",
      },
    }
  );

  if (pedidosAtualizados === 0) {
    console.info(
      `Evento ${PAGAMENTO_APROVADO_EVENT} ignorado para pedido ${event.pedidoId}: inexistente ou fora do status pendente.`
    );
    return;
  }

  console.info(
    `Evento ${PAGAMENTO_APROVADO_EVENT} consumido para pedido ${event.pedidoId}.`
  );
}
