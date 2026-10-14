# PC Forge

E-commerce de componentes de PC, projeto acadêmico. Monorepo com três aplicações sobre
a mesma API, rodando em containers.

O roadmap, o placar da rubrica e as pendências ficam em
[docs/status-do-projeto.md](docs/status-do-projeto.md). Consulte antes de decidir o que
fazer em seguida.

## Mapa

| Pasta | O que é |
|---|---|
| `TechAcademy5back/` | API Express 5 + TypeScript, Sequelize, MySQL 8, JWT, Multer |
| `TechAcademy5front/` | Web React 19: loja e painel administrativo |
| `TechAcademy5mobile/` | App Expo (SDK 57) + Expo Router: compra do cliente e painel do admin |
| `nginx/` | Proxy reverso HTTPS para o ambiente web |
| `docker-compose.yml` | MySQL, backend, frontend e Nginx |

**O app e a web atendem as duas personas.** O cliente compra nos dois: catálogo, carrinho,
checkout e "meus pedidos". O admin também opera nos dois, com CRUD de produtos, upload de
imagem, gestão de pedidos e indicadores. A aba Admin do app só aparece para quem tem o papel.
O CRUD de categorias segue só na web.

Desde a Fase M1.5 o app também roda no navegador, a partir do mesmo código, via
`react-native-web`.

## Comandos

```bash
# Stack (na raiz). O .env sai de .env.example e funciona sem edição.
docker compose up -d mysql backend

# Popular o banco. Roda dentro do container: a porta do MySQL não é publicada no host.
docker compose exec backend npm run seed

# Backend
cd TechAcademy5back && npm test          # 118 testes (Jest + Supertest)
cd TechAcademy5back && npm run lint

# Web
cd TechAcademy5front && npm run test:e2e # Playwright

# Mobile
cd TechAcademy5mobile && npm start       # Expo Go, mesma rede Wi-Fi
cd TechAcademy5mobile && npm test        # 29 testes (Jest + Testing Library)
cd TechAcademy5mobile && npm run typecheck
cd TechAcademy5mobile && npm run lint
```

Contas criadas pelo seed, ambas com senha `Senha@123`:
`admin@pcforge.com` (admin) e `cliente@pcforge.com` (cliente comum).

## Convenções

- **GitFlow**: `dev` é a branch de integração. Ramifique sempre da `dev`, nunca da
  `main`, e dê `git pull` antes de começar.
- **Conventional Commits** — há commitlint no `commit-msg`.
- Código, comentários e mensagens de commit em **português**.
- O app mobile descobre o IP da API pelo host do dev server do Expo, então funciona na
  máquina de qualquer pessoa da dupla sem editar arquivo.
- **Diagramas ficam no repositório.** Mermaid dentro dos `.md` por padrão; draw.io, em
  `.drawio.png` sob `docs/diagramas/`, só quando o layout carrega significado (C4 e Context
  Map). O padrão e o índice de todos eles estão em
  [docs/diagramas/README.md](docs/diagramas/README.md).

## Armadilhas já pagas

Cada item abaixo custou tempo para descobrir. Mudá-los sem entender o motivo reintroduz
o problema.

- **`TechAcademy5mobile/.npmrc` tem `legacy-peer-deps=true`.** O SDK 57 tem um conflito
  de peers entre pacotes do próprio Expo: `react-native-reanimated` exige
  `react-native-worklets` `0.12.x` e `expo-modules-core` declara aceitar até `0.10.x`.
  Sem a flag, `npm ci` falha e quebra o CI. Fixar a versão na mão é pior: qualquer
  escolha deixa um dos dois fora da faixa declarada.
- **A suíte do mobile depende de dois pacotes que o preset não traz.** `jest-expo` do SDK 57
  exige `@react-native/jest-preset` como peer, e o `@testing-library/react-native` v14 exige
  o pacote `test-renderer` (não `react-test-renderer`). Sem os dois, o Jest nem carrega.
- **`render` do Testing Library v14 é assíncrono.** Devolve promessa: sem `await`, o teste lê
  o estado antes do primeiro render e passa afirmando nada. Foi o que fez as duas primeiras
  suítes falharem por motivo errado.
- **ESLint fica na v9 no mobile.** A v10 removeu `context.getFilename()`, que o
  `eslint-plugin-react` do config do Expo ainda usa, e o lint quebra ao carregar regra.
- **Nunca defina `MYSQL_USER=root`.** A imagem do MySQL 8 recusa esse valor e o
  container entra em restart loop, sem subir o banco.
- **Os testes de upload gravam em `UPLOAD_DIR`**, uma pasta temporária por suíte
  (`TechAcademy5back/src/test-support/jest.env.ts`). Apontar para `uploads/` real faz a
  suíte apagar imagens de produto ao rodar `npm test`.
- **A validação de imagem usa `UploadValidationError` com `instanceof`**, nunca
  comparação de substring da mensagem: reescrever o texto do erro viraria um 500
  silencioso.
- **A baixa de estoque mora na transação de `criarPedidoComItens`.** Tirá-la de lá permite o
  pedido ser gravado sem o estoque cair, que é exatamente o bug que a auditoria encontrou.
  Use `decrement`/`increment`, nunca ler o estoque e escrever de volta: duas compras
  simultâneas perderiam uma das atualizações.
- **`criarCliente` precisa vincular o papel em `cliente_role`.** Sem isso o token sai com
  `permissoes: []` e as rotas com `authorizePermission` recusam a compra de quem acabou de
  se cadastrar.
- **O carrinho persiste só `{ id_produto, quantidade }`.** Guardar o snapshot do produto
  serviria preço velho e estouraria o limite recomendado do `SecureStore` no Android.
- **O E2E roda no CI, não no `pre-push`.** A primeira compilação do CRA com o cache do
  webpack frio passa de 5 minutos, por isso `webServer.timeout` está em 600s.
