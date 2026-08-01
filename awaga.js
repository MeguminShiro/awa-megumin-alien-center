import fs from 'fs/promises';
import path from 'path';

function cleanTitle(raw) {
    if (!raw) return '';
    return raw.replace(/ Key Giveaway$/i, '').replace(/ Giveaway$/i, '').trim();}
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
    return { tier, arp };}
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
    } catch (e) {console.log('❌ No List found. Starting New.');}
    const fullScanDone = existingData.initial_scan_complete === true;
    if (fullScanDone) {
        console.log('☑️ Initial scan complete. Checking new GAs…');
    } else {
        console.log('⚠️ Initial scan NOT COMPLETE. Fetching all pages…');}
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
                    console.log('✅ Initial scan COMPLETED.');}
                break;}
            let foundNewOnThisPage = false;
            for (const item of items) {
                if (existingData.giveaways[item.id]) continue;
                foundNewOnThisPage = true;
                newCount++;
                const { tier, arp } = parseTierArp(item);
                const entry = { id: item.id, title: cleanTitle(item.title || item.name) };
                if (tier) entry.tier = tier;
                if (arp) entry.arp = arp;
                existingData.giveaways[item.id] = entry;}
            if (fullScanDone && !foundNewOnThisPage) {
                console.log('Page ' + page + ' has no new GAs. Stopping early.');
                break;}
            console.log('Page ' + page + ': ' + (foundNewOnThisPage ? 'found new GAs' : 'no new, continuing full scan') + '.');
            page++;
            await new Promise(r => setTimeout(r, 1000));
        } catch (err) {
            console.log('Error on page ' + page + '. Stopping.');
            break;}}
    if (newCount > 0 || existingData.initial_scan_complete !== fullScanDone) {
        const outputData = {
            last_updated: Date.now(),
            total: Object.keys(existingData.giveaways).length,
            initial_scan_complete: existingData.initial_scan_complete,
            giveaways: existingData.giveaways};
        await fs.mkdir(outputPath, { recursive: true });
        await fs.writeFile(jsonFile, JSON.stringify(outputData, null, 2));
        console.log('Saved. Added ' + newCount + ' new GAs. Total: ' + outputData.total);
    } else {
        console.log('⭕ No new GAs found. File unchanged.');}}
fetchGiveaways();
