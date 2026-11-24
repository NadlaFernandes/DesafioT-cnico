require('dotenv').config();

const assert = require('node:assert/strict');
const { MongoClient, ObjectId } = require('mongodb');
const { criarPedidoCheckout } = require('./checkout-transacional');

if (!process.env.MONGO_URI) {
  throw new Error('Defina MONGO_URI no arquivo .env antes de executar a demonstração.');
}

const USER_ID = new ObjectId('665000000000000000000401');
const PRODUCT_ID = new ObjectId('665000000000000000000501');

async function executarDemonstracao() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();

  try {
    // Fixture isolada: não altera os bancos usados pelas tarefas anteriores.
    const db = client.db(process.env.MONGO_DB_NAME_TAREFA4 || 'marketplace_tarefa4');
    const users = db.collection('users');
    const products = db.collection('products');
    const orders = db.collection('orders');

    await Promise.all([
      users.replaceOne({ _id: USER_ID }, {
        _id: USER_ID,
        name: 'Cliente Teste Tarefa 4',
        email: 'tarefa4@exemplo.com',
        city: 'São Paulo',
        walletBalance: 500,
      }, { upsert: true }),
      products.replaceOne({ _id: PRODUCT_ID }, {
        _id: PRODUCT_ID,
        sku: 'SKU-TAREFA4',
        name: 'Produto Teste Transacional',
        category: 'Eletrônicos',
        price: 100,
        stock: 10,
        active: true,
      }, { upsert: true }),
      orders.deleteMany({ userId: USER_ID }),
    ]);

    console.log(`Banco isolado: ${db.databaseName}`);
    console.log('CENÁRIO INICIAL');
    console.log({ saldo: 500, estoque: 10, pedidos: 0 });

    const pedido = await criarPedidoCheckout({
      client, db, userId: USER_ID, productId: PRODUCT_ID, quantity: 2,
    });
    const aposSucesso = {
      saldo: (await users.findOne({ _id: USER_ID })).walletBalance,
      estoque: (await products.findOne({ _id: PRODUCT_ID })).stock,
      pedidos: await orders.countDocuments({ userId: USER_ID }),
    };
    assert.equal(aposSucesso.saldo, 300);
    assert.equal(aposSucesso.estoque, 8);
    assert.equal(aposSucesso.pedidos, 1);
    assert.equal(pedido.status, 'PAID');
    console.log('\nCHECKOUT BEM-SUCEDIDO');
    console.dir({ pedido, estado: aposSucesso }, { depth: null, colors: true });

    const antesRollback = { ...aposSucesso };
    try {
      await criarPedidoCheckout({
        client,
        db,
        userId: USER_ID,
        productId: PRODUCT_ID,
        quantity: 1,
        falharDepoisDoEstoque: true,
      });
      throw new Error('A falha simulada não foi disparada.');
    } catch (erro) {
      if (!erro.message.includes('Falha simulada')) throw erro;
      console.log('\nFalha simulada dentro da transação:', erro.message);
    }

    const depoisRollback = {
      saldo: (await users.findOne({ _id: USER_ID })).walletBalance,
      estoque: (await products.findOne({ _id: PRODUCT_ID })).stock,
      pedidos: await orders.countDocuments({ userId: USER_ID }),
    };
    assert.deepEqual(depoisRollback, antesRollback);
    console.log('ROLLBACK COMPROVADO: saldo, estoque e pedidos permaneceram iguais.');
    console.dir(depoisRollback, { depth: null, colors: true });
  } finally {
    await client.close();
  }
}

executarDemonstracao().catch((erro) => {
  if (erro.message.includes('Transaction numbers are only allowed')) {
    console.error('A demonstração precisa de MongoDB em replica set ou Atlas; o servidor atual está standalone.');
    console.error('Ative o replica set rs0, atualize MONGO_URI com ?replicaSet=rs0 e tente novamente.');
  } else {
    console.error('Erro na demonstração transacional:', erro.message);
  }
  process.exit(1);
});
