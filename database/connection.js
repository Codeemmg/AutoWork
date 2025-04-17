// database/connection.js

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Se você não está usando MySQL, adapte para o banco que estiver usando
// Esta é uma implementação simplificada usando arquivos JSON como "banco de dados"

// Caminhos para os arquivos JSON que servirão como "tabelas"
const DATA_DIR = path.join(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');

// Criar diretório de dados se não existir
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Inicializar arquivos se não existirem
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify({}));
}

if (!fs.existsSync(TRANSACTIONS_FILE)) {
  fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify({}));
}

if (!fs.existsSync(CATEGORIES_FILE)) {
  const defaultCategories = {
    expense: [
      'Alimentação', 'Transporte', 'Moradia', 'Saúde', 
      'Educação', 'Lazer', 'Vestuário', 'Outros Gastos'
    ],
    income: [
      'Salário', 'Freelance', 'Investimentos', 'Outras Receitas'
    ]
  };
  fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(defaultCategories));
}

// Funções de acesso ao "banco de dados"
async function readData(file) {
  try {
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Erro ao ler arquivo ${file}:`, error);
    return {};
  }
}

async function writeData(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Erro ao escrever arquivo ${file}:`, error);
    return false;
  }
}

module.exports = {
  users: {
    getAll: async () => readData(USERS_FILE),
    get: async (userId) => {
      const users = await readData(USERS_FILE);
      return users[userId] || null;
    },
    save: async (userId, userData) => {
      const users = await readData(USERS_FILE);
      users[userId] = { ...users[userId], ...userData };
      return writeData(USERS_FILE, users);
    }
  },
  transactions: {
    getAll: async () => readData(TRANSACTIONS_FILE),
    getByUser: async (userId) => {
      const transactions = await readData(TRANSACTIONS_FILE);
      return transactions[userId] || [];
    },
    save: async (userId, transaction) => {
      const transactions = await readData(TRANSACTIONS_FILE);
      if (!transactions[userId]) {
        transactions[userId] = [];
      }
      transaction.id = Date.now().toString(); // id único simples
      transactions[userId].push(transaction);
      return writeData(TRANSACTIONS_FILE, transactions);
    }
  },
  categories: {
    getAll: async () => readData(CATEGORIES_FILE),
    save: async (categories) => writeData(CATEGORIES_FILE, categories)
  }
};