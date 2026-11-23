require('dotenv').config();

const { MongoClient } = require('mongodb');

if (!process.env.MONGO_URI) {
  throw new Error('Defina MONGO_URI no arquivo .env antes de criar índices.');
}

async function criarIndices() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();

  try {
    const db = client.db(process.env.MONGO_DB_NAME || 'marketplace');
    await Promise.all([
      db.collection('usuarios').createIndex({ tipo: 1 }),
      db.collection('produtos').createIndex({ vendedorId: 1 }),
      db.collection('produtos').createIndex({ estoque: 1 }),
      db.collection('pedidos').createIndex({ compradorId: 1, data: -1 }),
      db.collection('pedidos').createIndex({ produtoId: 1, data: -1 }),
    ]);
    console.log('Índices criados com sucesso.');
  } finally {
    await client.close();
  }
}

criarIndices().catch((erro) => {
  console.error('Erro ao criar índices:', erro.message);
  process.exit(1);
});
