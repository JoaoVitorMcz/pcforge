import { redisSubscriberClient } from "../config/redis";
import { processarEvento } from "./event-consumer";
import { EVENTOS_NOTIFICACOES } from "./event-types";

export async function iniciarConsumidorEventos(): Promise<void> {
  for (const tipoEvento of EVENTOS_NOTIFICACOES) {
    await redisSubscriberClient.subscribe(tipoEvento, (mensagem) => {
      void processarEvento(tipoEvento, mensagem).catch((error: unknown) => {
        console.error(`Falha ao processar evento ${tipoEvento}:`, error);
      });
    });
  }

  console.info(`Consumindo eventos: ${EVENTOS_NOTIFICACOES.join(", ")}.`);
}
