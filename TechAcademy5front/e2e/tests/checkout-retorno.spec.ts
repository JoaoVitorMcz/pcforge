import { test, expect } from "@playwright/test";

test("retorno mostra pagamento aprovado enquanto aguarda atualização do pedido", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("token", "token-abc-123");
    window.localStorage.setItem(
      "cliente",
      JSON.stringify({ id_cliente: 123, nome: "Teste Usuario" })
    );
    window.localStorage.setItem(
      "carrinho_123",
      JSON.stringify([{ id_produto: 1, quantidade: 1 }])
    );
    window.localStorage.setItem("checkout_pedido_aberto", "42");
  });

  let consultas = 0;
  let sinalizarConsulta!: () => void;
  const primeiraConsultaIniciada = new Promise<void>((resolve) => {
    sinalizarConsulta = resolve;
  });
  let liberarConsulta!: () => void;
  const liberarPrimeiraConsulta = new Promise<void>((resolve) => {
    liberarConsulta = resolve;
  });
  await page.route("**/pagamentos/mercado-pago/confirmar", (route) =>
    route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        paymentStatus: "approved",
        pedido: { id_pedido: 42, status: "pendente" },
        sincronizacao: "processando",
      }),
    })
  );
  await page.route("**/pedidos/42", (route) => {
    consultas += 1;
    if (consultas === 1) {
      sinalizarConsulta();
    }

    return (async () => {
      if (consultas === 1) {
        await liberarPrimeiraConsulta;
      }

      const status = consultas < 2 ? "pendente" : "pago";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id_pedido: 42, status }),
      });
    })();
  });

  await page.goto("/checkout/retorno?pedido=42&payment_id=9001&status=approved");
  await primeiraConsultaIniciada;

  await expect(
    page.getByRole("heading", { name: "Pagamento aprovado; atualizando pedido" })
  ).toBeVisible();
  liberarConsulta();
  await expect(
    page.getByRole("heading", { name: "Pagamento aprovado", exact: true })
  ).toBeVisible({ timeout: 10000 });

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("carrinho_123")))
    .toBe("[]");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("checkout_pedido_aberto")))
    .toBeNull();
  expect(consultas).toBe(2);
});
