require('dotenv').config();

const { MongoClient } = require('mongodb');

if (!process.env.MONGO_URI) {
  throw new Error('Defina MONGO_URI no arquivo .env antes de consultar o banco.');
}

async function mostrarAmostra() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();

  try {
    const db = client.db(process.env.MONGO_DB_NAME || 'marketplace');
    const colecoes = ['usuarios', 'produtos', 'pedidos'];
    const resultado = {};

    for (const nome of colecoes) {
      const colecao = db.collection(nome);
      resultado[nome] = {
        total: await colecao.countDocuments(),
        documento: await colecao.findOne(),
        indices: await colecao.listIndexes().toArray(),
      };
    }
    console.dir(resultado, { depth: null, colors: true });
  } finally {
    await client.close();
  }
}

mostrarAmostra().catch((erro) => {
  console.error('Erro ao consultar amostra:', erro.message);
  process.exit(1);
});
