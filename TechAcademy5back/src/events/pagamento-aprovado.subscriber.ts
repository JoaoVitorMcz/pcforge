import { redisSubscriberClient } from "../config/redis";
import { processarPagamentoAprovado } from "./pagamento-aprovado.consumer";
import { PAGAMENTO_APROVADO_EVENT } from "./pagamento-aprovado.event";

let subscription: Promise<void> | undefined;

function inscreverNoEvento(): Promise<void> | undefined {
  if (!redisSubscriberClient.isReady || subscription) {
    return subscription;
  }

  subscription = redisSubscriberClient
    .subscribe(PAGAMENTO_APROVADO_EVENT, (message) => {
      void processarPagamentoAprovado(message).catch((error: unknown) => {
        console.error(
          `Falha ao processar evento ${PAGAMENTO_APROVADO_EVENT}:`,
          error
        );
      });
    })
    .then(() => {
      console.info(`Consumindo evento ${PAGAMENTO_APROVADO_EVENT}.`);
    })
    .catch((error: unknown) => {
      subscription = undefined;
      throw error;
    });

  return subscription;
}

redisSubscriberClient.on("ready", () => {
  void inscreverNoEvento()?.catch((error: unknown) => {
    console.error(
      `Falha ao assinar evento ${PAGAMENTO_APROVADO_EVENT}:`,
      error
    );
  });
});

export async function iniciarConsumidorPagamentoAprovado(): Promise<void> {
  if (!redisSubscriberClient.isOpen) {
    let timeout: NodeJS.Timeout | undefined;

    try {
      const connection = redisSubscriberClient.connect();
      await Promise.race([
        connection,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error("Tempo limite ao conectar o consumidor.")),
            3000
          );
        }),
      ]);
    } catch (error) {
      console.error(
        "Consumidor de pagamento aprovado indisponivel; o Redis tentara reconectar:",
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
