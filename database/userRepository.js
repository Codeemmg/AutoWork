// database/userRepository.js

const db = require('./connection');
const { getUserTransactions } = require('./transactionRepository');

/**
 * Obtém dados completos do usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object|null>} Dados do usuário ou null se não encontrado
 */
async function getUserData(userId) {
  try {
    // Buscar dados básicos do usuário
    const userData = await db.users.get(userId);
    
    if (!userData) {
      return null;
    }
    
    // Buscar transações do usuário
    const transactions = await getUserTransactions(userId);
    
    // Retornar dados completos
    return {
      ...userData,
      transactions
    };
  } catch (error) {
    console.error('Erro ao buscar dados do usuário:', error);
    return null;
  }
}

/**
 * Atualiza dados do usuário
 * @param {string} userId - ID do usuário
 * @param {Object} data - Dados a serem atualizados
 * @returns {Promise<boolean>} Sucesso da operação
 */
async function updateUserData(userId, data) {
  try {
    // Adicionar data de atualização
    const updatedData = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    
    // Buscar dados atuais do usuário
    const currentData = await db.users.get(userId);
    
    if (!currentData) {
      // Se usuário não existe, criar com dados iniciais
      updatedData.createdAt = updatedData.updatedAt;
      updatedData.isActive = true;
    }
    
    // Salvar dados atualizados
    const result = await db.users.save(userId, updatedData);
    
    return result;
  } catch (error) {
    console.error('Erro ao atualizar dados do usuário:', error);
    return false;
  }
}

module.exports = {
  getUserData,
  updateUserData
};