import "dotenv/config";
import app from "./app";
import { fecharBanco, inicializarBanco } from "./config/database";
import { conectarRedis, desconectarRedis } from "./config/redis";
import { iniciarConsumidorPedidoCriado } from "./events/subscriber";

const PORT = Number(process.env.PORT || 3002);

export async function startServer() {
  await inicializarBanco();
  await conectarRedis();
  await iniciarConsumidorPedidoCriado();

  const server = app.listen(PORT, () => {
    console.info(`Servico de Pagamentos rodando na porta ${PORT}.`);
  });

  const shutdown = () => {
    server.close((error) => {
      if (error) {
        console.error("Falha ao encerrar servidor HTTP de Pagamentos:", error);
        process.exitCode = 1;
      }

      void Promise.all([fecharBanco(), desconectarRedis()]).catch((shutdownError: unknown) => {
        console.error("Falha ao encerrar conexoes do serviço de Pagamentos:", shutdownError);
        process.exitCode = 1;
      });
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return server;
}

if (require.main === module) {
  void startServer().catch((error: unknown) => {
    console.error("Falha ao iniciar o servico de Pagamentos:", error);
    process.exitCode = 1;
  });
}
