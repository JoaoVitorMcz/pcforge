import { test, expect } from '@playwright/test';

test('fluxo de compra: checkout cria pedido e redireciona para pagamento', async ({ page }) => {
  // preparando localStorage: cliente autenticado e carrinho com 1 item
  await page.addInitScript(() => {
    window.localStorage.setItem('token', 'token-abc-123');
    window.localStorage.setItem('cliente', JSON.stringify({ id_cliente: 123, nome: 'Teste Usuario' }));
    window.localStorage.setItem('carrinho_123', JSON.stringify([
      { id_produto: 1, nome: 'Placa Video', quantidade: 1, preco: 1000 }
    ]));
  });

  // mock endpoints usados pelo Checkout
  await page.route('**/enderecos/cliente/*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id_endereco: 10, numero: '100', bairro: 'Bairro', cidade: 'Cidade', estado: 'SP', cep: '01234-567' }]),
    });
  });

  let pedidoCriado = false;
  await page.route('**/pedidos', (route) => {
    // intercepta criação de pedido
    if (route.request().method() === 'POST') {
      pedidoCriado = true;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ pedido: { id_pedido: 999 } }),
      });
    } else {
      route.continue();
    }
  });

  let pagamentoInitPoint: string | null = null;
  let tentativasPagamento = 0;
  await page.route('**/pagamentos/mercado-pago/pedido/*/preference', (route) => {
    tentativasPagamento += 1;

    if (tentativasPagamento === 1) {
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          codigo: 'PEDIDO_AINDA_NAO_RECEBIDO',
          mensagem: 'Pedido ainda nao disponivel; tente novamente.',
        }),
      });
      return;
    }

    pagamentoInitPoint = 'https://mp.example/checkout/999';
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ init_point: pagamentoInitPoint }),
    });
  });

  await page.goto('/checkout');

  // garantir que os dados do checkout carregaram
  await expect(page.locator('text=Resumo do pedido')).toBeVisible();

  // clicar em pagar e verificar que criamos pedido e que a API de pagamento foi chamada
  await page.click('button:has-text("Pagar com Mercado Pago")');

  await expect.poll(() => Promise.resolve(pagamentoInitPoint), { timeout: 5000 }).toBe('https://mp.example/checkout/999');
  expect(pedidoCriado).toBeTruthy();
  expect(tentativasPagamento).toBe(2);
});
