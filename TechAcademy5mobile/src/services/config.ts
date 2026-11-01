import Constants from "expo-constants";

/**
 * Endereco da API.
 *
 * O celular nao alcanca "localhost" da maquina de desenvolvimento, e o Nginx
 * usa um certificado autoassinado para pcforge.local que o aparelho nao
 * confia. Por isso usamos a porta HTTP de desenvolvimento publicada pelo
 * gateway Nginx.
 *
 * O IP e deduzido do host do proprio dev server do Expo (hostUri e algo como
 * "192.168.15.10:8081"), entao o app funciona na maquina de qualquer um da
 * dupla sem ninguem precisar editar arquivo. EXPO_PUBLIC_API_URL sobrescreve
 * quando for necessario apontar para outro host; o prefixo /api e acrescentado
 * automaticamente caso nao esteja presente.
 */
const PORTA_GATEWAY_MOBILE = 8080;
const PREFIXO_API = "/api";

const hostDoDevServer = Constants.expoConfig?.hostUri?.split(":")[0];
const hostDoNavegador =
  typeof window !== "undefined" ? window.location?.hostname : undefined;

interface LocalizacaoApi {
  urlConfigurada?: string;
  hostNavegador?: string;
  protocoloNavegador?: string;
  hostExpo?: string;
}

function adicionarPrefixoApi(url: string): string {
  const urlSemBarraFinal = url.replace(/\/+$/, "");
  return urlSemBarraFinal.endsWith(PREFIXO_API)
    ? urlSemBarraFinal
    : `${urlSemBarraFinal}${PREFIXO_API}`;
}

export function resolverApiBaseUrl({
  urlConfigurada,
  hostNavegador,
  protocoloNavegador,
  hostExpo,
}: LocalizacaoApi): string {
  if (urlConfigurada) {
    return adicionarPrefixoApi(urlConfigurada);
  }

  if (hostNavegador === "pcforge.local") {
    return `${protocoloNavegador ?? "https:"}//${hostNavegador}${PREFIXO_API}`;
  }

  const host = hostNavegador || hostExpo || "localhost";
  return `http://${host}:${PORTA_GATEWAY_MOBILE}${PREFIXO_API}`;
}

export const API_BASE_URL = resolverApiBaseUrl({
  urlConfigurada: process.env.EXPO_PUBLIC_API_URL,
  hostNavegador: hostDoNavegador,
  protocoloNavegador:
    typeof window !== "undefined" ? window.location?.protocol : undefined,
  hostExpo: hostDoDevServer,
});
