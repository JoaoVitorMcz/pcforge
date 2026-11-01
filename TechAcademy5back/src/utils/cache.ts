import redisClient from "../config/redis";
import { logError } from "./logger";

export const cacheAside = async <T>(
  chave: string,
  ttlSegundos: number,
  buscar: () => Promise<T>
): Promise<T> => {
  if (redisClient.isReady) {
    try {
      const valorEmCache = await redisClient.get(chave);
      if (valorEmCache !== null) {
        console.info(`Cache hit: ${chave}`);
        return JSON.parse(valorEmCache) as T;
      }
    } catch (error) {
      logError(
        "Falha ao ler cache; consultando MySQL",
        { cacheKey: chave },
        error
      );
    }
  }

  console.info(`Cache miss: ${chave}`);
  const valor = await buscar();

  if (redisClient.isReady) {
    try {
      await redisClient.set(chave, JSON.stringify(valor), { EX: ttlSegundos });
    } catch (error) {
      logError("Falha ao gravar cache", { cacheKey: chave }, error);
    }
  }

  return valor;
};

export const invalidarCachePorPrefixo = async (prefixo: string): Promise<void> => {
  if (!redisClient.isReady) {
    return;
  }

  try {
    const chaves: string[] = [];
    for await (const lote of redisClient.scanIterator({ MATCH: `${prefixo}*`, COUNT: 100 })) {
      chaves.push(...lote);
    }
    if (chaves.length > 0) {
      await Promise.all(chaves.map((chave) => redisClient.del(chave)));
    }
  } catch (error) {
    logError("Falha ao invalidar cache", { cachePrefix: prefixo }, error);
  }
};
