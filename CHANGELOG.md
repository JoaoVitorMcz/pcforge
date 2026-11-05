# Changelog

Mudanças relevantes do PC Forge, versão a versão.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o
versionamento segue [SemVer](https://semver.org/lang/pt-BR/). A política e o critério de
decisão estão em [docs/gestao/versionamento.md](docs/gestao/versionamento.md).

---

## [2.0.0] — 2026-11-03

Decomposição do monólito em **três microsserviços com bancos separados**. É a maior mudança
estrutural do projeto: o que era uma API Express sobre um MySQL virou três serviços que não
compartilham banco e conversam por eventos.

### Adicionado

- **Serviço de Pagamentos** (`TechAcademy5payments/`) com banco próprio, responsável pela
  integração com o Mercado Pago
- **Serviço de Notificações** (`TechAcademy5notifications/`) com banco próprio, que consome
  os eventos e guarda o histórico
- **Redis** com dois papéis: cache-aside na Loja e broker Pub/Sub entre os serviços
- **Eventos versionados** — `pedido.criado.v1`, `pedido.status-alterado.v1` e
  `pagamento.aprovado.v1`, com contratos em [docs/contratos-eventos.md](docs/contratos-eventos.md)
- **Nginx como API Gateway**, roteando `/api/` para a Loja e `/api/pagamentos` para o
  serviço de Pagamentos
- **Cache-aside** em produtos, destaques e categorias, com TTL e invalidação por evento
- **DTOs de entrada e saída** nos endpoints de escrita, separando o contrato da API do
  modelo do banco
- **Tratamento de erros centralizado** em middleware único, no lugar dos `try/catch`
  repetidos em cada controller
- **Logs estruturados** com identificador por requisição
- **Documentação arquitetural**: ADR-001 (Redis), ADR-002 (corte em microsserviços), Context
  Map com bounded contexts, Aggregates do contexto Loja e os diagramas C4
- **Validação de rastreabilidade no CI** — confere o ID do card no nome da branch

### Alterado

- O monólito `TechAcademy5back` passou a ser o **serviço de Loja** — clientes, catálogo e
  pedidos. O catálogo permaneceu aqui de propósito: a baixa de estoque acontece na mesma
  transação do pedido, e separá-los exigiria uma saga ([ADR-002](docs/adr/002-corte-microsservicos.md))
- **A confirmação de pagamento deixou de ser síncrona.** A Loja cria o pedido, o serviço de
  Pagamentos confirma com o Mercado Pago e publica `pagamento.aprovado.v1`; a Loja reage ao
  evento. A tela de retorno do checkout passa a tratar "ainda processando" como estado normal
- O app mobile passou a acessar a API **pelo gateway**, em `http://<host>:8080/api`

### Quebra de compatibilidade

- **A API mudou de endereço.** O que era `http://<host>:3000/produtos` agora é
  `http://<host>:8080/api/produtos`. **A porta 3000 não é mais publicada** — só o Nginx
  expõe portas (80, 443 e 8080). Qualquer cliente da v1.0.0 para de funcionar sem ajuste.
- **O pagamento saiu da Loja.** `pagamento.controller.ts` e `mercadoPago.service.ts` não
  existem mais em `TechAcademy5back/`; as rotas de pagamento agora vivem em
  `/api/pagamentos`, atendidas por outro serviço.
- **Um banco por serviço.** `pagamentos-db` e `notificacoes-db` nasceram vazios; nada foi
  migrado do banco da Loja, porque o pagamento nunca teve tabela própria — seu estado vivia
  em `Pedido.status`.

### Limitação conhecida

O Redis Pub/Sub **não retém mensagens para consumidores desconectados**. Um evento publicado
enquanto um serviço está fora do ar se perde. Em produção isso exigiria outbox ou fila
durável; no escopo acadêmico fica registrado no [ADR-001](docs/adr/001-redis-cache-e-eventos.md).

---

## [1.0.0] — 2026-10-21

Monólito entregue no módulo de Mobile e Engenharia de Software.

### Adicionado

- API Express 5 + TypeScript com Sequelize e MySQL 8
- Autenticação JWT com RBAC — papéis e permissões em tabela
- Web em React 19: loja e painel administrativo
- App Expo (SDK 57) com Expo Router, rodando também no navegador via `react-native-web`
- Checkout com Mercado Pago (Checkout Pro)
- Upload de imagens com Multer, validação de extensão e tamanho
- Docker Compose com MySQL, backend, frontend e Nginx como proxy reverso HTTPS
- 147 testes automatizados — 118 de integração na API e 29 no app
- E2E com Playwright e CI no GitHub Actions
- Documentação de Engenharia: casos de uso, DER, diagramas de sequência e de atividade,
  requisitos e RBAC

[2.0.0]: https://github.com/JoaoVitorMcz/pcforge/releases/tag/v2.0.0
[1.0.0]: https://github.com/JoaoVitorMcz/pcforge/releases/tag/v1.0.0
