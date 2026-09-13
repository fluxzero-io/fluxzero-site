import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const source = resolve(process.argv[2] ?? '../fluxzero-auditlog/frontend/dist/monitoring-snapshots');
const titles = {trace:'Traces',audit:'Audit trail',logs:'Logs',issues:'Issues',documents:'Documents',insights:'Insights'};
const manifest = {};
await mkdir('public/monitoring-examples',{recursive:true});
for (const [view,title] of Object.entries(titles)) {
  manifest[view] = {title};
  for (const [variant,width] of [['desktop',1280],['mobile',390]]) {
    const snapshot = JSON.parse(await readFile(resolve(source,`${view}-${width}.json`),'utf8'));
    if (snapshot.view !== view || snapshot.width !== width || snapshot.height < 50) throw new Error(`Invalid ${view}-${variant} snapshot`);
    if (/<script\b|\son\w+=|(?:href|src)=["\x27]https?:\/\//i.test(snapshot.html)) throw new Error(`Unexpected executable or external content in ${view}`);
    manifest[view][variant] = {width,height:snapshot.height};
    snapshot.css = snapshot.css.split('\n').filter(line => line.trim()).join('\n');
    snapshot.html = snapshot.html.replace('Trace timeline. Pinch with two fingers to zoom, drag horizontally to move, and swipe vertically to scroll the page.', 'Trace timeline. Scroll horizontally to follow the flow.');
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} — ticketing example</title><style>${snapshot.css}\nhtml{overflow:hidden}body{width:${width}px;box-sizing:border-box;transform-origin:top left;overflow:hidden}.issues-table-wrap::before,.issues-mobile-inspect-hint,.dropdown-menu,.issue-row-actions,app-facet-filter-actions,.column-hide-btn{display:none!important}thead,th{position:static!important;inset:auto!important;transform:none!important}.waterfall-wrap--touch{overflow-x:auto!important;touch-action:pan-x!important}.demo-static-control{pointer-events:none}*{animation:none!important;transition:none!important}</style></head><body class="auditlog-shell--embedded">${snapshot.html}<script>const fit=()=>document.body.style.transform='scale('+innerWidth/${width}+')';fit();addEventListener('resize',fit);const timeline=document.querySelector('.waterfall-scroll'),axis=document.querySelector('.waterfall-axis-viewport');if(timeline&&axis)timeline.addEventListener('scroll',()=>axis.scrollLeft=timeline.scrollLeft,{passive:true});</script></body></html>`;
    await writeFile(`public/monitoring-examples/${view}-${variant}.html`,html);
  }
}
await writeFile('src/data/monitoring-examples.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Imported six monitoring views in desktop and mobile variants.');
