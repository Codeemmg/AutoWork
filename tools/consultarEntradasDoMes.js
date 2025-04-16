const db = require('../db');
const moment = require('moment');

async function consultarEntradasDoMes() {
  const inicioMes = moment().startOf('month').format('YYYY-MM-DD 00:00:00');
  const fimMes = moment().endOf('month').format('YYYY-MM-DD 23:59:59');

  try {
    const [dados] = await db.query(
      `SELECT SUM(valor) as total, COUNT(*) as quantidade
       FROM registros
       WHERE tipo = 'entrada' AND data BETWEEN ? AND ?`,
      [inicioMes, fimMes]
    );

    const total = parseFloat(dados[0].total) || 0;
    const quantidade = parseInt(dados[0].quantidade) || 0;

    return `📈 *Entradas do Mês*\n\n💰 Total: *R$ ${total.toFixed(2)}*\n📦 Lançamentos: ${quantidade}`;
  } catch (err) {
    console.error("❌ Erro ao consultar entradas do mês:", err.message);
    return "❌ Erro ao consultar as entradas do mês.";
  }
}

module.exports = consultarEntradasDoMes;
