import fs from 'fs/promises';
import path from 'path';

function cleanTitle(raw) {
    if (!raw) return '';
    let title = raw.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
                   .replace(/[\uD800-\uDFFF]/g, '')
                   .replace(/^(?:Steam|DLC|Epic Games)\s*｜\s*/i, '')
                   .trim();
    title = title.replace(/ Key Giveaway$/i, '').replace(/ Giveaway$/i, '').trim();
    title = title.replace(/ Steam Playtest$/i, ' Playtest');
    title = title.replace(/ Steam Game Key$/i, '');
    title = title.replace(/ Steam Game$/i, '');
    title = title.replace(/ Steam$/i, '');
    title = title.replace(/ DLC$/i, '');
    title = title.replace(/ Epic Games?$/i, '');
    title = title.replace(/ Exclusive Alienware Game Pack$/i, '');
    title = title.replace(/ Exclusive Game Pack$/i, '');
    title = title.replace(/ Alienware Game Pack$/i, '');
    title = title.replace(/ Game Pack$/i, '');
    return title.trim();
}

function parseTierArp(item) {
    const text = ((item.description || '') + ' ' + (item.instructions || '')).trim();
    const arpMatch = text.match(/(?:spending|redeeming|costs?|requires(?: redeeming)?)\s*(\d+)\s*ARP/i)
        || text.match(/(\d+)\s*ARP\s*(?:to claim|required|for)/i);
    const tierMatch = text.match(/(?:Tier\s+|Level\s+)(\d+)/i);
    let tier = '';
    let arp = '';
    if (arpMatch) arp = arpMatch[1] + ' ARP';
    if (tierMatch) {
        tier = tierMatch[1] + '+';
    } else if (!arpMatch) {
        let fallback = item.tier || '1+';
        if (typeof fallback === 'string' && fallback.toLowerCase().startsWith('tier '))
            fallback = fallback.replace(/tier\s+/i, '') + '+';
        const num = String(fallback).match(/\d+/);
        tier = num ? num[0] + '+' : '1+';}
    return { tier, arp };
}

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
        for (const id in existingData.giveaways) {
            let item = existingData.giveaways[id];
            let changed = false;
            if (item.url) { delete item.url; changed = true; }
            if (item.type) { delete item.type; changed = true; }
            if (item.status) { delete item.status; changed = true; }
            if (item.id !== undefined) { delete item.id; changed = true; }
            if (item.tier === 0 || item.tier === '0') { delete item.tier; changed = true; }
            if (item.arp === 0 || item.arp === '0') { delete item.arp; changed = true; }
            const newTitle = cleanTitle(item.title);
            if (item.title !== newTitle) { item.title = newTitle; changed = true; }
        }
    } catch (e) {}
    const fullScanDone = existingData.initial_scan_complete === true;
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
                if (!fullScanDone) existingData.initial_scan_complete = true;
                break;}
            let foundNewOnThisPage = false;
            for (const item of items) {
                if (existingData.giveaways[item.id]) continue;
                foundNewOnThisPage = true;
                newCount++;
                const { tier, arp } = parseTierArp(item);
                const entry = { title: cleanTitle(item.title || item.name) };
                if (tier && tier !== '0' && tier !== '0+') entry.tier = tier;
                if (arp && arp !== '0' && arp !== '0 ARP') entry.arp = arp;
                existingData.giveaways[item.id] = entry;}
            if (fullScanDone && !foundNewOnThisPage) break;
            page++;
            await new Promise(r => setTimeout(r, 1000));
        } catch (err) {break;}}
    const outputData = {
        last_updated: Date.now(),
        total: Object.keys(existingData.giveaways).length,
        initial_scan_complete: existingData.initial_scan_complete,
        giveaways: existingData.giveaways};
    await fs.mkdir(outputPath, { recursive: true });
    await fs.writeFile(jsonFile, JSON.stringify(outputData, null, 2));
}
fetchGiveaways();
