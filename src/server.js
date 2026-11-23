const app = require('./app');

const porta = Number(process.env.PORT) || 3000;
app.listen(porta, () => {
  console.log(`Marketplace rodando em http://localhost:${porta}`);
});
