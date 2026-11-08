# ADR-003: Um banco MySQL por serviço

- **Status:** Aceita
- **Data:** 2026-11-08

## Contexto

O [ADR-002](002-corte-microsservicos.md) dividiu o sistema em três serviços com uma regra
central: **nenhum serviço consulta o banco de outro**. Essa regra só se sustenta se cada
serviço tiver o próprio banco. Com um banco compartilhado, mesmo separado por schema, um
`JOIN` entre tabelas de serviços diferentes está sempre a uma linha de distância.

Faltava decidir **qual** banco cada serviço usa. Os três têm necessidades bem diferentes:

| Serviço | O que guarda | Do que precisa |
|---|---|---|
| **Loja** | clientes, produtos, pedidos, itens, RBAC | relações entre entidades e **transação ACID**: o pedido e a baixa de estoque são gravados juntos ou nenhum dos dois é (`TechAcademy5back/src/services/pedido.service.ts:179-217`) |
| **Pagamentos** | uma linha por pedido a cobrar | chave pelo id do pedido, a cópia dos itens recebida por evento e o status da cobrança |
| **Notificações** | o histórico dos eventos recebidos | só inserir e consultar por tipo e data |

A Loja vinha do monólito, que já usava MySQL 8 com Sequelize. Os outros dois serviços
nasceram sem dados para migrar, porque o pagamento nunca teve tabela própria: o estado dele
morava em `Pedido.status`.

## Decisão

**Cada serviço tem o próprio banco, em container e volume próprios, e os três usam MySQL 8.**

| Serviço | Container | Banco | Acesso |
|---|---|---|---|
| Loja | `mysql` | `TechAcademy5` | Sequelize, `dialect: "mysql"` |
| Pagamentos | `pagamentos-db` | `pcforge_pagamentos` | `mysql2` direto, sem ORM |
| Notificações | `notificacoes-db` | `pcforge_notificacoes` | `mysql2` direto, sem ORM |

**Na Loja, MySQL porque o problema é relacional.** Pedido, item, produto e cliente se
referenciam, e o invariante de estoque depende de uma transação que grave pedido, itens e
baixa de estoque de uma vez. O monólito já estava em MySQL, então manter evitou uma migração
que não trazia ganho.

**Nos serviços novos, MySQL pelo mesmo motivo de sempre ser um só.** Um motor de banco é
uma coisa a menos para a dupla aprender, configurar, inspecionar e explicar. Os dados
semiestruturados desses serviços, que são a cópia do pedido no Pagamentos e o payload de cada
evento em Notificações, cabem em colunas `JSON`. Isso dispensa um segundo tipo de banco.

**Sem ORM nos serviços novos.** Cada um tem uma ou duas tabelas e meia dúzia de consultas.
O `mysql2` com SQL escrito à mão é menor e mais legível que o Sequelize nesse tamanho.

## Alternativas consideradas

- **PostgreSQL nos serviços pequenos.** Era a ideia inicial do projeto, para gastar menos
  memória na máquina de desenvolvimento. Descartada porque somaria um segundo motor sem
  nenhum ganho funcional: nada nesses serviços precisa de recurso que o MySQL não tenha. O
  pacote `pg` ficou no `package.json` da Loja como resto dessa ideia e não é importado por
  nenhum arquivo. É dependência morta.
- **Um MySQL compartilhado, com um schema por serviço.** Economiza dois containers, mas
  enfraquece justamente a regra do ADR-002: nada impede um `JOIN` entre schemas, e a
  fronteira entre serviços passaria a depender só de disciplina.
- **Banco de documentos (como MongoDB) para Notificações.** Encaixa bem num log de eventos,
  que é append-only e sem relações. Mas a coluna `JSON` do MySQL atende ao mesmo caso, e um
  terceiro motor teria o mesmo custo do PostgreSQL.

## Consequências

- **Três containers de banco.** É o custo mais visível: mais memória e mais tempo para
  subir o ambiente. No escopo acadêmico é aceitável. Em produção, os bancos menores poderiam
  ser instâncias pequenas ou um serviço gerenciado.
- **Não existe `JOIN` entre serviços.** Quando o Pagamentos precisa do valor e dos itens de
  um pedido, recebe uma cópia pelo evento `pedido.criado.v1` e guarda na própria tabela.
  Essa duplicação é deliberada: é o preço de não ter acoplamento de banco.
- **O consumidor é idempotente pelo banco.** O Pagamentos grava a cópia com
  `INSERT IGNORE`, com o id do pedido como chave primária
  (`TechAcademy5payments/src/config/database.ts`). Se o mesmo evento chegar duas vezes, a
  segunda gravação é ignorada sem erro.
- **Não há migrations.** A Loja cria as tabelas com `sequelize.sync()` na inicialização e os
  outros dois serviços com `CREATE TABLE IF NOT EXISTS`. Funciona enquanto o schema só cresce,
  mas uma mudança de coluna em tabela existente exigiria intervenção manual. Em produção seria
  preciso uma ferramenta de migrations antes da primeira alteração de schema.
- **A dependência `pg` pode ser removida** da Loja sem efeito no código.

## Referências

- [ADR-001 — Redis como cache e broker](001-redis-cache-e-eventos.md)
- [ADR-002 — corte em 3 microsserviços](002-corte-microsservicos.md)
- [Contratos dos eventos](../contratos-eventos.md)
- RICHARDSON, Chris. *Microservices Patterns* — padrão *Database per Service*
