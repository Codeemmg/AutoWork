// database/categoryRepository.js

const db = require('./connection');

/**
 * Obtém todas as categorias disponíveis
 * @returns {Promise<Object>} Categorias divididas em expense e income
 */
async function getCategories() {
  try {
    const categories = await db.categories.getAll();
    return categories;
  } catch (error) {
    console.error('Erro ao buscar categorias:', error);
    
    // Retornar categorias padrão em caso de erro
    return {
      expense: [
        'Alimentação',
        'Transporte',
        'Moradia',
        'Saúde',
        'Educação',
        'Lazer',
        'Vestuário',
        'Outros Gastos'
      ],
      income: [
        'Salário',
        'Freelance',
        'Investimentos',
        'Outras Receitas'
      ]
    };
  }
}

/**
 * Adiciona uma nova categoria
 * @param {string} type - Tipo de categoria (expense/income)
 * @param {string} name - Nome da categoria
 * @returns {Promise<boolean>} Sucesso da operação
 */
async function addCategory(type, name) {
  try {
    if (type !== 'expense' && type !== 'income') {
      throw new Error('Tipo de categoria inválido');
    }
    
    const categories = await db.categories.getAll();
    
    if (!categories[type].includes(name)) {
      categories[type].push(name);
      await db.categories.save(categories);
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao adicionar categoria:', error);
    return false;
  }
}

module.exports = {
  getCategories,
  addCategory
};