# Runbook de incidentes

O que fazer quando o PC Forge cai. Entrega da SCRUM-38.

Os comandos rodam **na raiz do repositório**, onde fica o `docker-compose.yml`. Os nomes de serviço
são os do Compose: `mysql`, `redis`, `pagamentos-db`, `notificacoes-db`, `backend` (Loja),
`payments`, `notifications`, `frontend` e `nginx`.

## Primeiro passo, em qualquer incidente

```bash
docker compose ps
```

Olhe as colunas de estado e de saúde:

| O que aparece | O que significa |
|---|---|
| `Up` com `(healthy)` | o container está de pé e o healthcheck passa |
| `Up` com `(unhealthy)` | o processo existe, mas não responde, como um banco travado |
| `Restarting` | o processo morre ao subir e o Docker tenta de novo: veja os logs |
| `Exited` | parou e não voltou |

Depois, os logs do serviço suspeito:

```bash
docker compose logs --tail 100 <serviço>
```

Só a Loja escreve logs em JSON com `requestId`. Nos outros serviços, procure pelas mensagens em
texto citadas abaixo ([observabilidade](slos-observabilidade.md#o-que-cada-serviço-já-coleta)).

Os incidentes abaixo seguem a mesma ordem: **sintoma → diagnóstico → ação → como confirmar que
voltou**.

---

## 1. Redis fora do ar

**Sintoma.** A loja continua funcionando, só que mais lenta, porque cada leitura do catálogo vai
ao MySQL. Pedidos são gravados, mas o pagamento não é criado e o histórico de Notificações para de
crescer.

**Diagnóstico.**

```bash
docker compose ps redis
docker compose logs --tail 50 backend | grep -E "Cache miss|Falha ao ler cache|Redis"
docker compose logs --tail 50 backend | grep "Evento de pedido não entregue"
```

Se o `redis` não estiver `(healthy)` e a Loja registrar `Falha ao ler cache` ou
`Evento de pedido não entregue`, o incidente é este.

**Ação.**

```bash
docker compose restart redis
docker compose restart payments notifications
```

A Loja reconecta sozinha, porque tem `reconnectStrategy`
(`TechAcademy5back/src/config/redis.ts`). Pagamentos e Notificações são reiniciados de
propósito: reiniciar garante que os dois voltam a assinar os canais de eventos.

**Confirmação.**

- `docker compose logs --tail 20 backend` mostra `Conexão com Redis estabelecida.`
- duas chamadas seguidas a `GET http://localhost:8080/api/produtos`: a segunda gera `Cache hit` no
  log da Loja.

**Depois que voltar: os pedidos órfãos.** O Pub/Sub do Redis não guarda mensagens
([ADR-001](adr/001-redis-cache-e-eventos.md)). Os pedidos criados durante a queda existem na Loja,
mas não em Pagamentos. Para encontrá-los, compare as duas listas:

```bash
# pedidos pendentes na Loja desde o início da queda (ajuste o horário)
docker compose exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" \
  -e "SELECT id_pedido, data_pedido FROM pedido WHERE status = \"pendente\" AND data_pedido >= \"2026-11-10 20:00:00\""'

# pedidos que Pagamentos conhece
docker compose exec pagamentos-db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" \
  -e "SELECT id_pedido FROM pagamentos ORDER BY id_pedido DESC LIMIT 50"'
```

Um pedido que aparece só na primeira lista ficou órfão. O sistema não tem como reenviar o evento
automaticamente, então o admin cancela o pedido pelo painel e o cliente refaz a compra. Esse
procedimento manual é o custo da escolha registrada no ADR-001.

---

## 2. Banco de um serviço fora do ar

Cada serviço tem o próprio banco ([ADR-003](adr/003-banco-de-dados-por-servico.md)), então a queda
afeta **só o dono**:

| Banco | Serviço afetado | O que o cliente vê |
|---|---|---|
| `mysql` | Loja | catálogo, login e pedidos com erro 5xx. O catálogo em cache continua respondendo até o TTL expirar |
| `pagamentos-db` | Pagamentos | o checkout falha. O resto da loja funciona |
| `notificacoes-db` | Notificações | nada. O histórico de eventos para de crescer |

**Diagnóstico.**

```bash
docker compose ps mysql pagamentos-db notificacoes-db
docker compose logs --tail 50 <banco>
```

**Ação.**

```bash
docker compose restart <banco>
```

Espere o banco ficar `(healthy)` em `docker compose ps`. Se o serviço dono continuar respondendo
com erro depois disso, reinicie o serviço também, por exemplo `docker compose restart backend`.

**Atenção.** Se o banco ficar em `Restarting` e o log reclamar de `MYSQL_USER`, alguém definiu
`MYSQL_USER=root` no `.env`. A imagem do MySQL 8 recusa esse valor. Remova a variável e rode
`docker compose up -d <banco>`.

**Confirmação.** A taxa de erro volta para perto de zero
([comando de medição](slos-observabilidade.md#como-medir-com-o-que-já-existe)), e uma compra de
teste com `cliente@pcforge.com` vai até o fim.

---

## 3. Mercado Pago lento ou fora

**Sintoma.** O cliente clica em pagar e a tela fica carregando. O resto da loja funciona
normalmente.

**Diagnóstico.**

```bash
docker compose logs --tail 100 payments
```

Se o `payments` estiver `(healthy)` e a loja funcionar, mas o pagamento travar, a causa está na API
externa.

**Ação, hoje.** A chamada ao Mercado Pago **ainda não tem limite de tempo**
(`TechAcademy5payments/src/services/mercado-pago.service.ts:111`). Não há o que fazer no PC Forge
além de esperar a API do Mercado Pago voltar e avisar os clientes. Reiniciar o `payments` não
ajuda, porque o problema está fora do sistema.

**Ação, depois da SCRUM-35.** Com timeout, retry e circuit breaker, o checkout passa a responder
**503** na hora, em vez de travar. O log registra a abertura do circuito. A ação continua sendo
esperar, mas o cliente recebe uma resposta clara, e o circuito testa de novo sozinho
([QS-3](quality-scenarios.md#qs-3--disponibilidade-o-mercado-pago-fica-lento-ou-fora)).

**Confirmação.** Um pagamento de teste é criado, e o log de `payments` deixa de registrar falhas na
chamada externa.

---

## 4. Serviço não sobe depois de um deploy

**Sintoma.** Logo depois de `docker compose up -d --build`, um serviço aparece como `Restarting`
ou `Exited`.

**Diagnóstico.**

```bash
docker compose ps
docker compose logs --tail 100 <serviço>
```

As causas mais comuns no projeto, e o que procurar no log:

| No log | Causa | Correção |
|---|---|---|
| `Falha ao iniciar o servico de Pagamentos` / `Falha ao iniciar o serviço de Notificações` | banco ou Redis ainda não estavam de pé | espere as dependências ficarem `(healthy)` e rode `docker compose restart <serviço>` |
| erro de variável de ambiente (`JWT_SECRET`, `DB_HOST`…) | `.env` sem a variável nova | compare com `.env.example` |
| erro de `npm ci` no build | dependência quebrada | o deploy não deveria ter passado pelo CI. Faça rollback |

**Ação.** Se a causa não for óbvia em cinco minutos, **faça rollback primeiro e investigue
depois**. Investigar com o sistema fora custa mais do que voltar para a versão anterior.

---

## 5. Gateway fora do ar

**Sintoma.** Nada responde em `http://localhost:8080` nem em `https://localhost`, nem mesmo a
página inicial.

**Diagnóstico.**

```bash
docker compose ps nginx
docker compose logs --tail 50 nginx
docker compose exec nginx nginx -t
```

O `nginx -t` valida a configuração. Erro nele significa que alguém mexeu em `nginx/nginx.conf` e
quebrou a sintaxe.

O `nginx` também espera o `payments` ficar `(healthy)` antes de subir (`depends_on` no Compose).
Se o `payments` não sobe, o gateway inteiro fica fora. Nesse caso, resolva primeiro o incidente 4
no `payments`.

**Ação.** Corrija a configuração ou reverta o arquivo com `git checkout -- nginx/nginx.conf`. Depois
rode `docker compose restart nginx`.

**Confirmação.** `curl -I http://localhost:8080/api/produtos` responde `200`.

---

## Rollback

O procedimento de hoje volta para a última versão marcada
([versionamento](gestao/versionamento.md)):

```bash
git fetch --tags
git checkout v2.0.0                       # a última tag estável
docker compose up -d --build <serviço>    # só o que quebrou
docker compose ps                         # confirme (healthy)
```

Funciona, mas tem custo: enquanto o container novo é construído e sobe, o serviço fica fora do ar.
A estratégia blue/green da SCRUM-37 vai substituir este procedimento por uma troca sem
indisponibilidade, mantendo a versão anterior de pé até a nova estar saudável.

Depois do rollback, volte para a branch de trabalho (`git checkout dev`). Abra um card no Jira com
a causa, para o defeito não voltar no próximo deploy.

## Depois de qualquer incidente

1. Anote o início, o fim e a causa no card do Jira.
2. Calcule quanto do orçamento de erro o incidente consumiu
   ([SLOs](slos-observabilidade.md#orçamento-de-erro-o-que-fazer-quando-ele-acaba)).
3. Se a causa é nova, acrescente-a a este runbook.
