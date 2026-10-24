# PC Forge

E-commerce full stack de componentes de PC, desenvolvido como projeto acadêmico. A aplicação cobre o fluxo completo de uma loja virtual — catálogo, carrinho, pedidos, pagamento e painel administrativo — e roda inteiramente em containers, com Nginx como proxy reverso HTTPS.

> **Status:** projeto acadêmico concluído. Certificados HTTPS são autoassinados e o ambiente é voltado para execução local.

---

## Stack

**Back-end**
- Node.js + Express 5 (TypeScript)
- Sequelize ORM + MySQL 8
- JWT para autenticação, bcrypt para hash de senhas
- Multer para upload de imagens
- SDK do Mercado Pago (Checkout Pro)

**Front-end**
- React 19 + TypeScript
- React Router
- React Icons

**Infraestrutura e qualidade**
- Docker Compose (MySQL, Redis, serviços de back-end, front-end e Nginx)
- Microsserviço de Notificações com histórico de eventos em banco próprio
- Nginx como proxy reverso HTTPS com cabeçalhos de segurança
- Jest + Supertest (testes de integração da API)
- Playwright (testes end-to-end)
- GitHub Actions (CI)
- Husky + lint-staged + commitlint, ESLint, GitFlow

---

## Funcionalidades

**Loja**
- Catálogo de produtos com paginação, busca por nome e seção de destaques
- Navegação por categorias
- Cadastro e login de clientes com validação de CPF e e-mail
- Gerenciamento de endereços de entrega
- Carrinho com itens de pedido (adicionar, alterar quantidade, remover)
- Checkout via Mercado Pago e confirmação de pagamento
- Cancelamento de pedido pelo próprio cliente

**Administração**
- CRUD de produtos, categorias e clientes
- Upload de imagens de produtos
- Listagem de todos os pedidos e atualização de status
- Desativação lógica de produtos e clientes (sem perda de histórico)

**Segurança**
- Senhas com hash bcrypt
- Autenticação stateless via JWT
- Middleware de autorização em três níveis: rota pública, usuário autenticado e administrador
- Middleware `selfOrAdmin`, que garante que um cliente só acesse os próprios dados
- Back-end e banco sem portas expostas ao host — todo acesso passa pelo Nginx
- HTTPS obrigatório, com redirecionamento de HTTP e HSTS

---

## Arquitetura

```
                   https://pcforge.local
                            │
                    ┌───────▼────────┐
                    │     Nginx      │  :443
                    │  proxy reverso │  redireciona :80 → :443
                    └───┬────────┬───┘
                /api    │        │    /
             /uploads   │        │
                  ┌─────▼───┐  ┌─▼──────────┐
                  │ Backend │  │  Frontend  │
                  │ Express │  │   React    │
                  └────┬────┘  └────────────┘
                       │
                  ┌────▼────┐
                  │  MySQL  │  volume mysql_data
                  └─────────┘
```

O Redis também transporta eventos para o serviço de Notificações, que mantém o histórico no
banco isolado `pcforge_notificacoes`.

O back-end segue uma organização em camadas:

```
src/
├── config/        conexão com o banco, JWT, middlewares de auth, upload
├── models/        entidades Sequelize (Cliente, Produto, Categoria, Pedido, ItemPedido, Endereco)
├── controllers/   tratamento de requisição e resposta
├── services/      regras de negócio (pedidos, integração Mercado Pago)
├── routes/        definição de endpoints e middlewares
├── utils/         validações e paginação
└── __tests__/     testes de integração
```

---

## Como rodar

**Pré-requisitos:** Docker e Docker Compose.

```bash
# 1. Clone o repositório
git clone https://github.com/henriquehoffmannvicentini/pcforge-unico.git
cd pcforge-unico

# 2. Copie as variáveis de ambiente (os valores padrão já funcionam localmente)
cp .env.example .env
```

**3. Gere os certificados HTTPS locais** (PowerShell, com [mkcert](https://github.com/FiloSottile/mkcert) instalado):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\mkcert-generate.ps1
```

**4. Aponte o domínio local** no arquivo de hosts (`C:\Windows\System32\drivers\etc\hosts` no Windows, `/etc/hosts` no Linux/macOS), como administrador:

```
127.0.0.1 pcforge.local
```

**5. Suba a aplicação:**

```bash
docker compose up --build
```

Acesse **https://pcforge.local**. Como o certificado é autoassinado, o navegador exibirá um aviso na primeira visita.

### Pagamentos (opcional)

Para testar o checkout, adicione ao `.env` um token de teste do Mercado Pago:

```
MERCADO_PAGO_ACCESS_TOKEN=TEST-xxxxxxxx
```

Sem o token, o restante da aplicação funciona normalmente.

---

## Testes

**Integração da API** — Jest + Supertest, cobrindo autenticação, clientes, produtos, categorias, endereços, pedidos e itens de pedido:

```bash
cd TechAcademy5back
npm install
npm test
npm run test:coverage   # com relatório de cobertura
```

**End-to-end** — Playwright, cobrindo home, login, fluxo de compra, CRUD de usuário e CRUD administrativo (a aplicação precisa estar rodando):

```bash
cd TechAcademy5front
npm install
npm run test:e2e:install   # instala os navegadores, apenas na primeira vez
npm run test:e2e
```

O workflow de CI executa as suítes de back-end e front-end automaticamente a cada push e pull request nas branches `main` e `dev`.

---

## API

Base: `https://pcforge.local/api`

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/clientes` | público | Cadastro de cliente |
| POST | `/clientes/login` | público | Login, retorna JWT |
| GET | `/clientes` | admin | Lista clientes |
| GET | `/clientes/:id` | dono ou admin | Detalha cliente |
| PUT | `/clientes/:id` | dono ou admin | Atualiza cliente |
| DELETE | `/clientes/:id` | dono ou admin | Desativa cliente |
| GET | `/produtos` | público | Lista produtos (paginado) |
| GET | `/produtos/destaque` | público | Produtos em destaque |
| GET | `/produtos/buscar` | público | Busca por nome |
| GET | `/produtos/:id` | público | Detalha produto |
| POST | `/produtos` | admin | Cria produto |
| PUT | `/produtos/:id` | admin | Atualiza produto |
| DELETE | `/produtos/:id` | admin | Desativa produto |
| GET | `/categorias` | público | Lista categorias |
| GET | `/categorias/:id` | público | Detalha categoria |
| POST · PUT · DELETE | `/categorias` | admin | CRUD de categorias |
| GET | `/enderecos/cliente/:id_cliente` | dono ou admin | Endereços do cliente |
| POST · PUT · DELETE | `/enderecos` | autenticado | Gerencia endereços |
| POST | `/pedidos` | autenticado | Cria pedido |
| GET | `/pedidos` | admin | Lista todos os pedidos |
| GET | `/pedidos/cliente/:id_cliente` | dono ou admin | Pedidos do cliente |
| PATCH | `/pedidos/:id/status` | admin | Atualiza status |
| PATCH | `/pedidos/:id/cancelar` | autenticado | Cancela pedido |
| GET | `/itens-pedido/pedido/:id_pedido` | autenticado | Itens do pedido |
| POST · PATCH · DELETE | `/itens-pedido` | autenticado | Gerencia itens |
| POST | `/upload` | admin | Upload de imagem |
| POST | `/pagamentos/mercado-pago/checkout` | autenticado | Inicia checkout |
| POST | `/pagamentos/mercado-pago/confirmar` | autenticado | Confirma pagamento |

Rotas autenticadas exigem o cabeçalho `Authorization: Bearer <token>`.

---

## Modelo de dados

```
Cliente ──1:N── Endereco
   │
   └──1:N── Pedido ──1:N── ItemPedido ──N:1── Produto ──N:1── Categoria
```

---

## Autores

Desenvolvido em dupla por [Henrique Hoffmann Vicentini](https://github.com/henriquehoffmannvicentini) e [João](https://github.com/JoaoVitorMcz).
