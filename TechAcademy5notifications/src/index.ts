import "dotenv/config";
import { fecharBanco, inicializarBanco } from "./config/database";
import { conectarRedis, desconectarRedis } from "./config/redis";
import { iniciarConsumidorEventos } from "./events/subscriber";

export async function startService(): Promise<void> {
  await inicializarBanco();
  await conectarRedis();
  await iniciarConsumidorEventos();
  console.info("Serviço de Notificações iniciado.");

  let encerrando = false;
  const shutdown = async () => {
    if (encerrando) {
      return;
    }
    encerrando = true;

    try {
      await Promise.all([fecharBanco(), desconectarRedis()]);
    } catch (error) {
      console.error("Falha ao encerrar conexões do serviço de Notificações:", error);
      process.exitCode = 1;
    }
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

if (require.main === module) {
  void startService().catch((error: unknown) => {
    console.error("Falha ao iniciar o serviço de Notificações:", error);
    process.exitCode = 1;
  });
}
