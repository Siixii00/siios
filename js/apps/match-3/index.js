import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

const BOARD_SIZE = 7;
const FRUITS = ['🍎', '🍌', '🍇', '🍓', '🍊', '🍐'];

let board = [];
let score = 0;
let moves = 20;
let target = 800;
let selectedIndex = null;
let isAnimating = false;

async function loadGameState() {
  const saved = await SettingsDB.get('match3_state');
  if (saved) {
    score = saved.score || 0;
    moves = saved.moves || 20;
  }
}

async function saveGameState() {
  await SettingsDB.set('match3_state', { score, moves });
}

function getRandomFruit() {
  return FRUITS[Math.floor(Math.random() * FRUITS.length)];
}

function createBoard() {
  board = [];
  for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
    board.push({ fruit: getRandomFruit() });
  }
}

function getMatches() {
  const matches = new Set();
  
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE - 2; col++) {
      const idx = row * BOARD_SIZE + col;
      const fruit = board[idx].fruit;
      if (fruit === board[idx + 1].fruit && fruit === board[idx + 2].fruit) {
        matches.add(idx);
        matches.add(idx + 1);
        matches.add(idx + 2);
      }
    }
  }
  
  for (let col = 0; col < BOARD_SIZE; col++) {
    for (let row = 0; row < BOARD_SIZE - 2; row++) {
      const idx = row * BOARD_SIZE + col;
      const fruit = board[idx].fruit;
      if (fruit === board[(row + 1) * BOARD_SIZE + col].fruit && 
          fruit === board[(row + 2) * BOARD_SIZE + col].fruit) {
        matches.add(idx);
        matches.add((row + 1) * BOARD_SIZE + col);
        matches.add((row + 2) * BOARD_SIZE + col);
      }
    }
  }
  
  return Array.from(matches);
}

function areAdjacent(a, b) {
  const rowA = Math.floor(a / BOARD_SIZE);
  const colA = a % BOARD_SIZE;
  const rowB = Math.floor(b / BOARD_SIZE);
  const colB = b % BOARD_SIZE;
  return Math.abs(rowA - rowB) + Math.abs(colA - colB) === 1;
}

function resolveMatches() {
  let matches = getMatches();
  
  while (matches.length > 0) {
    score += matches.length * 30;
    
    matches.forEach(idx => {
      board[idx].fruit = null;
    });
    
    for (let col = 0; col < BOARD_SIZE; col++) {
      const column = [];
      for (let row = BOARD_SIZE - 1; row >= 0; row--) {
        const idx = row * BOARD_SIZE + col;
        if (board[idx].fruit) {
          column.push(board[idx].fruit);
        }
      }
      
      for (let row = BOARD_SIZE - 1; row >= 0; row--) {
        const idx = row * BOARD_SIZE + col;
        board[idx].fruit = column[BOARD_SIZE - 1 - row] || getRandomFruit();
      }
    }
    
    matches = getMatches();
  }
}

function renderBoard(container) {
  const boardEl = container.querySelector('.match-board');
  if (!boardEl) return;
  
  boardEl.innerHTML = board.map((cell, idx) => `
    <button class="tile ${selectedIndex === idx ? 'selected' : ''}" data-idx="${idx}">
      ${cell.fruit || ''}
    </button>
  `).join('');
  
  boardEl.querySelectorAll('.tile').forEach(tile => {
    tile.onclick = () => handleTileClick(container, parseInt(tile.dataset.idx));
  });
  
  const scoreEl = container.querySelector('.score-value');
  const movesEl = container.querySelector('.moves-value');
  const targetEl = container.querySelector('.target-value');
  
  if (scoreEl) scoreEl.textContent = score;
  if (movesEl) movesEl.textContent = moves;
  if (targetEl) targetEl.textContent = target;
}

function handleTileClick(container, idx) {
  if (isAnimating || moves <= 0) return;
  
  if (selectedIndex === null) {
    selectedIndex = idx;
    renderBoard(container);
    return;
  }
  
  if (selectedIndex === idx) {
    selectedIndex = null;
    renderBoard(container);
    return;
  }
  
  if (!areAdjacent(selectedIndex, idx)) {
    selectedIndex = idx;
    renderBoard(container);
    return;
  }
  
  const temp = board[selectedIndex];
  board[selectedIndex] = board[idx];
  board[idx] = temp;
  
  const matches = getMatches();
  if (matches.length === 0) {
    board[idx] = board[selectedIndex];
    board[selectedIndex] = temp;
    selectedIndex = null;
    renderBoard(container);
    return;
  }
  
  isAnimating = true;
  moves--;
  selectedIndex = null;
  resolveMatches();
  isAnimating = false;
  
  renderBoard(container);
  saveGameState();
  
  if (score >= target) {
    alert('🎉 達成目標！');
  } else if (moves <= 0) {
    alert('😢 步數用盡！');
  }
}

async function renderMatch3(params) {
  await loadGameState();
  createBoard();
  
  const container = createElement('div', 'app-container match3-app');
  
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn">
        <i class="fas fa-chevron-left"></i> 返回
      </button>
      <h1 class="menu-title">消消樂</h1>
    </header>
    
    <div class="page">
      <div class="game-info">
        <div class="info-item">
          <span class="info-label">分數</span>
          <span class="info-value score-value">${score}</span>
        </div>
        <div class="info-item">
          <span class="info-label">目標</span>
          <span class="info-value target-value">${target}</span>
        </div>
        <div class="info-item">
          <span class="info-label">步數</span>
          <span class="info-value moves-value">${moves}</span>
        </div>
      </div>
      
      <div class="match-board" style="grid-template-columns: repeat(${BOARD_SIZE}, 1fr);"></div>
      
      <button class="restart-btn">重新開始</button>
    </div>
  `;
  
  const backBtn = container.querySelector('.ios-back-btn');
  backBtn.onclick = () => Router.navigate('/');
  
  const restartBtn = container.querySelector('.restart-btn');
  restartBtn.onclick = () => {
    score = 0;
    moves = 20;
    createBoard();
    renderBoard(container);
    saveGameState();
  };
  
  renderBoard(container);
  
  return { element: container, cleanup: null };
}

export default {
  id: 'match-3',
  name: '消消樂',
  icon: 'puzzle-piece',
  routes: [{ path: '/match-3', render: renderMatch3 }],
  navItem: { label: '消消樂', icon: 'puzzle-piece', path: '/match-3', showInNav: true, order: 101 },
  styles: () => import('./style.css')
};