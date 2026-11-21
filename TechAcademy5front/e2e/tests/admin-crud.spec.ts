import { test, expect } from '@playwright/test';

test.describe('CRUD Admin de produtos e categorias', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('token', 'admin-token');
      window.localStorage.setItem(
        'cliente',
        JSON.stringify({ id_cliente: 1, nome: 'Admin Teste', email: 'admin@teste.com', admin: true })
      );
    });
    page.on('dialog', (dialog) => dialog.accept());
  });

  test('seleciona e envia imagem de produto', async ({ page }) => {
    await page.route('**/categorias', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id_categoria: 1, nome: 'Placas de vídeo' }]),
      })
    );
    await page.route('**/produtos', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    );
    await page.route('**/upload/imagem', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ url: '/uploads/produto.png' }),
      })
    );

    await page.goto('/admin');

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('label[for="admin-imagem-input"]').click();
    const fileChooser = await fileChooserPromise;
    expect(await fileChooser.element().getAttribute('name')).toBe('imagem');
    await fileChooser.setFiles({
      name: 'produto.png',
      mimeType: 'image/png',
      buffer: Buffer.from('89504e470d0a1a0a', 'hex'),
    });

    await expect(page.getByText('Imagem enviada com sucesso.')).toBeVisible();
  });

  test('CRUD de categorias completa', async ({ page }) => {
    let categorias = [];

    await page.route('**/categorias', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(categorias),
        });
        return;
      }
      if (route.request().method() === 'POST') {
        categorias = [{ id_categoria: 123, nome: 'Monitores', descricao: 'Monitores para gamers' }];
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(categorias[0]),
        });
        return;
      }
      route.continue();
    });

    await page.route('**/categorias/*', (route) => {
      if (route.request().method() === 'PUT') {
        categorias = [{ id_categoria: 123, nome: 'Monitores Atualizados', descricao: 'Monitores para jogos' }];
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(categorias[0]),
        });
        return;
      }
      if (route.request().method() === 'DELETE') {
        categorias = [];
        route.fulfill({ status: 204 });
        return;
      }
      route.continue();
    });

    await page.goto('/admin');
    await page.click('button:has-text("Categorias")');

    await page.fill('input[name="nome"]', 'Monitores');
    await page.fill('textarea[name="descricao"]', 'Monitores para gamers');
    await page.click('button:has-text("Criar categoria")');

    await expect(page.locator('text=Categoria criada com sucesso.')).toBeVisible();
    await expect(page.getByText('Monitores', { exact: true })).toBeVisible();
    await page.click('button:has-text("Editar")');
    await expect(page.locator('input[name="nome"][value="Monitores"]')).toBeVisible();

    await page.fill('input[name="nome"]', 'Monitores Atualizados');
    await page.fill('textarea[name="descricao"]', 'Monitores para jogos');
    await page.click('button:has-text("Salvar alterações")');

    await expect(page.locator('text=Categoria atualizada com sucesso.')).toBeVisible();
    await page.click('button:has-text("Excluir")');
    await expect(page.locator('text=Categoria excluída com sucesso.')).toBeVisible();
    await expect(page.getByText('Monitores Atualizados', { exact: true })).not.toBeVisible();
  });

  test('CRUD de produtos completo', async ({ page }) => {
    await page.route('**/categorias', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id_categoria: 1, nome: 'Placas de vídeo' }]),
      });
    });

    const produtoId = 321;
    let produtos = [];

    await page.route('**/produtos', async (route) => {
      const req = route.request();
      if (req.method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(produtos),
        });
        return;
      }
      if (req.method() === 'POST') {
        produtos = [{ id_produto: produtoId, nome: 'RTX 4070', descricao: 'Placa para jogos', preco: 4500, id_categoria: 1, estoque: 10, destaque: false }];
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(produtos[0]),
        });
        return;
      }
      route.continue();
    });

    await page.route('**/produtos/*', async (route) => {
      const req = route.request();
      if (req.method() === 'PUT') {
        produtos = [{ id_produto: produtoId, nome: 'RTX 4070 Super', descricao: 'Placa para jogos atualizada', preco: 4700, id_categoria: 1, estoque: 15, destaque: false }];
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(produtos[0]),
        });
        return;
      }
      if (req.method() === 'DELETE') {
        produtos = [];
        route.fulfill({ status: 204 });
        return;
      }
      route.continue();
    });

    await page.goto('/admin');

    await page.fill('input[name="nome"]', 'RTX 4070');
    await page.fill('textarea[name="descricao"]', 'Placa para jogos');
    await page.fill('input[name="preco"]', '4500');
    await page.selectOption('select[name="id_categoria"]', '1');
    await page.fill('input[name="estoque"]', '10');
    await page.click('button:has-text("Criar produto")');

    await expect(page.locator('text=Produto criado com sucesso.')).toBeVisible();
    await expect(page.locator('text=RTX 4070')).toBeVisible();
    await page.click('button:has-text("Editar")');
    await expect(page.locator('input[name="nome"][value="RTX 4070"]')).toBeVisible();

    await page.fill('input[name="nome"]', 'RTX 4070 Super');
    await page.fill('textarea[name="descricao"]', 'Placa para jogos atualizada');
    await page.click('button:has-text("Salvar alterações")');
    await expect(page.locator('text=Produto atualizado com sucesso.')).toBeVisible();

    await page.click('button:has-text("Excluir")');
    await expect(page.locator('text=Produto excluído com sucesso.')).toBeVisible();
    await expect(page.locator('text=RTX 4070 Super')).not.toBeVisible();
  });

  test('criação de categoria sem nome exibe erro de validação', async ({ page }) => {
    await page.route('**/categorias', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }
      route.continue();
    });

    await page.goto('/admin');
    await page.click('button:has-text("Categorias")');
    await page.click('button:has-text("Criar categoria")');

    await expect(page.locator('text=Informe o nome da categoria.')).toBeVisible();
  });

  test('erro de API ao criar categoria exibe mensagem de erro', async ({ page }) => {
    await page.route('**/categorias', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 500, body: '' });
        return;
      }
      route.continue();
    });

    await page.goto('/admin');
    await page.click('button:has-text("Categorias")');
    await page.fill('input[name="nome"]', 'Categoria Teste');
    await page.fill('textarea[name="descricao"]', 'Descrição teste');
    await page.click('button:has-text("Criar categoria")');

    await expect(page.locator('.admin-error')).toBeVisible();
  });

  test('erro de API ao excluir categoria exibe mensagem de erro', async ({ page }) => {
    const categoria = { id_categoria: 99, nome: 'Categoria Existente', descricao: 'Desc' };

    await page.route('**/categorias', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([categoria]) });
        return;
      }
      route.continue();
    });

    await page.route('**/categorias/*', (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({ status: 500, body: '' });
        return;
      }
      route.continue();
    });

    await page.goto('/admin');
    await page.click('button:has-text("Categorias")');
    await page.click('button:has-text("Excluir")');

    await expect(page.locator('.admin-error')).toBeVisible();
  });

  test('criação de produto sem campos obrigatórios exibe erro de validação', async ({ page }) => {
    await page.route('**/categorias', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id_categoria: 1, nome: 'Placas de vídeo' }]) });
    });
    await page.route('**/produtos', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }
      route.continue();
    });

    await page.goto('/admin');
    await page.click('button:has-text("Criar produto")');

    await expect(page.locator('text=Preencha nome, preço e categoria.')).toBeVisible();
  });

  test('erro de API ao criar produto exibe mensagem de erro', async ({ page }) => {
    await page.route('**/categorias', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id_categoria: 1, nome: 'Placas de vídeo' }]) });
    });
    await page.route('**/produtos', async (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 500, body: '' });
        return;
      }
      route.continue();
    });

    await page.goto('/admin');
    await page.fill('input[name="nome"]', 'Produto Teste');
    await page.fill('textarea[name="descricao"]', 'Descrição');
    await page.fill('input[name="preco"]', '1000');
    await page.selectOption('select[name="id_categoria"]', '1');
    await page.fill('input[name="estoque"]', '5');
    await page.click('button:has-text("Criar produto")');

    await expect(page.locator('.admin-error')).toBeVisible();
  });
});
