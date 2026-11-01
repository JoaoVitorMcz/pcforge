import { resolverApiBaseUrl } from "../services/config";

describe("resolverApiBaseUrl", () => {
  it("usa o host do Expo pela porta HTTP do gateway", () => {
    expect(resolverApiBaseUrl({ hostExpo: "192.168.1.25" })).toBe(
      "http://192.168.1.25:8080/api"
    );
  });

  it("usa o host do navegador para Expo Web fora do dominio do site", () => {
    expect(resolverApiBaseUrl({ hostNavegador: "localhost" })).toBe(
      "http://localhost:8080/api"
    );
  });

  it("preserva a origem HTTPS do site PC Forge", () => {
    expect(
      resolverApiBaseUrl({
        hostNavegador: "pcforge.local",
        protocoloNavegador: "https:",
      })
    ).toBe("https://pcforge.local/api");
  });

  it("acrescenta /api a uma URL configurada sem o prefixo", () => {
    expect(
      resolverApiBaseUrl({ urlConfigurada: "http://192.168.1.25:8080/" })
    ).toBe("http://192.168.1.25:8080/api");
  });

  it("nao duplica /api em uma URL configurada", () => {
    expect(
      resolverApiBaseUrl({ urlConfigurada: "http://192.168.1.25:8080/api/" })
    ).toBe("http://192.168.1.25:8080/api");
  });
});
