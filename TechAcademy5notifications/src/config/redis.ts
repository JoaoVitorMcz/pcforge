import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

export const redisSubscriberClient = redisClient.duplicate();

redisClient.on("error", (error) => {
  console.error("Erro na conexão do serviço de Notificações com Redis:", error);
});

redisSubscriberClient.on("error", (error) => {
  console.error("Erro no consumidor de eventos de Notificações:", error);
});

export async function conectarRedis(): Promise<void> {
  await Promise.all([redisClient.connect(), redisSubscriberClient.connect()]);
}

export async function desconectarRedis(): Promise<void> {
  await Promise.all([redisClient.quit(), redisSubscriberClient.quit()]);
}
