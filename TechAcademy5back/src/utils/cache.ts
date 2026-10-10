import redisClient from "../config/redis";

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
      console.error(`Falha ao ler cache ${chave}; consultando MySQL:`, error);
    }
  }

  console.info(`Cache miss: ${chave}`);
  const valor = await buscar();

  if (redisClient.isReady) {
    try {
      await redisClient.set(chave, JSON.stringify(valor), { EX: ttlSegundos });
    } catch (error) {
      console.error(`Falha ao gravar cache ${chave}:`, error);
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
    console.error(`Falha ao invalidar cache ${prefixo}:`, error);
  }
};
