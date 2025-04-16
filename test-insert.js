const db = require('./db');
const moment = require('moment');

async function testInsert() {
  const data = moment().format('YYYY-MM-DD HH:mm:ss');
  try {
    const [res] = await db.execute(
      'INSERT INTO registros (cliente, produto, valor, tipo, data) VALUES (?, ?, ?, ?, ?)',
      ['Teste Bot', 'Produto X', 123.45, 'entrada', data]
    );
    console.log('✅ Registro salvo. ID:', res.insertId);
  } catch (err) {
    console.error('❌ Erro no insert:', err.message);
  }
}

testInsert();
