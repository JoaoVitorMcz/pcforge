import { redisSubscriberClient } from "../config/redis";
import { PEDIDO_CRIADO_EVENT } from "./pedido-criado.event";
import { processarPedidoCriado } from "./pedido-criado.consumer";

export async function iniciarConsumidorPedidoCriado(): Promise<void> {
  await redisSubscriberClient.subscribe(PEDIDO_CRIADO_EVENT, (message) => {
    void processarPedidoCriado(message).catch((error: unknown) => {
      console.error(`Falha ao processar evento ${PEDIDO_CRIADO_EVENT}:`, error);
    });
  });

  console.info(`Consumindo evento ${PEDIDO_CRIADO_EVENT}.`);
}
