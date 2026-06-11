import axios from 'axios';

async function testDDGInstant(query: string) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
    console.log(`Querying DDG Instant Answers: ${url}`);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log('Abstract:', response.data.Abstract);
    console.log('AbstractText:', response.data.AbstractText);
    console.log('AbstractSource:', response.data.AbstractSource);
    console.log('RelatedTopics:', response.data.RelatedTopics?.slice(0, 3));
  } catch (err: any) {
    console.error('Error DDG Instant:', err.message);
  }
}

testDDGInstant('Colombia national football team');
