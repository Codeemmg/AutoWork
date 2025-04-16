const db = require('../db');
const moment = require('moment');

async function registerSale(cliente, produto, valor, tipo = 'entrada') {
  const data = moment().format('YYYY-MM-DD HH:mm:ss');

  try {
    const [resultado] = await db.query(
      'INSERT INTO registros (cliente, produto, valor, tipo, data) VALUES (?, ?, ?, ?, ?)',
      [cliente, produto, valor, tipo, data]
    );

    console.log('✅ Registro salvo. ID:', resultado.insertId);
  } catch (err) {
    console.error('❌ Erro ao salvar no banco:', err);
    throw err;
  }
}

module.exports = registerSale;
