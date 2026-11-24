require('dotenv').config();

const { MongoClient, ObjectId } = require('mongodb');

class CheckoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CheckoutError';
  }
}

function converterObjectId(valor, nomeCampo) {
  if (!ObjectId.isValid(valor)) throw new CheckoutError(`${nomeCampo} inválido.`);
  return new ObjectId(valor);
}

/**
 * Cria pedido pago e debita produto/carteira como uma única transação.
 * A opção falharDepoisDoEstoque existe apenas para demonstrar rollback no script de teste.
 */
async function criarPedidoCheckout({ client, db, userId, productId, quantity, falharDepoisDoEstoque = false }) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new CheckoutError('quantity deve ser um inteiro maior que zero.');
  }

  const userObjectId = userId instanceof ObjectId ? userId : converterObjectId(userId, 'userId');
  const productObjectId = productId instanceof ObjectId ? productId : converterObjectId(productId, 'productId');
  const users = db.collection('users');
  const products = db.collection('products');
  const orders = db.collection('orders');
  const session = client.startSession();
  let pedidoCriado;

  try {
    await session.withTransaction(async () => {
      const produto = await products.findOne({ _id: productObjectId }, { session });
      if (!produto) throw new CheckoutError('Produto não encontrado.');
      if (produto.stock < quantity) throw new CheckoutError('Estoque insuficiente.');

      const usuario = await users.findOne({ _id: userObjectId }, { session });
      if (!usuario) throw new CheckoutError('Usuário não encontrado.');

      const total = Number((produto.price * quantity).toFixed(2));
      if (usuario.walletBalance < total) throw new CheckoutError('Saldo insuficiente na carteira.');

      // As condições nos filtros também protegem contra alterações concorrentes.
      const estoqueDebitado = await products.updateOne(
        { _id: productObjectId, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } },
        { session },
      );
      if (estoqueDebitado.modifiedCount !== 1) {
        throw new CheckoutError('Estoque alterado durante o checkout; operação cancelada.');
      }

      if (falharDepoisDoEstoque) throw new Error('Falha simulada após o débito do estoque.');

      const carteiraDebitada = await users.updateOne(
        { _id: userObjectId, walletBalance: { $gte: total } },
        { $inc: { walletBalance: -total } },
        { session },
      );
      if (carteiraDebitada.modifiedCount !== 1) {
        throw new CheckoutError('Saldo alterado durante o checkout; operação cancelada.');
      }

      const pedido = {
        userId: userObjectId,
        shippingCity: usuario.city,
        status: 'PAID',
        items: [{
          productId: produto._id,
          sku: produto.sku,
          category: produto.category,
          unitPrice: produto.price,
          quantity,
        }],
        totalAmount: total,
        createdAt: new Date(),
      };
      const resultado = await orders.insertOne(pedido, { session });
      pedidoCriado = { ...pedido, _id: resultado.insertedId };
    }, {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      readPreference: 'primary',
    });

    return pedidoCriado;
  } finally {
    await session.endSession();
  }
}

async function executarCheckoutCli() {
  const [userId, productId, quantityTexto] = process.argv.slice(2);
  if (!userId || !productId || !quantityTexto) {
    throw new Error('Uso: npm.cmd run checkout -- <userId> <productId> <quantity>');
  }
  const quantity = Number(quantityTexto);
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  try {
    const db = client.db(process.env.MONGO_DB_NAME_TAREFA2 || 'marketplace_tarefa2');
    const pedido = await criarPedidoCheckout({ client, db, userId, productId, quantity });
    console.log('Checkout concluído; pedido pago criado:');
    console.dir(pedido, { depth: null, colors: true });
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  if (!process.env.MONGO_URI) {
    console.error('Defina MONGO_URI no arquivo .env antes de executar o checkout.');
    process.exit(1);
  }
  executarCheckoutCli().catch((erro) => {
    if (erro.message.includes('Transaction numbers are only allowed')) {
      console.error('Checkout cancelado: o MongoDB conectado é standalone. Transações exigem replica set ou Atlas.');
      console.error('Ative o replica set rs0 e configure MONGO_URI com ?replicaSet=rs0.');
    } else {
      console.error('Checkout cancelado:', erro.message);
    }
    process.exit(1);
  });
}

module.exports = { CheckoutError, criarPedidoCheckout };
