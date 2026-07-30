const fs = require('fs');
const kuPath = 'c:/Users/Diwan-ashley/OneDrive/Ashley_Archive_Cloud/OneDrive/DAro/ashley project/New-Ashley-main/New-Ashley-main/src/locales/ku.json';
const ku = JSON.parse(fs.readFileSync(kuPath, 'utf8'));

const keys = Object.keys(ku);
const mapKeys = keys.filter(k => k.toLowerCase().includes('map') || 
                             k.toLowerCase().includes('floor') || 
                             k.toLowerCase().includes('area') ||
                             k.toLowerCase().includes('location') ||
                             k.toLowerCase().includes('warehouse') ||
                             k.toLowerCase().includes('qty') ||
                             k.toLowerCase().includes('quantity') ||
                             k.toLowerCase().includes('rack') ||
                             k.toLowerCase().includes('bin') ||
                             ku[k].includes('کۆگا') ||
                             ku[k].includes('نهۆم') ||
                             ku[k].includes('ناوچە') ||
                             ku[k].includes('شوێن')
);

console.log(JSON.stringify(mapKeys.reduce((acc, k) => {
    acc[k] = ku[k];
    return acc;
}, {}), null, 2));
