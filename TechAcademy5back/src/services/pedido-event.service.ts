import AppError from "../utils/app-error";
import redisClient from "../config/redis";
import {
  PEDIDO_CRIADO_EVENT,
  PEDIDO_STATUS_ALTERADO_EVENT,
  PedidoCriadoEvent,
  PedidoStatusAlteradoEvent,
} from "../events/pedido.event";

async function publicarEventoPedido(
  nomeEvento: string,
  pedidoId: number,
  payload: PedidoCriadoEvent | PedidoStatusAlteradoEvent
): Promise<void> {
  const mensagemIndisponivel =
    `Pedido ${pedidoId} foi persistido, mas o evento ${nomeEvento} não foi entregue.`;

  if (!redisClient.isReady) {
    const error = new AppError(
      503,
      `${mensagemIndisponivel} O Redis está indisponível.`,
      "EVENTO_INDISPONIVEL"
    );
    console.error(error.message);
    throw error;
  }

  try {
    const consumidores = await redisClient.publish(
      nomeEvento,
      JSON.stringify(payload)
    );

    if (consumidores === 0) {
      throw new AppError(
        503,
        `${mensagemIndisponivel} Nenhum consumidor está inscrito.`,
        "EVENTO_SEM_CONSUMIDOR"
      );
    }
  } catch (error) {
    if (error instanceof AppError) {
      console.error(error.message);
      throw error;
    }

    console.error(`Falha ao publicar ${nomeEvento}:`, error);
    throw new AppError(503, mensagemIndisponivel, "EVENTO_INDISPONIVEL");
  }
}

export function publicarPedidoCriado(event: PedidoCriadoEvent): Promise<void> {
  return publicarEventoPedido(PEDIDO_CRIADO_EVENT, event.pedido_id, event);
}

export function publicarPedidoStatusAlterado(
  event: PedidoStatusAlteradoEvent
): Promise<void> {
  return publicarEventoPedido(
    PEDIDO_STATUS_ALTERADO_EVENT,
    event.pedido_id,
    event
  );
}
