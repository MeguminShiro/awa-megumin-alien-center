import fs from 'fs/promises';
import path from 'path';

async function fetchGiveaways() {
    let page = 1;
    const MAX_PAGES = 100;
    const outputPath = path.join(process.cwd(), 'data');
    const jsonFile = path.join(outputPath, 'ga_list.json');
    let existingData = { giveaways: {} };
    try {
        const fileContent = await fs.readFile(jsonFile, 'utf8');
        existingData = JSON.parse(fileContent);
        console.log(`Loaded ${Object.keys(existingData.giveaways).length} existing GAs.`);
    } catch (e) {console.log("No existing List found. Starting fresh…");}
    while (page <= MAX_PAGES) {
        try {
            const url = `https://na.alienwarearena.com/esi/featured-tile-data/Giveaway/${page}`;
            const res = await fetch(url, {
                headers: {
                    "accept": "*/*",
                    "x-requested-with": "XMLHttpRequest",
                    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}});
            if (!res.ok) break;
            const data = await res.json();
            const items = Array.isArray(data) ? data : (data.data || []);
            if (items.length === 0) break;
            for (const item of items) {
                existingData.giveaways[item.id] = {
                    id: item.id,
                    title: item.title || item.name || "",
                    url: item.url || `https://na.alienwarearena.com/ucf/show/${item.id}`,
                    tier: item.tier || 0,
                    arp: item.arp || 0,
                    type: item.type || "giveaway",
                    status: "active"};}
            page++;
            await new Promise(r => setTimeout(r, 1000));
        } catch (err) {break;}}
    const outputData = {
        last_updated: Date.now(),
        total: Object.keys(existingData.giveaways).length,
        giveaways: existingData.giveaways};
    await fs.mkdir(outputPath, { recursive: true });
    await fs.writeFile(jsonFile, JSON.stringify(outputData, null, 2));
    console.log(`Successfully saved ${outputData.total} total GAs`);}
fetchGiveaways();
