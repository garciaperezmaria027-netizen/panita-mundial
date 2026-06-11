const axios = require('../../node_modules/axios');

async function testBing() {
  try {
    const r = await axios.default.get('https://www.bing.com/search', {
      params: { q: 'FIFA World Cup 2026 top scorers goals' },
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000
    });
    const html = r.data;
    // Buscar links de resultados de Bing
    const linkRegex = /<h2[^>]*><a[^>]+href="(https?[^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>/gi;
    const snippetRegex = /<p[^>]+class="[^"]*b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
    
    const links = [];
    let m;
    while ((m = linkRegex.exec(html)) !== null && links.length < 5) {
      if (m[1].includes('bing.com') || m[1].includes('microsoft.com')) continue;
      links.push({ url: m[1], title: m[2].replace(/<[^>]+>/g, '').trim() });
    }
    
    const snippets = [];
    let sm;
    while ((sm = snippetRegex.exec(html)) !== null && snippets.length < 5) {
      snippets.push(sm[1].replace(/<[^>]+>/g, '').trim());
    }
    
    console.log('BING OK - resultados:', links.length);
    links.slice(0, 3).forEach((l, i) => {
      console.log(i+1, '|', l.title.substring(0, 60));
      console.log('   URL:', l.url.substring(0, 80));
      if (snippets[i]) console.log('   Snippet:', snippets[i].substring(0, 100));
    });
  } catch(e) {
    console.log('BING FAIL:', e.message, e.response ? 'HTTP ' + e.response.status : '');
  }
}

async function testYahooRSS() {
  try {
    const r = await axios.default.get('https://news.search.yahoo.com/rss', {
      params: { p: 'FIFA World Cup 2026 top scorers' },
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml,application/xml' },
      timeout: 8000
    });
    // Extraer items del RSS
    const xml = r.data;
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let im;
    while ((im = itemRegex.exec(xml)) !== null && items.length < 5) {
      const item = im[1];
      const title = (item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || item.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
      const link = (item.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
      const desc = (item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || [])[1] || '';
      if (title) items.push({ title: title.trim(), link: link.trim(), snippet: desc.replace(/<[^>]+>/g, '').trim().substring(0, 150) });
    }
    console.log('\nYAHOO RSS OK - items:', items.length);
    items.slice(0, 3).forEach((it, i) => {
      console.log(i+1, '|', it.title.substring(0, 80));
      if (it.snippet) console.log('   Snippet:', it.snippet.substring(0, 100));
    });
  } catch(e) {
    console.log('YAHOO RSS FAIL:', e.message, e.response ? 'HTTP ' + e.response.status : '');
  }
}

async function testGoogleNews() {
  try {
    const r = await axios.default.get('https://news.google.com/rss/search', {
      params: { q: 'FIFA World Cup 2026 top scorers', hl: 'es', gl: 'CO', ceid: 'CO:es' },
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml,application/xml' },
      timeout: 8000
    });
    const xml = r.data;
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let im;
    while ((im = itemRegex.exec(xml)) !== null && items.length < 5) {
      const item = im[1];
      const title = (item.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
      const link = (item.match(/<link>([\s\S]*?)<\/link>/) || item.match(/<link\/>([^<]+)/) || [])[1] || '';
      if (title) items.push({ title: title.replace(/<[^>]+>/g,'').trim(), link: link.trim() });
    }
    console.log('\nGOOGLE NEWS RSS OK - items:', items.length);
    items.slice(0, 3).forEach((it, i) => {
      console.log(i+1, '|', it.title.substring(0, 80));
    });
  } catch(e) {
    console.log('GOOGLE NEWS RSS FAIL:', e.message, e.response ? 'HTTP ' + e.response.status : '');
  }
}

testBing();
testYahooRSS();
testGoogleNews();
