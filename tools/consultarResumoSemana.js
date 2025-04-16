const db = require('../db');
const moment = require('moment');

async function consultarResumoSemana(telefone = 'desconhecido') {
  const hoje = moment();
  const inicioSemana = hoje.clone().startOf('isoWeek').format('YYYY-MM-DD 00:00:00');
  const fimSemana = hoje.clone().endOf('isoWeek').format('YYYY-MM-DD 23:59:59');

  try {
    const [entradas] = await db.query(
      `SELECT SUM(valor) as total FROM registros 
       WHERE tipo = 'entrada' AND data BETWEEN ? AND ?`,
      [inicioSemana, fimSemana]
    );

    const [saidas] = await db.query(
      `SELECT SUM(valor) as total FROM registros 
       WHERE tipo = 'saida' AND data BETWEEN ? AND ?`,
      [inicioSemana, fimSemana]
    );

    const totalEntradas = parseFloat(entradas[0].total) || 0;
    const totalSaidas = parseFloat(saidas[0].total) || 0;    
    const saldo = totalEntradas - totalSaidas;

    return `📊 *Resumo da Semana*\n\n📅 De: ${inicioSemana.split(" ")[0]} até ${fimSemana.split(" ")[0]}\n\n💰 *Entradas:* R$ ${totalEntradas.toFixed(2)}\n💸 *Saídas:* R$ ${totalSaidas.toFixed(2)}\n🧮 *Saldo:* R$ ${saldo.toFixed(2)}`;
  } catch (err) {
    console.error('Erro ao consultar resumo da semana:', err.message);
    return '❌ Erro ao gerar o resumo da semana.';
  }
}

module.exports = consultarResumoSemana;
