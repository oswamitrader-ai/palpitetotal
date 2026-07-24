const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<body>
  <div id="search-input"></div>
  <div id="category-chips"></div>
  <div id="trending-section"></div>
  <div id="feed-list-header"></div>
  <div id="feed-list"></div>
</body>
</html>
`);
global.window = dom.window;
global.document = dom.window.document;
global.Date = Date;

const dbBets = [
  {
    "id": 26,
    "title": "Filme de maior bilheteria em 2026?",
    "description": "Filme de maior bilheteria em 2026?",
    "category": "Cultura",
    "creator_name": "Soberano Admin",
    "status": "OPEN",
    "is_trending": true,
    "total_pool": 2530,
    "created_at": "2026-07-22T22:05:20.897287+00:00",
    "bet_type": "CLASSIC"
  }
];

let store = { bets: [] };
let selectedCategory = 'Todos';

function renderBetCard(b) {
  return "<div>Card " + b.id + "</div>";
}

store.bets = dbBets.map(b => ({
  id: Number(b.id),
  title: b.title,
  description: b.description,
  category: b.category,
  creatorName: b.creator_name,
  status: b.status,
  isTrending: b.is_trending,
  totalPool: Number(b.total_pool) || 100,
  createdAt: new Date(b.created_at).getTime(),
  betType: b.bet_type || 'CLASSIC'
}));

function renderFeed() {
  const searchInput = document.getElementById('search-input');
  const query = (searchInput?.value || '').toLowerCase().trim();
  const openBets = store.bets.filter(b => b.status === 'OPEN');
  
  const counterBets = openBets.filter(b => b.betType === 'COUNTER');
  const classicBets = openBets.filter(b => b.betType !== 'COUNTER');

  console.log("classicBets:", classicBets.length);

  const filteredClassic = classicBets.filter(b => {
    const matchSearch = b.title.toLowerCase().includes(query) || b.description.toLowerCase().includes(query);
    const matchCat = selectedCategory === 'Todos' || b.category === selectedCategory;
    return matchSearch && matchCat;
  });

  console.log("filteredClassic:", filteredClassic.length);
}

renderFeed();
