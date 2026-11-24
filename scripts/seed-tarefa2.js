require('dotenv').config();

const { MongoClient, ObjectId } = require('mongodb');

const TOTAL_PRODUTOS = 1000;
const TOTAL_USUARIOS = 5000;
const TOTAL_PEDIDOS = 100000;
const TAMANHO_LOTE = 10000;
const CATEGORIAS = ['Eletrônicos', 'Livros', 'Casa e Cozinha', 'Esportes', 'Moda'];
const STATUS = ['PAID', 'PENDING', 'SHIPPED', 'DELIVERED', 'CANCELED'];
const CIDADES = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre', 'Recife'];

if (!process.env.MONGO_URI) {
  throw new Error('Defina MONGO_URI no arquivo .env antes de executar o seed da Tarefa 2.');
}

const inteiroAleatorio = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const itemAleatorio = (itens) => itens[Math.floor(Math.random() * itens.length)];

async function inserirEmLotes(colecao, documentos) {
  for (let inicio = 0; inicio < documentos.length; inicio += TAMANHO_LOTE) {
    await colecao.insertMany(documentos.slice(inicio, inicio + TAMANHO_LOTE), { ordered: false });
  }
}

async function executarSeed() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();

  try {
    // Banco separado para não apagar nem misturar os dados das outras tarefas.
    const db = client.db(process.env.MONGO_DB_NAME_TAREFA2 || 'marketplace_tarefa2');
    const productsCollection = db.collection('products');
    const usersCollection = db.collection('users');
    const ordersCollection = db.collection('orders');

    // Reexecutar o seed substitui apenas os dados destas três coleções.
    await Promise.all([
      productsCollection.deleteMany({}),
      usersCollection.deleteMany({}),
      ordersCollection.deleteMany({}),
    ]);

    const products = Array.from({ length: TOTAL_PRODUTOS }, (_, indice) => ({
      _id: new ObjectId(),
      sku: `SKU-${String(indice + 1).padStart(5, '0')}`,
      name: `Produto Exemplo ${indice + 1}`,
      category: itemAleatorio(CATEGORIAS),
      price: Number((Math.random() * 500 + 20).toFixed(2)),
      stock: inteiroAleatorio(10, 500),
      sellerId: `SELLER-${inteiroAleatorio(1, 50)}`,
      active: Math.random() > 0.1,
    }));
    await inserirEmLotes(productsCollection, products);

    const users = Array.from({ length: TOTAL_USUARIOS }, (_, indice) => ({
      _id: new ObjectId(),
      name: `Cliente ${indice + 1}`,
      email: `cliente${indice + 1}@exemplo.com`,
      city: itemAleatorio(CIDADES),
      walletBalance: Number((Math.random() * 2000 + 100).toFixed(2)),
      createdAt: new Date(Date.now() - inteiroAleatorio(0, 365) * 86400000),
    }));
    await inserirEmLotes(usersCollection, users);

    const agora = Date.now();
    for (let inicio = 0; inicio < TOTAL_PEDIDOS; inicio += TAMANHO_LOTE) {
      const tamanho = Math.min(TAMANHO_LOTE, TOTAL_PEDIDOS - inicio);
      const orders = Array.from({ length: tamanho }, () => {
        const user = itemAleatorio(users);
        const quantidadeProdutos = inteiroAleatorio(1, 4);
        const items = Array.from({ length: quantidadeProdutos }, () => {
          const product = itemAleatorio(products);
          return {
            productId: product._id,
            sku: product.sku,
            category: product.category,
            unitPrice: product.price,
            quantity: inteiroAleatorio(1, 3),
          };
        });
        const totalAmount = items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
        return {
          userId: user._id,
          shippingCity: user.city,
          status: itemAleatorio(STATUS),
          items,
          totalAmount: Number(totalAmount.toFixed(2)),
          createdAt: new Date(agora - inteiroAleatorio(0, 180) * 86400000),
        };
      });
      await ordersCollection.insertMany(orders, { ordered: false });
      console.log(`Pedidos inseridos: ${inicio + tamanho}/${TOTAL_PEDIDOS}`);
    }

    console.log(`Seed da Tarefa 2 concluído no banco ${db.databaseName}.`);
    console.table({
      products: await productsCollection.countDocuments(),
      users: await usersCollection.countDocuments(),
      orders: await ordersCollection.countDocuments(),
    });
  } finally {
    await client.close();
  }
}

executarSeed().catch((erro) => {
  console.error('Erro ao executar seed da Tarefa 2:', erro.message);
  process.exit(1);
});
