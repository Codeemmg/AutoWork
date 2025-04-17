// database/transactionRepository.js

const db = require('./connection');

/**
 * Salva uma transação para um usuário
 * @param {string} userId - ID do usuário
 * @param {Object} transaction - Dados da transação
 * @returns {Promise<Object>} Resultado da operação
 */
async function saveTransaction(userId, transaction) {
  try {
    // Adicionar campos adicionais
    const transactionWithMeta = {
      ...transaction,
      createdAt: new Date().toISOString()
    };
    
    const result = await db.transactions.save(userId, transactionWithMeta);
    
    return { 
      success: result,
      id: transactionWithMeta.id
    };
  } catch (error) {
    console.error('Erro ao salvar transação:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtém todas as transações de um usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<Array>} Array de transações
 */
async function getUserTransactions(userId) {
  try {
    return await db.transactions.getByUser(userId);
  } catch (error) {
    console.error('Erro ao buscar transações do usuário:', error);
    return [];
  }
}

/**
 * Calcula saldo atual do usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<number>} Saldo atual
 */
async function getUserBalance(userId) {
  try {
    const transactions = await db.transactions.getByUser(userId);
    
    return transactions.reduce((balance, transaction) => {
      if (transaction.type === 'income') {
        return balance + transaction.amount;
      } else {
        return balance - transaction.amount;
      }
    }, 0);
  } catch (error) {
    console.error('Erro ao calcular saldo do usuário:', error);
    return 0;
  }
}

module.exports = {
  saveTransaction,
  getUserTransactions,
  getUserBalance
};