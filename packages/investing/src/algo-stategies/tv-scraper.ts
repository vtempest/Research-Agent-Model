import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';

const OUTPUT_PATH = path.join(process.cwd(), 'lib/algo-stategies/algo-strategies.json');

function loadExistingData() {
  if (!fs.existsSync(OUTPUT_PATH)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
    // Convert array to object keyed by URL for faster lookups
    const cache: any = {};
    if (Array.isArray(data)) {
      data.forEach((item: any) => {
        if (item.url) {
          cache[item.url] = item;
        }
      });
    }
    return cache;
  } catch {
    return {};
  }
}

// --- Fetch scripts using TradingView's JSON API ---

///https://s3.tradingview.com/m/mIEqLyjg_mid.webp?v=1765466633

async function fetchScriptsPage(page = 1, sortBy = '') {
  // Use TradingView's component-data-only JSON API endpoint
  const sortParam = sortBy ? `&sort=${sortBy}` : '';
  const url = page === 1 
    ? `https://www.tradingview.com/scripts/?component-data-only=1&script_type=strategies${sortParam}`
    : `https://www.tradingview.com/scripts/page-${page}/?component-data-only=1&script_type=strategies${sortParam}`;

  const res = await axios.get(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'application/json'
    }
  });

  const jsonData = res.data;
  
  // Extract the ideas array from the JSON response
  const items = jsonData?.data?.ideas?.data?.items || [];

  const ideas = items.map((item : any) => {
    // Extract user information
    const author = item.user?.username || null;
    
    // Build the full URL
    const fullUrl = item.chart_url || `https://www.tradingview.com/script/${item.image_url}/`;
    
    // Extract counts
    const likes = item.likes_count || 0;
    const comments_count = item.comments_count || 0;
    const image_url = item.image_url || null;
    
    // Simplify symbol object to only include essential fields
    let symbol = null;
    if (item.symbol) {
      symbol = {
        short_name: item.symbol.short_name || null,
        exchange: item.symbol.exchange || null,
        logo_urls: item.symbol.logo_urls ? [item.symbol.logo_urls[0]] : []
      };
    }
    
    return {
      url: fullUrl.split('script/')[1].replace(/\/$/, ''),
      name: item.name || null,
      description: item.description || null,
      image_url,  
      author,
      likes,
      type: item.script_type || null,
      // ...symbol
    };
  });

  return ideas;
}


async function enrichWithPineFacade(idea: any, cache: any) {
  // Check if we already have the source code for this script
  if (cache[idea.url] && cache[idea.url].source) {
    console.log(`Using cached data for ${idea.url}`);
    return cache[idea.url];
  }

  try {
    const fullUrl = `https://www.tradingview.com/script/${idea.url}`;
    const res = await axios.get(fullUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const html = res.data;

    const m = html.match(
      /"script_id_part"\s*:\s*"([^"]+)"(?:[^}]+?"version_maj"\s*:\s*(\d+))?/
    );
    if (!m) {
      console.log(`No script_id_part found for ${idea.url}`);
      return idea;
    }

    const scriptIdPart = m[1];
    const versionMaj = m[2] ? Number(m[2]) : 3;
    const encodedId = encodeURIComponent(scriptIdPart);

    const pineUrl = `https://pine-facade.tradingview.com/pine-facade/get/${encodedId}/${versionMaj}?no_4xx=true`;
    console.log(
      `Fetching pine-facade for ${idea.url} -> ${scriptIdPart} (version_maj=${versionMaj})`
    );

    const pineRes = await axios.get(pineUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const pineData = pineRes.data;

    let { created, updated, source } = pineData;

    created = new Date(created).toISOString().split("T")[0];
    updated = new Date(updated).toISOString().split("T")[0];
    

    const enriched = {
      ...idea,
        // created,
        updated,
        source
    };

    cache[idea.url] = enriched;
    console.log(`Enriched ${idea.url}`);

    return enriched;
  } catch (err : any) {
    console.log(`Error enriching ${idea.url}: ${err.message}`);
    return idea;
  }
}

async function run() {
  const cache = loadExistingData();
  
  // Parse CLI arguments
  const args = process.argv.slice(2);
  const sortArg = args.find(arg => arg.startsWith('--sort='));
  const sortBy = sortArg ? sortArg.split('=')[1] : '';
  
  // Map 'recent' to TradingView's actual parameter
  const sortParam = sortBy === 'recent' ? 'recent_extended' : sortBy;
  
  const pageArg = args.find(arg => arg.startsWith('--pages='));
  const maxPage = pageArg ? parseInt(pageArg.split('=')[1], 10) : 1;

  const pageNums = Array.from({ length: maxPage }, (_, i) => i + 1);
  const allIdeas: any[] = [];
  
  console.log(`Fetching TradingView scripts${sortParam ? ` (sorted by: ${sortParam})` : ''}...`);
  
  for (const p of pageNums) {
    console.log(`Fetching page ${p}...`);
    const ideas = await fetchScriptsPage(p, sortParam);
    allIdeas.push(...ideas);
  }

  console.log(`\nEnriching ${allIdeas.length} scripts with Pine Script source code...\n`);
  
  const results = [];
  for (const idea of allIdeas) {
    const enriched = await enrichWithPineFacade(idea, cache);
    results.push(enriched);
    // Update cache with new data
    cache[enriched.url] = enriched;
  }

  // Write the results to a single JSON file
  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(results, null, 2),
    'utf8'
  );

  console.log(`\nDone! Total items: ${results.length}`);
  console.log(`Output saved to: ${OUTPUT_PATH}`);
  
  const enrichedCount = results.filter(r => r.source).length;
  console.log(`Scripts with source code: ${enrichedCount}/${results.length}`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
