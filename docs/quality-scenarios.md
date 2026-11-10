# Quality Scenarios

Os atributos de qualidade do PC Forge escritos como cenários verificáveis. Entrega da
SCRUM-32.

## O formato

Cada cenário segue o modelo do SEI (*Software Engineering Institute*), com seis partes:

| Parte | Pergunta que responde |
|---|---|
| **Fonte** | Quem ou o que provoca a situação? |
| **Estímulo** | O que acontece? |
| **Artefato** | Que parte do sistema é afetada? |
| **Ambiente** | Em que condição o sistema está? |
| **Resposta** | O que o sistema faz? |
| **Medida** | Como verificar que a resposta está certa? |

A **medida** é o que diferencia um cenário de uma intenção. "O sistema deve ser rápido" não
é verificável. "A segunda requisição não consulta o banco" é.

Por isso as medidas abaixo descrevem **comportamentos que um teste ou um log consegue
provar**, e não números de latência. O projeto ainda não mediu tempos de resposta sob carga,
e uma meta numérica sem medição seria inventada. As metas numéricas ficam no documento de
SLOs ([slos-observabilidade.md](slos-observabilidade.md)), que define como medir cada uma.

Cada cenário indica se está **implementado** ou se é uma **meta**, e onde está a evidência.

---

## QS-1 — Desempenho: catálogo servido pelo cache

| Parte | Descrição |
|---|---|
| **Fonte** | Cliente navegando na loja, na web ou no app |
| **Estímulo** | Repete a listagem de produtos, a busca ou os destaques |
| **Artefato** | Serviço Loja: `produto.controller.ts` e `utils/cache.ts` |
| **Ambiente** | Operação normal, Redis disponível |
| **Resposta** | A primeira requisição consulta o MySQL e grava o resultado no Redis. As seguintes são servidas pelo Redis até o TTL expirar ou um produto mudar |
| **Medida** | Dentro do TTL de **5 minutos**, a segunda requisição idêntica não consulta o MySQL, e o log registra `Cache hit`. Depois de uma edição de produto, a próxima leitura já traz o dado novo, porque o evento `produto.atualizado.v1` invalida as chaves |

**Status:** implementado.

**Evidência:** `TechAcademy5back/src/__tests__/cache.test.ts` ("retorna o valor do cache hit
sem consultar a origem"), `produto-cache.integration.test.ts` e
`cache-invalidation.test.ts`.

O dado pode ficar até 5 minutos desatualizado se mudar por um caminho que não publica o
evento. O TTL limita esse atraso, e as categorias, que mudam menos, usam 30 minutos
([ADR-001](adr/001-redis-cache-e-eventos.md)).

---

## QS-2 — Disponibilidade: o Redis cai

| Parte | Descrição |
|---|---|
| **Fonte** | Falha de infraestrutura |
| **Estímulo** | O container do Redis para de responder |
| **Artefato** | Serviço Loja: leituras de catálogo e categorias |
| **Ambiente** | Operação degradada |
| **Resposta** | A Loja percebe que o Redis não está pronto, consulta o MySQL direto e registra a falha no log. A navegação continua funcionando, mais lenta |
| **Medida** | Nenhuma rota de catálogo responde erro 5xx por causa da queda do Redis. O log mostra `Falha ao ler cache; consultando MySQL` ou apenas `Cache miss` |

**Status:** implementado para as leituras.

**Evidência:** `cache.test.ts` ("continua pela origem quando Redis está indisponível").

**Efeito colateral conhecido:** o Redis também é o broker de eventos. Durante a queda, os
eventos publicados se perdem, porque o Pub/Sub não guarda mensagens. Um pedido criado nesse
intervalo não chega ao serviço de Pagamentos. A Loja registra
`Evento de pedido não entregue` no log, mas não tenta de novo. É uma limitação registrada no
[ADR-001](adr/001-redis-cache-e-eventos.md), e corrigi-la exigiria outbox ou fila durável.

---

## QS-3 — Disponibilidade: o Mercado Pago fica lento ou fora

| Parte | Descrição |
|---|---|
| **Fonte** | Sistema externo (Mercado Pago) |
| **Estímulo** | A API demora a responder, devolve erro 5xx ou não responde |
| **Artefato** | Serviço de Pagamentos: `services/mercado-pago.service.ts` |
| **Ambiente** | Operação normal do PC Forge, parceiro degradado |
| **Resposta** | A chamada é interrompida por timeout e repetida só se a falha for transitória. Depois de várias falhas seguidas, o circuit breaker abre e o serviço passa a responder 503 na hora, sem chamar o Mercado Pago, até testar de novo |
| **Medida** | Nenhuma requisição de checkout fica pendurada além do limite de tempo das tentativas. Com o circuito aberto, a resposta 503 sai sem espera. O log registra a abertura e o fechamento do circuito |

**Status:** **meta, ainda não implementada.** Depende da SCRUM-35.

Hoje a chamada em `mercado-pago.service.ts:111` é um `fetch` sem limite de tempo. Se o
Mercado Pago parar de responder, a requisição do cliente espera até o cliente HTTP desistir.
Os valores sugeridos na SCRUM-35 são 5 s de timeout por tentativa, 2 novas tentativas e
circuito aberto após 5 falhas seguidas, por 30 s. Com eles, o pior caso de espera fica em
torno de 15 s mais o intervalo entre tentativas.

Este é o cenário com mais peso na rubrica de resiliência, porque o Mercado Pago é o único
ponto do sistema que depende de uma API de terceiros.

---

## QS-4 — Segurança: acesso administrativo sem permissão

| Parte | Descrição |
|---|---|
| **Fonte** | Usuário autenticado sem o papel de administrador, ou alguém sem token |
| **Estímulo** | Chama uma rota protegida, como criar produto ou mudar o status de um pedido |
| **Artefato** | `config/auth.middleware.ts` (`authMiddleware` e `authorizePermission`) |
| **Ambiente** | Operação normal |
| **Resposta** | Sem token, ou com token inválido, a requisição é recusada com **401**. Com token válido mas sem a permissão exigida, é recusada com **403**. Em nenhum dos dois casos a operação chega a ser executada |
| **Medida** | Todas as tentativas sem permissão são recusadas e nada é gravado no banco. Um token sem a lista de permissões é tratado como token sem permissão, e não como token confiável |

**Status:** implementado.

**Evidência:** `rbac-authorize.test.ts` e `auth-admin.test.ts`. As permissões ficam em
tabela, e não fixas no código ([rbac.md](rbac.md)).

---

## QS-5 — Disponibilidade: o serviço de Notificações cai

| Parte | Descrição |
|---|---|
| **Fonte** | Falha de infraestrutura |
| **Estímulo** | O serviço de Notificações ou o banco dele para |
| **Artefato** | Serviço de Notificações |
| **Ambiente** | Operação degradada |
| **Resposta** | A Loja e o Pagamentos continuam funcionando. Ninguém depende de Notificações para concluir uma compra |
| **Medida** | O fluxo de compra completo funciona com Notificações parado. Os eventos publicados durante a queda não entram no histórico |

**Status:** implementado, por desenho.

É a consequência direta de Notificações ser um subdomínio *generic*, que só escuta
([ddd-context-map.md](ddd-context-map.md)). Os outros serviços não sabem que ele existe:
apenas publicam no Redis. Os eventos perdidos durante a queda são a mesma limitação do
Pub/Sub descrita no QS-2.

---

## Resumo

| Cenário | Atributo | Status | Evidência |
|---|---|---|---|
| QS-1 | Desempenho | implementado | `cache.test.ts`, `produto-cache.integration.test.ts` |
| QS-2 | Disponibilidade | implementado (leituras) | `cache.test.ts` |
| QS-3 | Disponibilidade | **meta** | depende da SCRUM-35 |
| QS-4 | Segurança | implementado | `rbac-authorize.test.ts`, `auth-admin.test.ts` |
| QS-5 | Disponibilidade | implementado | desenho dos contextos |

O que os cenários mostram juntos é uma escolha deliberada: o sistema prefere **continuar
atendendo com algo degradado** a parar de vez. Um cache que falha vira leitura do banco. Um
serviço de histórico que cai não impede a venda. O ponto fraco que sobra é o Pub/Sub, que
troca garantia de entrega por simplicidade, e essa troca está registrada no ADR-001.

## Referências

- [ADR-001 — Redis como cache e broker](adr/001-redis-cache-e-eventos.md)
- [ADR-002 — corte em 3 microsserviços](adr/002-corte-microsservicos.md)
- [Context Map e Bounded Contexts](ddd-context-map.md)
- [RBAC](rbac.md)
- BASS, Len; CLEMENTS, Paul; KAZMAN, Rick. *Software Architecture in Practice* — cenários
  de atributos de qualidade
