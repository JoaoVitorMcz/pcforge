const CONFIGURED_API_BASE_URL = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
function shouldUseDevProxy() {
  if (process.env.NODE_ENV !== "development") {
    return false;
  }

  if (typeof window === "undefined") {
    return false;
  }

  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  const pointsToLocalApi =
    CONFIGURED_API_BASE_URL.includes("localhost") ||
    CONFIGURED_API_BASE_URL.includes("127.0.0.1");

  return isLocalhost && (!CONFIGURED_API_BASE_URL || pointsToLocalApi);
}

export function buildApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (shouldUseDevProxy()) {
    return normalizedPath;
  }

  return `${CONFIGURED_API_BASE_URL}${normalizedPath}`;
}

export function buildAssetUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!CONFIGURED_API_BASE_URL) {
    return normalizedPath;
  }

  return `${CONFIGURED_API_BASE_URL}${normalizedPath}`;
}

async function mensagemErro(response) {
  const corpo = await response.text().catch(() => "");
  if (!corpo) return `Erro HTTP ${response.status}`;

  try {
    const dados = JSON.parse(corpo);
    return dados?.erro?.mensagem ?? dados?.mensagem ?? dados?.error ?? corpo;
  } catch {
    return corpo;
  }
}

async function criarErroHttp(response) {
  const erro = new Error(await mensagemErro(response));
  erro.status = response.status;
  return erro;
}

function normalizeProduct(product) {
  const rawPrice = product.preco ?? product.valor ?? 0;
  const numericPrice =
    typeof rawPrice === "number" ? rawPrice : Number.parseFloat(rawPrice);
  const rawStock = product.estoque;
  const numericStock =
    typeof rawStock === "number" ? rawStock : Number.parseInt(rawStock, 10);

  return {
    ...product,
    preco: Number.isFinite(numericPrice) ? numericPrice : 0,
    estoque: Number.isFinite(numericStock) ? numericStock : null,
  };
}

export async function fetchJson(path) {
  const token = localStorage.getItem("token");

  const response = await fetch(buildApiUrl(path), {
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  if (!response.ok) {
    throw await criarErroHttp(response);
  }

  const data = await response.json();

  if (path === "/produtos" && Array.isArray(data)) {
    return data.map(normalizeProduct);
  }

  return data;
}

export async function sendJson(path, method, body) {
  const token = localStorage.getItem("token");

  const response = await fetch(buildApiUrl(path), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw await criarErroHttp(response);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  const data = await response.json();

  if (path.startsWith("/produtos") && data && !Array.isArray(data)) {
    return normalizeProduct(data);
  }

  return data;
}

export async function sendFormData(path, method, body) {
  const token = localStorage.getItem("token");

  const response = await fetch(buildApiUrl(path), {
    method,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body,
  });

  if (!response.ok) {
    throw await criarErroHttp(response);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
}
