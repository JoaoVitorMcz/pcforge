import { salvarPedido } from "../config/database";
import { parsePedidoCriadoEvent, PEDIDO_CRIADO_EVENT } from "./pedido-criado.event";

export async function processarPedidoCriado(message: string): Promise<void> {
  const event = parsePedidoCriadoEvent(message);

  if (!event) {
    console.error(`Evento ${PEDIDO_CRIADO_EVENT} ignorado: payload invalido.`);
    return;
  }

  const criado = await salvarPedido(event);

  if (!criado) {
    console.info(
      `Evento ${PEDIDO_CRIADO_EVENT} duplicado ignorado para pedido ${event.pedido_id}.`
    );
    return;
  }

  console.info(`Pedido ${event.pedido_id} recebido e salvo pelo serviço de Pagamentos.`);
}
