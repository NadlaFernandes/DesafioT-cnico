# Tarefa 2 — Aggregation Framework

Os dois relatórios são executados no servidor MongoDB com `aggregate()`. A aplicação não carrega os pedidos para calcular os totais; recebe apenas os resultados agregados.

## Critérios e pipelines

### 1. Faturamento por categoria

O pipeline filtra pedidos criados nos últimos 90 dias e com status `PAID`, `SHIPPED` ou `DELIVERED`. Depois expande `items`, agrupa pela categoria gravada no item do pedido, soma `unitPrice * quantity` como faturamento e soma `quantity` como itens vendidos. Por fim, ordena pelo faturamento decrescente.

Stages usados: `$match`, `$unwind`, `$group`, `$sort` e `$project`.

### 2. Clientes VIP de São Paulo

O pipeline agrupa pedidos por `userId`, calcula `totalAmount` gasto e quantidade de pedidos, associa cada grupo a `users` por `_id`, mantém clientes cuja cidade é `São Paulo`, ordena pelo total gasto decrescente e usa `$facet` para retornar a página e o total de clientes elegíveis na mesma consulta. Como o enunciado não limita o status deste ranking, são considerados todos os pedidos existentes.

Stages usados: `$group`, `$lookup`, `$unwind`, `$match`, `$sort`, `$facet`, `$skip`, `$limit` e `$project`.

## Execução e evidências

O script `scripts/seed-tarefa2.js` cria um conjunto isolado no banco `marketplace_tarefa2`, com as coleções `products`, `users` e `orders` no formato necessário. Ele não apaga os dados das outras tarefas. Os pedidos incluem os status e campos de itens usados pelos pipelines.

Na raiz do projeto, com o MongoDB Server rodando e `MONGO_URI` configurada no `.env`, executar:

```powershell
npm.cmd install
npm.cmd run seed:tarefa2
npm.cmd run relatorios:tarefa2
```

Para consultar outra página, por exemplo a página 2:

```powershell
$env:RELATORIO_PAGINA = '2'
npm.cmd run relatorios:tarefa2
Remove-Item Env:RELATORIO_PAGINA
```

O banco pode ser conferido no Compass em `marketplace_tarefa2`, nas coleções `products`, `users` e `orders`.

Capturar evidências de: (1) seed concluído com as contagens 1.000, 5.000 e 100.000; (2) saída completa dos dois relatórios, incluindo categorias/faturamento/itens e, no ranking, os clientes, gastos, quantidade de pedidos e total de elegíveis. Os valores variam a cada seed porque os dados são gerados aleatoriamente.
