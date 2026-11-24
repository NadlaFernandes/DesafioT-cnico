# Tarefa 4 — Consistência e transações ACID

O checkout está implementado em `scripts/checkout-transacional.js` usando uma sessão MongoDB e `session.withTransaction()`. A transação lê o produto e o usuário, valida estoque e carteira, debita os dois valores com `$inc` condicionais e insere o pedido com status `PAID`. Se uma validação falhar, uma atualização concorrente invalidar uma condição ou uma gravação gerar erro, a exceção sai do callback e `withTransaction()` aborta a transação.

Os filtros das atualizações repetem as condições `stock >= quantity` e `walletBalance >= total`. Isso protege contra saldo/estoque consumidos por outro checkout entre a leitura e o débito; se a atualização não modificar exatamente um documento, a operação é abortada. O débito de estoque e o de carteira não ficam parcialmente confirmados.

## Compatibilidade do MongoDB

Transações multi-documento exigem MongoDB em replica set ou cluster sharded. MongoDB Atlas atende; uma instalação local Community pode usar um replica set de nó único. Um servidor standalone não aceita `withTransaction()`.

### Ativar replica set no MongoDB Community local

1. Abra `services.msc`, localize o serviço MongoDB e pare-o.
2. Nas propriedades do serviço, consulte **Path to executable** e localize o arquivo indicado pelo argumento `--config` (normalmente `mongod.cfg` dentro da pasta de instalação).
3. Abra `mongod.cfg` como administrador e acrescente na raiz do YAML:

   ```yaml
   replication:
     replSetName: rs0
   ```

4. Salve e inicie novamente o serviço MongoDB.
5. No MongoDB Compass, conecte a `mongodb://localhost:27017` e abra o MongoDB Shell integrado (ou use `mongosh`). Execute uma vez:

   ```javascript
   rs.initiate()
   ```

   Aguarde o nó assumir o estado `PRIMARY` (`rs.status()` permite conferir).
6. No `.env` do projeto, configure:

   ```env
   MONGO_URI=mongodb://localhost:27017/?replicaSet=rs0
   ```

   O banco da demonstração continua sendo escolhido pelo script (`marketplace_tarefa4`).

## Executar demonstração reproduzível

Com `MONGO_URI` configurada no `.env` e MongoDB em replica set/Atlas:

```powershell
npm.cmd run checkout:demo
```

O script usa o banco isolado `marketplace_tarefa4`. Ele configura um usuário com carteira de 500 e um produto com preço 100 e estoque 10; confirma um checkout de duas unidades (saldo 300, estoque 8 e um pedido `PAID`); depois injeta uma falha após o débito de estoque dentro da transação e verifica por assert que saldo, estoque e quantidade de pedidos não mudaram. Reexecutar a demonstração reinicia apenas esses dados de teste no banco `marketplace_tarefa4`.

## Executar checkout com IDs existentes

O comando recebe `userId`, `productId` e quantidade como argumentos. Os IDs precisam existir em `users` e `products` no banco configurado para a Tarefa 2:

```powershell
npm.cmd run checkout -- <userId> <productId> <quantity>
```

O pedido é gravado em `orders` com `userId`, cidade de entrega, itens, total, data e status `PAID`.

## Evidências

Capturar a saída de `npm.cmd run checkout:demo`: o estado inicial, o checkout aprovado com o pedido `PAID`, e a mensagem de rollback comprovado com saldo, estoque e número de pedidos inalterados após a falha simulada.
