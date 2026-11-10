# SLOs, SLIs e plano de observabilidade

Como saber se o PC Forge está saudável, e o que coletar para descobrir quando não está. Entrega da
SCRUM-34.

## Os três termos

| Termo | O que é | Exemplo |
|---|---|---|
| **SLI** (*indicador*) | Um número medido do sistema | 95% das listagens responderam em até 180 ms |
| **SLO** (*objetivo*) | A meta para esse número, numa janela de tempo | p95 abaixo de 300 ms em 7 dias |
| **Orçamento de erro** | O quanto se pode falhar sem quebrar o SLO | com 99% de disponibilidade, 1% das sondas pode falhar |

O SLO é um compromisso interno. Ele não é uma promessa contratual, que seria um SLA, e o projeto
não tem SLA.

## SLIs e SLOs

| SLI | Como medir hoje | SLO | Janela |
|---|---|---|---|
| **Latência do catálogo** (`GET /produtos`) | `durationMs` do log da Loja, percentil 95 | p95 < **300 ms** | 7 dias |
| **Latência do checkout** (`POST /pedidos`) | `durationMs` do log da Loja, percentil 95 | p95 < **1 s** | 7 dias |
| **Taxa de erro** | respostas com `statusCode` ≥ 500 ÷ total de respostas | < **1%** | 7 dias |
| **Disponibilidade** | sonda que chama `GET http://localhost:8080/api/produtos` a cada minuto | ≥ **99%** das sondas com resposta 2xx | 30 dias |

### Por que essas metas

As metas não saíram de uma medição sob carga, porque o projeto ainda não fez essa medição. Saíram
de dois critérios que podem ser defendidos.

**Latência: os limites de percepção do usuário.** Nielsen descreve três limites: até 0,1 s parece
instantâneo, até 1 s mantém o fluxo de pensamento, e acima de 10 s o usuário desiste. A listagem do
catálogo é navegação e precisa parecer imediata. Como a resposta ainda atravessa a rede e a
renderização, o servidor tem bem menos de 1 s. Os 300 ms deixam margem para isso, e uma leitura
com cache hit fica muito abaixo desse valor ([QS-1](quality-scenarios.md)). O checkout grava
pedido, itens e baixa de estoque numa transação, e o usuário aceita esperar um pouco mais quando
clica em "finalizar". Por isso o limite é 1 s.

**Disponibilidade: o que a infraestrutura consegue sustentar.** 99% em 30 dias permite cerca de
**7 horas** fora do ar no mês. Parece pouco exigente, mas é a meta honesta para tudo rodando em um
único host, sem réplica de nenhum serviço. Uma meta de 99,9% (43 minutos por mês) exigiria
redundância que o projeto não tem. Prometê-la seria escrever um número que a arquitetura não
sustenta.

**Taxa de erro: 1%.** Um 5xx é sempre um defeito ou uma dependência fora. Os erros de entrada
(4xx) ficam de fora da conta, porque são o sistema recusando corretamente um pedido inválido
([QS-4](quality-scenarios.md)).

### Por que a disponibilidade é medida pelo catálogo

O catálogo é o caminho que todo cliente percorre, e a sonda passa pelo mesmo trajeto que ele:
gateway, Loja e, por trás dela, o Redis ou o MySQL. Se a sonda responde, a loja está de pé para
quem chega.

Pagamentos tem rota `/health`, mas ela **não é exposta pelo gateway**. O Nginx encaminha
`/api/pagamentos/` para `/pagamentos/` do serviço, e o `/health` fica na raiz. Ela é usada só pelo
healthcheck do Docker Compose. A saúde de Pagamentos aparece em `docker compose ps`, e não na sonda.

## Como medir com o que já existe

Cada requisição que chega à Loja gera uma linha de log em JSON
([`request-logging.middleware.ts`](../TechAcademy5back/src/middleware/request-logging.middleware.ts)):

```json
{"timestamp":"2026-11-10T21:00:00.000Z","level":"info","message":"Requisição HTTP concluída",
 "requestId":"7b1e…","method":"GET","path":"/produtos","statusCode":200,"durationMs":14}
```

Os comandos abaixo calculam os SLIs a partir desse log.

**p95 da latência do catálogo nas últimas 24 h:**

```bash
docker compose logs backend --since 24h --no-log-prefix \
  | grep '"method":"GET","path":"/produtos"' \
  | sed -E 's/.*"durationMs":([0-9]+).*/\1/' | sort -n \
  | awk '{v[NR]=$1} END {i=int(NR*0.95+0.999); print "p95:", v[i] " ms (" NR " requisições)"}'
```

Para o checkout, troque o filtro por `'"method":"POST","path":"/pedidos"'`.

**Taxa de erro nas últimas 24 h:**

```bash
docker compose logs backend --since 24h --no-log-prefix \
  | grep 'Requisição HTTP concluída' \
  | awk '/"statusCode":5/ {e++} END {printf "erros 5xx: %d de %d (%.2f%%)\n", e, NR, 100*e/NR}'
```

**Disponibilidade (sonda):**

```bash
while true; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/produtos >> sonda.log
  sleep 60
done
# depois: grep -c '^2' sonda.log dividido por wc -l sonda.log
```

São medições manuais, feitas em um terminal, e não monitoramento contínuo. Elas mostram que os
SLIs **podem** ser calculados com os dados que o sistema já produz. Calcular sozinho e alertar é o
que falta para produção, como explica a próxima seção.

## Orçamento de erro: o que fazer quando ele acaba

Se um SLO estoura na janela, a regra é simples: **para a funcionalidade nova, entra a
estabilidade.** O próximo card da sprint passa a ser a causa do estouro, que vai para o backlog com
prioridade alta. Sem essa regra, o SLO é só um número bonito no documento.

## Plano de observabilidade

### O que cada serviço já coleta

| Serviço | Logs | Métricas | Saúde |
|---|---|---|---|
| **Loja** | JSON com `timestamp`, `level`, `message`, `requestId`, rota, status e duração (SCRUM-26) | nenhuma, mas a duração no log substitui | **sem** healthcheck e **sem** rota `/health` |
| **Pagamentos** | texto livre via `console`, sem `requestId` | nenhuma | `GET /health` e healthcheck no Compose |
| **Notificações** | texto livre via `console`, sem `requestId` | nenhuma | sem healthcheck (não é servidor HTTP) |
| **Nginx** | access log no formato padrão, **sem** tempo de resposta | nenhuma | — |
| **MySQL ×3 e Redis** | logs do próprio container | nenhuma | healthcheck no Compose |

### A limitação principal: o `requestId` para na Loja

O id nasce no middleware da Loja e volta no cabeçalho `X-Request-Id`, mas:

- o **Nginx** não gera um id nem o repassa, então o mesmo pedido tem um id na Loja e nenhum no
  gateway;
- os **eventos** (`pedido.criado.v1` e os demais) não carregam o id, então, quando Pagamentos
  processa um pedido, não dá para ligar o log dele à requisição que criou esse pedido.

Na prática, investigar uma compra que falhou exige casar os logs dos serviços pelo `id_pedido` e
pelo horário, e não por um id comum. Funciona com três serviços e pouco tráfego, mas não escala.

### O que seria necessário em produção

Nada desta lista está implementado. Fica registrado como o próximo passo, em ordem de custo e
benefício:

| # | Ação | O que resolve |
|---|---|---|
| 1 | Nginx gera e repassa `X-Request-Id` (`$request_id`), e os eventos carregam esse id no payload | rastrear uma compra de ponta a ponta |
| 2 | Logger JSON em Pagamentos e Notificações, no mesmo formato da Loja | um único jeito de filtrar todos os logs |
| 3 | `$request_time` no `log_format` do Nginx | latência vista pelo cliente, incluindo o gateway |
| 4 | Rota `/health` na Loja e healthcheck no Compose | a Loja reiniciada automaticamente quando trava |
| 5 | Métricas com Prometheus (contador de requisições por status, histograma de duração) e painel no Grafana | SLIs calculados sozinhos, sem comando manual |
| 6 | Logs centralizados (Loki ou similar) e alerta quando o orçamento de erro baixar de 50% | descobrir o problema antes do cliente |

O item 1 vem primeiro porque é o mais barato e o que mais muda a investigação de incidentes. Os
itens 5 e 6 só se pagam com tráfego real.

## Relação com os outros documentos

- [Quality Scenarios](quality-scenarios.md): os cenários descrevem **comportamentos**, e este
  documento dá a **meta numérica** e a forma de medir.
- [Runbook de incidentes](runbook-incidentes.md): o que fazer quando um SLO estoura.
- [ADR-001](adr/001-redis-cache-e-eventos.md): por que a queda do Redis degrada a latência, mas não
  a disponibilidade.

## Referências

- BEYER, Betsy et al. *Site Reliability Engineering*. O'Reilly, 2016. Capítulo 4, *Service Level
  Objectives*.
- NIELSEN, Jakob. *Usability Engineering*. Morgan Kaufmann, 1993. Capítulo 5, sobre tempos de
  resposta.
