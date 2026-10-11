# Status do projeto

Rastreamento de andamento da sprint: o que já fecha rubrica, o que falta, e por que as
decisões foram tomadas assim.

> **Este arquivo não é a entrega de Engenharia de Software.** Ela são os seis documentos da
> Fase D, listados abaixo — este aqui só rastreia o andamento. Não marque aqueles itens da
> rubrica como prontos por causa deste documento.

Última atualização: catálogo, imagens, suporte, CEP e sessão expirada, com a revisão desse trabalho.

### Back-end avançado — Sprint 1 em andamento

O trabalho segue as issues atribuídas a Henrique Hoffmann no Jira, agrupadas por sprint.
Esta etapa implementa Redis no Compose (sem porta publicada), conexão tolerante a falhas,
cache-aside para listagens, destaques e buscas de produtos, além de categorias, com TTLs,
log de hit/miss e invalidação após CRUD. O [ADR-001](adr/001-redis-cache-e-eventos.md)
registra as alternativas e os TTLs de 5 minutos para produtos e 30 minutos para categorias.

Os controllers encaminham erros de negócio e falhas inesperadas ao middleware central,
que padroniza a resposta `{ erro: { codigo, mensagem } }` e não expõe detalhes internos.
DTOs validam as entradas de escrita de produtos, clientes e pedidos; as respostas de
cliente passam por uma whitelist que exclui hash de senha e campos internos. Os testes
integração cobrem miss → hit → invalidação após atualização, além da validação pelo
middleware e do DTO de saída. A suíte do backend passa com 137 testes; eventos,
microsserviços e Nginx ficam para a Sprint 2.

## Placar da rubrica

| Disciplina | Item | Pts | Estado |
|---|---|---|---|
| Tech Forge | Multer recebendo e salvando imagens | 1,0 | ✅ |
| Tech Forge | Validação de extensão, tamanho e colisão de nomes | 1,0 | ✅ |
| Tech Forge | Controle funcional de usuário admin e usuário | 2,0 | ✅ |
| Mobile | Arquitetura e padronização de projeto | 0,5 | ✅ |
| Mobile | Componentização e boas práticas (clean code) | 1,0 | ✅ |
| Mobile | CRUD completo: aplicativo × API × banco | 1,0 | ✅ |
| Mobile | Regra de negócio respeitada entre funcionalidades | 0,5 | ✅ |
| Mobile | Usabilidade, compatibilidade entre dispositivos e segurança | 1,0 | 🔶 |
| Engenharia | Contextualização e evolução do produto | 1,0 | ✅ |
| Engenharia | Diagrama entidade-relacionamento | 0,5 | ✅ |
| Engenharia | Requisitos funcionais e não funcionais | 1,0 | ✅ |
| Engenharia | 2 diagramas de caso de uso | 0,5 | ✅ |
| Engenharia | 2 diagramas de atividade | 0,5 | ✅ |
| Engenharia | 2 diagramas de sequência | 0,5 | ✅ |

**Total: 11,5 / 12,0**

O placar item a item, com a evidência de cada nota, está em
[avaliacao-rubrica.md](avaliacao-rubrica.md).

O único item em aberto é **usabilidade, compatibilidade e segurança (1,0)**, e hoje ele está
pela metade, não zerado: o tratamento de 401 e 403 já existia, e a revisão de setembro fechou
a suíte de testes do app, o passo de teste no CI e a declaração do `expo-image-picker`. O que
falta é só evidência: rodar num aparelho real e registrar os prints.

O que fechou na M2:

- **Controle admin × usuário (2,0)** — três camadas independentes mais a demonstração: a
  mesma navegação vista por um cliente e por um admin. `authorizePermission` passou a valer
  em rotas reais, então `permissao` e `role_permissao` sustentam decisão ([rbac.md](rbac.md)).
- **Regra de negócio (0,5)** — carrinho respeitando estoque, checkout exigindo endereço, 409
  tratado na tela, e no backend a baixa e a devolução de estoque, que **não existiam**.

## Fases

### M1 — fundação do app · concluída

- Seed idempotente do banco (`TechAcademy5back/src/scripts/seed.ts`)
- `GET /admin/dashboard`, restrito a admin, com agregações de pedidos e estoque
- App Expo com Expo Router: login, cadastro, catálogo, perfil e dashboard do admin
- CRUD completo de endereços no app

### M1.5 — base web do app · concluída

Trabalho do Henrique, commit `9d77847`. O app Expo passou a rodar também no navegador:

- `react-native-web` + `react-dom`, com o app servido como página
- Sessão por plataforma: `SecureStore` no nativo, `localStorage` na build web
  (`SecureStore` encosta no Keychain/Keystore, que não existem no browser)
- `services/config.ts` deduz a API pelo hostname do navegador, tratando `pcforge.local`
- Login com validação por campo, mensagem específica para 401 e para falha de conexão
- Três telas administrativas **somente leitura**: produtos, clientes e configurações
- Dashboard virou hub, com atalhos para as telas novas
- 26 imagens de produto renomeadas para ASCII e servidas ao container da web por volume

Correções aplicadas depois, na `fix/regressoes-base-mobile`: as quatro telas admin vieram
com componentes e `StyleSheet` inteiros em uma única linha e foram reformatadas; o dashboard
tinha perdido faturamento, total de pedidos e o painel de pedidos por status, todos
restaurados; o `tsconfig.json` tinha perdido `.expo/types` do `include`; e as 26 imagens
antigas com espaço e acento no nome ficaram duplicadas com as novas — foram removidas, o
`placeholder.png` que faltava foi criado e o seed passou a preencher `imagem`.

### M2 — carrinho e pedidos · concluída

- [x] `CarrinhoContext` portando as regras de `TechAcademy5front/src/context/CarrinhoContext.jsx`
- [x] Tela de carrinho: ajustar quantidade, remover e total
- [x] Checkout na própria tela do carrinho, via `POST /pedidos`, exigindo endereço
- [x] "Meus pedidos" com `GET /pedidos/cliente/:id` e cancelamento
- [x] Regras de negócio: estoque no carrinho, endereço obrigatório, 409 tratado
- [ ] Evidências do controle de acesso: prints da mesma navegação por cliente e por admin

O carrinho é **local**: `POST /pedidos` aceita os itens no corpo, então `/itens-pedido` não
entra no checkout — a descrição anterior desta fase estava errada nesse ponto.

A área admin do app cresceu junto: CRUD de produtos com upload pela galeria do aparelho e
gestão de pedidos com máquina de estados.

**Auditoria das fases anteriores.** Nove problemas encontrados e corrigidos:

| # | Problema | Correção |
|---|---|---|
| 1 | Os PRs foram para a `main`, não para a `dev` | `dev` alinhada por fast-forward |
| 2 | **Estoque nunca era baixado** — 1 unidade vendia infinitas vezes | Débito na transação e devolução no cancelamento |
| 3 | **Só o seed escrevia em `cliente_role`** — cadastro pela API ficava sem permissões | `criarCliente` vincula o papel; seed corrige o retroativo |
| 4 | `itempedido` não validava estoque | Ajuste pela diferença de quantidade |
| 5 | Status de pedido sem máquina de estados: `entregue` voltava a `pendente` | Transições validadas, com 409 |
| 6 | A regra de estoque não tinha teste | `pedido-estoque.test.ts`, sobre o serviço real |
| 7 | Os diagramas descreviam baixa de estoque inexistente, e 400 onde era 409 | Corrigidos, e agora verdadeiros |
| 8 | `authorizePermission` e `adminMiddleware` eram código morto | O primeiro entrou em rotas reais; o segundo saiu |
| 9 | `models/index.js` e `config/config.js`, scaffolding do sequelize-cli | Removidos |

O item 2 é o mais grave: era a regra de negócio que a rubrica cobra, e não existia.
### M2.5 — catálogo, suporte e sessão · concluída

Trabalho do Henrique, 11 commits sobre a M2:

- Imagens legadas servidas pela API em `/imagens/produtos`, com `LEGACY_IMAGES_DIR` no
  compose e `services/imagens.ts` unificando os três formatos de caminho
- Seed ampliado para 11 categorias e 35 produtos, 30 deles com foto
- Navegação com ícones vetoriais e cabeçalho da loja com marca, perfil e carrinho
- Abas reorganizadas: Home (destaques), Peças, Periféricos, Suporte e Admin
- Tela de suporte com formulário
- Preenchimento automático de bairro, cidade e estado pelo CEP, via ViaCEP
- **Sessão expirada**: qualquer 401 encerra a sessão, e o 403 ganhou mensagem própria
- `pre-push` reescrito em Node para funcionar no Windows

**Revisão desse trabalho.** Quatro defeitos encontrados e corrigidos:

| # | Problema | Correção |
|---|---|---|
| 1 | **A lista de endereços ficou inalcançável** — a aba virou `href: null` e nenhum link apontava para ela, então o app só criava endereço e nunca listava, editava ou excluía | Botão "Meus endereços" no perfil, ao lado de "Meus pedidos" |
| 2 | **Credenciais do EmailJS no código-fonte**, em repositório público | Movidas para `EXPO_PUBLIC_EMAILJS_*`, com `.env.example`; `.env` passou a ser ignorado pelo Git |
| 3 | `emailjs-com` **deprecado** desde 2022 e voltado para navegador | Substituído por `fetch` na API REST do EmailJS: uma dependência a menos e funciona igual no nativo |
| 4 | **Erro do CEP renderizava em verde**, como se fosse confirmação | O status passou a carregar o tipo, e a cor sai dele |

O defeito 1 é o mais grave: derrubava o **CRUD completo (1,0)** para apenas *criar*.

> A chave do EmailJS que estava no código continua no histórico do Git. **Precisa ser
> trocada no painel da conta** — remover do código não invalida a que já vazou.

### M3 — validação e evidências

Único item de rubrica em aberto. É a fase que falta:

- [x] Suíte de testes do app: 29 testes em 3 suítes, rodando no CI
- [ ] Rodar em Android e em um segundo aparelho ou emulador, registrando prints
      — a build web já dá uma segunda plataforma, faltam os prints e um aparelho real
- [x] Tratar 401 com logout automático e 403 com mensagem clara
      — o cliente encerra a sessão em qualquer 401 e apresenta mensagem dedicada para 403
- [x] Tratar falha de rede sem travar a tela — login trata `TypeError` de conexão e as
      listas usam `EstadoLista` com "Tentar novamente"
- [x] Conferir que o token nunca aparece em log
- [ ] **Evidências do controle de acesso**: registrar a mesma navegação vista por um admin e por
      um cliente, mostrando que a aba Admin só aparece para o administrador

### D — documentação de Engenharia · concluída

**4,0 pontos, o mesmo peso do app mobile inteiro.** Saíram dos models e das rotas que já
existiam, sem depender das outras fases.

- [x] [contextualizacao.md](contextualizacao.md) — problema, duas personas e as cinco etapas
      da evolução web → web + mobile + navegador
- [x] [der.md](der.md) — ER das 10 tabelas (6 do domínio + 4 do RBAC), com as decisões de
      modelagem e a tabela de cardinalidades
- [x] [requisitos.md](requisitos.md) — 8 grupos de requisitos funcionais mapeados rota a rota,
      com o nível de acesso de cada uma, e 5 grupos de não funcionais
- [x] [casos-de-uso.md](casos-de-uso.md) — cliente compra pelo app; admin gerencia a loja
- [x] [diagramas-atividade.md](diagramas-atividade.md) — checkout; upload com validação
- [x] [diagramas-sequencia.md](diagramas-sequencia.md) — login com JWT + RBAC; criar pedido
      App → API → MySQL

Todos em Markdown com Mermaid, que o GitHub renderiza direto. Os blocos foram validados com
`@mermaid-js/mermaid-cli`, então nenhum diagrama depende de o avaliador ter ferramenta extra.
Se o professor exigir imagem, `mmdc` exporta para PNG sem retrabalho.

## Decisões de arquitetura

- **O app atende as duas personas; a web também.** O cliente compra pelo app ou pelo site, e
  o admin opera dos dois lados. O que justifica o app não é ter algo exclusivo, e sim onde a
  pessoa está: o estoque acaba no depósito, não na mesa do escritório. Substitui as regras
  anteriores ("o app expõe só o dashboard" e "o app lê, a web escreve").
- **O carrinho é local, não uma entidade da API.** `POST /pedidos` aceita os itens no corpo,
  então `/itens-pedido` fica para ajustar um pedido já criado. Um carrinho no servidor exigiria
  criar o pedido antes de o cliente decidir comprar, e sujaria a tabela com rascunhos.
- **O app roda em nativo e no navegador a partir do mesmo código.** `react-native-web`
  dá uma segunda plataforma para a demonstração sem manter dois projetos. O custo é a
  sessão precisar de dois back-ends de armazenamento — daí o `localStorage` na web.
- **Expo Router com grupos de rota.** Torna o gate de admin declarativo: a área
  administrativa tem seu próprio layout com redirect, em vez de condicionais espalhadas
  pelas telas.
- **Controle de acesso em três camadas independentes.** A aba some para o cliente comum;
  o layout da área admin redireciona quem chega por navegação direta; a API responde 403
  pelo `authorizeRole`. Esconder a aba, sozinho, não é proteção.
- **RBAC com papéis e permissões, não um boolean.** As tabelas `role`, `permissao`,
  `cliente_role` e `role_permissao` seguem o modelo clássico, e `authorizeRole([...])` é
  uma função de ordem superior: cada rota declara quais papéis aceita. O boolean `admin`
  continua espelhado no token porque web e mobile leem esse campo — trocar as três camadas
  de uma vez seria risco sem ganho. Detalhes em [docs/rbac.md](rbac.md).
- **O CRUD da rubrica é o de Endereços.** É o mais limpo de demonstrar (quatro operações
  óbvias) e as rotas já existiam no backend.
- **A URL da API é deduzida do host do dev server do Expo.** O app funciona na máquina de
  qualquer pessoa da dupla sem ninguém editar arquivo.
- **Monorepo com os três projetos lado a lado.** Mantém `docker-compose.yml`, `.env` e CI
  centralizados, e preserva o histórico da evolução do produto.
- **O primeiro admin nasce do seed, não da API.** `criarCliente` só permite marcar
  `admin: true` para quem já está autenticado como admin, então não há como sair do zero
  pela API.

## Pendências abertas

- **O E2E continua no `.husky/pre-push`.** O hook foi reescrito em Node para funcionar no
  Windows, mas segue rodando o Playwright antes de cada push. Remover: o E2E já roda no CI,
  então não se perde cobertura, e o hook trava o push esperando o dev server do CRA subir.
- **Três dos oito destaques não têm imagem.** A aba Home é a primeira tela do app e mostra
  `Ryzen 5 5600`, `GeForce RTX 4060` e `RTX 4070 Super` sem foto. Existem produtos quase
  iguais **com** foto no seed (`AMD Ryzen 5 5600X`, `RTX 3060`), então dá para consolidar
  ou marcar como destaque os que têm imagem.
- **A tela de suporte nunca foi testada num aparelho.** O EmailJS bloqueia por padrão
  chamadas de aplicações que não são navegador; a opção precisa ser habilitada no painel da
  conta. O serviço já devolve mensagem específica para esse 403.
- **Os PRs vão para a `main` por engano.** O GitHub sugere `main` como base porque é o branch
  padrão do repositório, e foi para lá que uma leva inteira foi. A `dev` já foi alinhada por
  fast-forward, mas **é preciso trocar a base para `dev` a cada PR** — ou mudar o branch
  padrão do repositório no GitHub, que resolve de vez. Hoje `main` e `dev` coincidem.
- **O boolean `admin` convive com o RBAC.** O token carrega `roles` e `admin` ao mesmo
  tempo, e `extrairRoles` deriva um do outro nos dois sentidos. É proposital: web e mobile
  ainda leem `admin`. Remover o boolean quando as duas pontas passarem a ler `roles` —
  enquanto os dois existirem, os dois precisam concordar.
- **O token fica em `localStorage` na build web.** Qualquer script da página consegue lê-lo,
  ao contrário do `SecureStore` usado no nativo. É aceitável porque a web do app é só
  demonstração e o entregável avaliado é o nativo — mas não deve virar o caminho padrão.
- **Push direto na `dev` no commit `9d77847`.** O fluxo desta seção pede uma branch por
  tarefa integrando de volta na `dev`. Um commit squashed sem corpo também dificulta
  revisar e reverter em partes. Combinar com a dupla antes da próxima entrega.
- **A cópia da máquina de estados no app pode divergir do backend.** `TRANSICOES` em
  `services/pedidos.ts` espelha `TRANSICOES_DE_STATUS` do controller. É proposital — a tela só
  oferece o que a API aceita — mas mudar um lado exige mudar o outro. A API continua sendo
  quem decide, então a divergência causa botão a mais ou a menos, nunca dado errado.
- **Acesso do celular pela LAN nunca testado num aparelho real.** O bundle compila e a
  API responde pelo IP da máquina, mas ninguém abriu o app em um telefone. Se não
  conectar, o primeiro suspeito é o firewall: o Wi-Fi está no perfil **Público**, onde o
  Windows bloqueia conexões de entrada por padrão — não o código.

## Fluxo de trabalho da dupla

- Ramificar **sempre da `dev`**, nunca da `main`
- `git pull` antes de começar qualquer tarefa
- Uma branch por tarefa, integrando de volta na `dev`
- Antes de abrir uma branch, conferir aqui o que já está feito

Ramificar da `main` ou de uma cópia local desatualizada produz trabalho duplicado e
conflito em arquivos que já haviam sido corrigidos.
