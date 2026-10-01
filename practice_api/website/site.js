function followHash() { const id = location.hash.slice(1); const el = document.getElementById(id); if (el?.tagName === 'DETAILS') el.open = true; }
addEventListener('hashchange', followHash); followHash();
