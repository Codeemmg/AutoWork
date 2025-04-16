const db = require('./db');

async function testarConexao() {
  try {
    const [rows] = await db.query('SELECT NOW() as agora');
    console.log('✅ Conectado com sucesso ao MySQL:', rows[0].agora);
  } catch (err) {
    console.error('❌ Falha ao conectar no MySQL:', err.message);
  }
}

testarConexao();
