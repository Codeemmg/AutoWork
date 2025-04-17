// userContextManager.js

const { getUserData, updateUserData } = require("../database/userRepository");

/**
 * Obtém o contexto do usuário
 * @param {string} userId - ID do usuário (número do WhatsApp)
 * @returns {Promise<Object>} - Contexto do usuário
 */
async function getUserContext(userId) {
  try {
    // Obter dados do usuário da base
    const userData = await getUserData(userId);
    
    if (!userData) {
      // Usuário novo, criar contexto inicial
      return createInitialContext(userId);
    }
    
    // Formatar contexto com as informações relevantes
    const context = {
      userId,
      name: userData.name || "usuário",
      isNewUser: false,
      balance: calculateBalance(userData.transactions || []),
      recentTransactions: getRecentTransactions(userData.transactions || []),
      recentInteractions: userData.recentInteractions || [],
      preferences: userData.preferences || {},
      currentMonth: {
        expenses: calculateMonthlyExpenses(userData.transactions || []),
        income: calculateMonthlyIncome(userData.transactions || [])
      }
    };
    
    return context;
    
  } catch (error) {
    console.error("Erro ao obter contexto do usuário:", error);
    // Contexto minimal em caso de erro
    return {
      userId,
      isNewUser: false,
      balance: 0,
      recentTransactions: [],
      recentInteractions: []
    };
  }
}

/**
 * Cria contexto inicial para um novo usuário
 */
async function createInitialContext(userId) {
  const initialContext = {
    userId,
    isNewUser: true,
    balance: 0,
    recentTransactions: [],
    recentInteractions: [],
    preferences: {
      notificationEnabled: true,
      summaryFrequency: "weekly"
    }
  };
  
  // Salvar contexto inicial na base
  await updateUserData(userId, {
    isActive: true,
    createdAt: new Date(),
    preferences: initialContext.preferences
  });
  
  return initialContext;
}

/**
 * Atualiza o contexto do usuário com novas interações
 * @param {string} userId - ID do usuário
 * @param {Object} interaction - Nova interação a ser registrada
 */
async function updateUserContext(userId, interaction) {
  try {
    // Obter contexto atual
    const currentContext = await getUserContext(userId);
    
    // Limitar array de interações recentes (manter apenas as últimas 10)
    const recentInteractions = [interaction, ...(currentContext.recentInteractions || [])].slice(0, 10);
    
    // Atualizar na base
    await updateUserData(userId, {
      recentInteractions,
      lastInteractionAt: new Date()
    });
    
    return true;
  } catch (error) {
    console.error("Erro ao atualizar contexto do usuário:", error);
    return false;
  }
}

/**
 * Calcula o saldo atual do usuário
 */
function calculateBalance(transactions) {
  if (!transactions || transactions.length === 0) {
    return 0;
  }
  
  return transactions.reduce((balance, transaction) => {
    if (transaction.type === 'income') {
      return balance + transaction.amount;
    } else {
      return balance - transaction.amount;
    }
  }, 0);
}

/**
 * Obtém as transações recentes
 */
function getRecentTransactions(transactions) {
  if (!transactions || transactions.length === 0) {
    return [];
  }
  
  // Ordenar por data (mais recentes primeiro) e pegar as 5 últimas
  return [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);
}

/**
 * Calcula despesas do mês atual
 */
function calculateMonthlyExpenses(transactions) {
  if (!transactions || transactions.length === 0) {
    return 0;
  }
  
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  return transactions
    .filter(t => {
      const transactionDate = new Date(t.date);
      return t.type === 'expense' &&
             transactionDate.getMonth() === currentMonth &&
             transactionDate.getFullYear() === currentYear;
    })
    .reduce((total, t) => total + t.amount, 0);
}

/**
 * Calcula receitas do mês atual
 */
function calculateMonthlyIncome(transactions) {
  // Similar ao calculateMonthlyExpenses, mas para receitas
  // ...
  
  return 0; // implementação simplificada
}

module.exports = {
  getUserContext,
  updateUserContext
};