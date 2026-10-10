# ADR-001: Redis como cache distribuído e broker de eventos

- **Status:** Aceita
- **Data:** 2026-10-09

## Contexto

A Loja precisa reduzir leituras repetidas de catálogo e categorias sem comprometer a
disponibilidade quando o cache estiver fora do ar. A Sprint 2 também precisa de um
meio leve de publicar eventos entre serviços. O MySQL continua sendo a fonte de
verdade; cache e mensagens não podem ser requisitos para servir leituras do banco.

## Decisão

Usar Redis 7 em um serviço próprio na rede privada do Docker Compose, com o cliente
oficial `redis` para Node.js. A aplicação utiliza cache-aside para leituras; uma
indisponibilidade do Redis resulta em consulta ao MySQL. Redis Pub/Sub será usado
para eventos na Sprint 2, quando os contratos e consumidores forem implementados.

O cache de produtos terá TTL de **5 minutos**: curto o suficiente para limitar a
desatualização de catálogo sem invalidar em toda leitura. Categorias terão TTL de
**30 minutos**, pois são alteradas com menor frequência. Escritas invalidam as
chaves relacionadas. Esses TTLs são limites de segurança, não substitutos da
invalidação após uma alteração.

## Alternativas consideradas

- **Cache em memória do processo:** simples, mas não compartilhado entre réplicas e
  perdido a cada reinício.
- **RabbitMQ para mensageria:** oferece filas duráveis e confirmações, porém adiciona
  complexidade que não se justifica para a escala acadêmica atual.
- **MySQL sem cache:** mantém a operação simples, mas não atende ao objetivo de
  demonstrar cache distribuído nem evita consultas repetidas.

## Consequências

- Redis é uma dependência operacional opcional para disponibilidade: em falhas, as
  leituras continuam no MySQL e erros de conexão são registrados nos logs.
- Pub/Sub não garante retenção nem entrega a consumidores desconectados. Eventos
  essenciais exigiriam uma estratégia durável (por exemplo, outbox/fila) antes de
  uso em produção.
- A invalidação de listas deve abranger todas as chaves paginadas da entidade.
- O Compose não publica a porta do Redis no host.
