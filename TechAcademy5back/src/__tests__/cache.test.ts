import redisClient from "../config/redis";
import { cacheAside, invalidarCachePorPrefixo } from "../utils/cache";

jest.mock("../config/redis", () => ({
  __esModule: true,
  default: {
    isReady: false,
    get: jest.fn(),
    set: jest.fn(),
    scanIterator: jest.fn(),
    del: jest.fn(),
  },
}));

type RedisMock = {
  isReady: boolean;
  get: jest.Mock;
  set: jest.Mock;
  scanIterator: jest.Mock;
  del: jest.Mock;
};

const redisMock = redisClient as unknown as RedisMock;

describe("cache Redis", () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    redisMock.isReady = false;
    logSpy = jest.spyOn(console, "info").mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("consulta a origem e grava com TTL no cache miss", async () => {
    redisMock.isReady = true;
    redisMock.get.mockResolvedValue(null);
    const buscar = jest.fn().mockResolvedValue([{ id_produto: 1 }]);

    const resultado = await cacheAside("produtos:lista:pagina=1", 300, buscar);

    expect(resultado).toEqual([{ id_produto: 1 }]);
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(redisMock.set).toHaveBeenCalledWith(
      "produtos:lista:pagina=1",
      '[{"id_produto":1}]',
      { EX: 300 }
    );
  });

  it("retorna o valor do cache hit sem consultar a origem", async () => {
    redisMock.isReady = true;
    redisMock.get.mockResolvedValue('[{"id_produto":1}]');
    const buscar = jest.fn();

    const resultado = await cacheAside("produtos:lista:pagina=1", 300, buscar);

    expect(resultado).toEqual([{ id_produto: 1 }]);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("continua pela origem quando Redis está indisponível", async () => {
    const buscar = jest.fn().mockResolvedValue(["MySQL"]);

    await expect(cacheAside("categorias:lista", 1800, buscar)).resolves.toEqual(["MySQL"]);

    expect(buscar).toHaveBeenCalledTimes(1);
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it("invalida todas as chaves do prefixo", async () => {
    redisMock.isReady = true;
    redisMock.scanIterator.mockReturnValue((async function* () {
      yield ["produtos:lista:pagina=1"];
      yield ["produtos:destaque:pagina=1"];
    })());

    await invalidarCachePorPrefixo("produtos:");

    expect(redisMock.del).toHaveBeenCalledTimes(2);
    expect(redisMock.del).toHaveBeenNthCalledWith(1, "produtos:lista:pagina=1");
    expect(redisMock.del).toHaveBeenNthCalledWith(2, "produtos:destaque:pagina=1");
  });
});
