# Estratégia de deploy e rollback

Entrega da SCRUM-37.

## Escopo e estado atual

O `docker-compose.yml` atual sobe uma única instância de `frontend`, `backend`,
`payments` e `notifications`. O `nginx/nginx.conf` encaminha o tráfego para esses
nomes fixos. Portanto, o Compose atual **não executa blue/green**. A estratégia abaixo
define o destino operacional; não afirma que a troca automatizada já está implementada.

## Estratégia blue/green

Manter duas versões dos serviços que atendem requisições (`frontend`, `backend` e
`payments`) conectadas à rede da aplicação. Os bancos (`mysql`, `pagamentos-db` e
`notificacoes-db`) e o Redis permanecem compartilhados; não se inicia uma segunda cópia
deles para cada cor. O Nginx permanece como único ponto de entrada público.

Uma cor recebe a release nova enquanto a outra continua atendendo. Depois de validar a
nova cor, o Nginx troca os upstreams dos serviços em conjunto:

- `/` e as rotas da loja apontam para o `frontend` da cor ativa;
- `/api/` e as rotas da Loja apontam para o `backend` da mesma cor;
- `/api/pagamentos` e `/pagamentos` apontam para o `payments` da mesma cor.

A configuração precisa manter o prefixo e as regras de proxy já existentes em
`nginx/nginx.conf`. Validar a nova cor antes do corte, sem expô-la pelo gateway público.
Identificar imagens por tag imutável de release (por exemplo, `v2.0.0`), não por
`latest`.

**Notificações é uma exceção.** O serviço consome eventos via Redis Pub/Sub; subir as
duas cores como consumidores ativos pode gravar o mesmo evento duas vezes em
`notificacoes-db`. Ele não recebe tráfego do Nginx, então deve permanecer com apenas
um consumidor ativo durante a troca. Antes de promover a nova instância, parar o
consumidor antigo e iniciar o novo; considerar que Pub/Sub não guarda mensagens e que
eventos publicados durante a transição podem se perder, conforme
[ADR-001](adr/001-redis-cache-e-eventos.md).

Alterações de banco precisam ser compatíveis com a versão antiga e a nova durante a
janela de rollback. Alterações destrutivas ficam para depois de encerrar essa janela.

### Publicação e corte

1. Confirmar que build e testes da release passaram no CI e registrar sua tag imutável.
2. Identificar a cor ativa e publicar `frontend`, `backend` e `payments` na cor inativa,
   sem parar a versão que atende tráfego.
3. Conferir os logs da nova cor e validar os serviços diretamente pela rede interna.
   A rota pública usada na sonda de disponibilidade é
   `GET http://localhost:8080/api/produtos`; para Pagamentos, verificar o healthcheck
   definido no Compose com `docker compose ps payments`.
4. Alterar os upstreams correspondentes em `nginx/nginx.conf`, sempre apontando Loja e
   Pagamentos para a mesma cor. Testar e aplicar a configuração:

   ```bash
   docker compose exec -T nginx nginx -t
   docker compose exec -T nginx nginx -s reload
   ```

5. Validar o catálogo pelo gateway e acompanhar os SLOs durante a janela de observação:

   ```bash
   curl -fsS http://localhost:8080/api/produtos
   docker compose ps
   docker compose logs --since=10m nginx backend payments
   ```

O corte só é aprovado enquanto os indicadores permanecem dentro das metas e janelas
definidas em [SLOs e SLIs](slos-observabilidade.md). Não criar limites diferentes neste
procedimento.

## Critério de rollback

Iniciar rollback se um SLO aplicável de
[SLOs e SLIs](slos-observabilidade.md) for violado na janela definida, se o smoke test
falhar de forma persistente, ou se a release impedir compra ou administração.
Indisponibilidade de fluxo crítico justifica rollback imediato, sem aguardar o fim da
janela.

## Procedimento de rollback

### Com duas cores disponíveis

1. Identificar a última release saudável e manter sua cor sem alterações.
2. Reapontar no `nginx/nginx.conf` os upstreams de `frontend`, `backend` e `payments`
   para essa mesma cor.
3. Validar a configuração e fazer o reload gracioso do Nginx:

   ```bash
   docker compose exec -T nginx nginx -t
   docker compose exec -T nginx nginx -s reload
   ```

4. Confirmar a saúde e os logs:

   ```bash
   docker compose ps
   docker compose logs --since=10m nginx backend payments
   curl -fsS http://localhost:8080/api/produtos
   ```

5. Manter a cor problemática isolada, registrar release, horário, SLO violado e logs, e
   seguir o [runbook de incidentes](runbook-incidentes.md).

### Enquanto houver apenas o Compose atual

O fluxo abaixo é o rollback disponível hoje. Ele pode causar indisponibilidade durante
o build e a recriação; não é blue/green:

```bash
git fetch --tags
git switch --detach v2.0.0
docker compose up -d --build backend payments frontend
docker compose ps
docker compose logs --since=10m nginx backend payments frontend
curl -fsS http://localhost:8080/api/produtos
```

Substituir `v2.0.0` pela última tag estável. Se só um serviço for afetado, recriar apenas
esse serviço; se a compatibilidade entre versões não for conhecida, voltar juntos
`frontend`, `backend` e `payments`. Depois da recuperação, retornar à branch de trabalho
antes de fazer novas alterações.

## Limitações para habilitar blue/green

O Compose e o Nginx atuais ainda precisam de configuração de deploy que permita subir as
duas cores na mesma rede, atribuir nomes/upstreams distintos e selecionar a cor ativa sem
recriar o gateway inteiro. Essa implementação é separada da configuração local e deve
ser tratada antes de anunciar blue/green como disponível. O processo atual de rollback e
os incidentes relacionados estão no [runbook](runbook-incidentes.md).
