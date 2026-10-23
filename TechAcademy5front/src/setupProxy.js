const { createProxyMiddleware } = require("http-proxy-middleware");

function createApiProxy(target) {
  const proxy = createProxyMiddleware({ target, changeOrigin: true });

  return (request, response, next) => {
    if (request.headers.accept?.includes("text/html")) {
      next();
      return;
    }

    proxy(request, response, next);
  };
}

module.exports = function setupProxy(app) {
  app.use(
    "/pagamentos",
    createApiProxy(process.env.PAYMENTS_PROXY_TARGET || "http://localhost:3002")
  );

  app.use(
    [
      "/clientes",
      "/produtos",
      "/categorias",
      "/enderecos",
      "/pedidos",
      "/itens-pedido",
      "/upload",
      "/admin",
    ],
    createApiProxy(process.env.API_PROXY_TARGET || "http://localhost:3000")
  );
};
