import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 250, 5000),
  },
});

redisClient.on("error", (error) => {
  console.error("Erro na conexão com Redis:", error);
});

redisClient.on("ready", () => {
  console.log("Conexão com Redis estabelecida.");
});

export const conectarRedis = async (): Promise<void> => {
  if (redisClient.isOpen) {
    return;
  }

  let timeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      redisClient.connect(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("Tempo limite ao conectar ao Redis.")), 3000);
      }),
    ]);
  } catch (error) {
    console.error("Redis indisponível; a API continuará usando o MySQL:", error);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};

export default redisClient;
