import fs from 'fs/promises';
import path from 'path';

async function fetchGiveaways() {
    let page = 1;
    const MAX_PAGES = 100;
    const outputPath = path.join(process.cwd(), 'data');
    const jsonFile = path.join(outputPath, 'ga_list.json');
    let existingData = { giveaways: {}, initial_scan_complete: false };
    try {
        const fileContent = await fs.readFile(jsonFile, 'utf8');
        existingData = JSON.parse(fileContent);
        if (!existingData.giveaways) existingData.giveaways = {};
        console.log('Loaded ' + Object.keys(existingData.giveaways).length + ' existing GAs.');
    } catch (e) {console.log('No existing List found. Starting fresh.');}
    const fullScanDone = existingData.initial_scan_complete === true;
    if (fullScanDone) {
        console.log('Initial scan already complete. Only checking for new GAs.');
    } else {
        console.log('Initial scan NOT complete. Will fetch ALL pages.');}
    let newCount = 0;
    while (page <= MAX_PAGES) {
        try {
            const url = 'https://na.alienwarearena.com/esi/featured-tile-data/Giveaway/' + page;
            const res = await fetch(url, {
                headers: {
                    'accept': '*/*',
                    'x-requested-with': 'XMLHttpRequest',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}});
            if (!res.ok) break;
            const data = await res.json();
            const items = Array.isArray(data) ? data : (data.data || []);
            if (items.length === 0) {
                console.log('Page ' + page + ' is empty. Reached the end.');
                if (!fullScanDone) {
                    existingData.initial_scan_complete = true;
                    console.log('Initial scan is now COMPLETE.');}
                break;}
            let foundNewOnThisPage = false;
            for (const item of items) {
                if (existingData.giveaways[item.id]) continue;
                foundNewOnThisPage = true;
                newCount++;
                existingData.giveaways[item.id] = {
                    id: item.id,
                    title: item.title || item.name || '',
                    url: item.url || ('https://na.alienwarearena.com/ucf/show/' + item.id),
                    tier: item.tier || 0,
                    arp: item.arp || 0,
                    type: item.type || 'giveaway',
                    status: 'active'};}
            if (fullScanDone && !foundNewOnThisPage) {
                console.log('Page ' + page + ' has no new GAs. Stopping early.');
                break;}
            console.log('Page ' + page + ': ' + (foundNewOnThisPage ? 'found new GAs' : 'no new, but continuing full scan') + '.');
            page++;
            await new Promise(r => setTimeout(r, 1000));
        } catch (err) {
            console.log('Error on page ' + page + '. Stopping.');
            break;}}
    if (newCount > 0 || !fullScanDone) {
        const outputData = {
            last_updated: Date.now(),
            total: Object.keys(existingData.giveaways).length,
            initial_scan_complete: existingData.initial_scan_complete,
            giveaways: existingData.giveaways};
        await fs.mkdir(outputPath, { recursive: true });
        await fs.writeFile(jsonFile, JSON.stringify(outputData, null, 2));
        console.log('Saved. Added ' + newCount + ' new GAs. Total: ' + outputData.total);
    } else {
        console.log('No new GAs found. File unchanged.');}}
fetchGiveaways();
