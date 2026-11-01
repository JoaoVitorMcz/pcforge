import { redisSubscriberClient } from "../config/redis";
import { logError } from "../utils/logger";
import { processarProdutoAtualizado } from "./produto-atualizado.consumer";
import { PRODUTO_ATUALIZADO_EVENT } from "./produto.event";

let subscription: Promise<void> | undefined;

function inscreverNoEvento(): Promise<void> | undefined {
  if (!redisSubscriberClient.isReady || subscription) {
    return subscription;
  }

  subscription = redisSubscriberClient
    .subscribe(PRODUTO_ATUALIZADO_EVENT, (message) => {
      void processarProdutoAtualizado(message).catch((error: unknown) => {
        logError(
          "Falha ao processar evento de atualização de produto",
          { eventName: PRODUTO_ATUALIZADO_EVENT },
          error
        );
      });
    })
    .then(() => {
      console.info(`Consumindo evento ${PRODUTO_ATUALIZADO_EVENT}.`);
    })
    .catch((error: unknown) => {
      subscription = undefined;
      throw error;
    });

  return subscription;
}

redisSubscriberClient.on("ready", () => {
  void inscreverNoEvento()?.catch((error: unknown) => {
    logError(
      "Falha ao assinar evento de atualização de produto",
      { eventName: PRODUTO_ATUALIZADO_EVENT },
      error
    );
  });
});

export async function iniciarConsumidorProdutoAtualizado(): Promise<void> {
  if (!redisSubscriberClient.isOpen) {
    let timeout: NodeJS.Timeout | undefined;

    try {
      const connection = redisSubscriberClient.connect();
      await Promise.race([
        connection,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error("Tempo limite ao conectar consumidor de produtos.")),
            3000
          );
        }),
      ]);
    } catch (error) {
      logError(
        "Consumidor de atualização de produto indisponível; Redis tentará reconectar",
        { eventName: PRODUTO_ATUALIZADO_EVENT },
        error
      );
      return;
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  await inscreverNoEvento();
}
