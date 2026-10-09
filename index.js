const SOURCES = [
  ["Reuters","Reuters oil crude"], ["Bloomberg","Bloomberg oil energy"],
  ["OilPrice.com","OilPrice.com crude"], ["Rigzone","Rigzone oil"],
  ["CNBC","CNBC oil energy"], ["Financial Times","Financial Times oil"],
  ["EIA","EIA crude oil"], ["IEA","IEA oil market"],
  ["OPEC","OPEC oil market"], ["S&P Global","S&P Global oil crude"]
];
const KEY="oil-pulse-latest";
const esc=s=>String(s??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;","'":"&#39;"}[c]));
const strip=s=>String(s??"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
const tag=(xml,t)=>{const m=xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`,`i`));return m?strip(m[1].replace(/<!\[CDATA\[|\]\]>/g,"")):""};
function tone(t){t=t.toLowerCase(); const bull=["cut","disruption","sanction","attack","draw","shortage","tight","rise","surge"]; const bear=["increase","surplus","ceasefire","reopen","build","fall","drop","weak demand"]; let n=bull.filter(x=>t.includes(x)).length-bear.filter(x=>t.includes(x)).length; return n>0?"Bullish":n<0?"Bearish":"Watch";}
async function getNews(){
  const out=[];
  await Promise.all(SOURCES.map(async([source,q])=>{try{
    const u=`https://news.google.com/rss/search?q=${encodeURIComponent(q+' when:1d')}&hl=en-US&gl=US&ceid=US:en`;
    const xml=await (await fetch(u,{headers:{"User-Agent":"OilPulse/1.0"}})).text();
    for(const item of (xml.match(/<item>[\s\S]*?<\/item>/gi)||[]).slice(0,2)){
      const title=tag(item,"title"), link=tag(item,"link"), published=tag(item,"pubDate");
      if(title&&link) out.push({source,title,link,published,sentiment:tone(title),summary:title});
    }
  }catch(e){}}));
  const seen=new Set(); return out.filter(x=>{const k=x.title.toLowerCase();if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>new Date(b.published)-new Date(a.published)).slice(0,10);
}
async function getPrices(env){
  if(!env.OILPRICE_API_KEY) return {demo:true,items:[{code:"BRENT_CRUDE_USD",name:"Brent",price:null},{code:"WTI_USD",name:"WTI",price:null}]};
  const r=await fetch("https://api.oilpriceapi.com/v1/prices/latest?by_code=BRENT_CRUDE_USD,WTI_USD",{headers:{Authorization:`Token ${env.OILPRICE_API_KEY}`}});
  if(!r.ok) throw new Error(`Price API ${r.status}`); const j=await r.json();
  const raw=Array.isArray(j.data)?j.data:(j.data?.prices||[j.data]);
  return {demo:false,items:raw.filter(Boolean).map(x=>({code:x.code||x.commodity,name:x.name||x.code,price:x.price,value:x.value,currency:x.currency||"USD",updated_at:x.updated_at||x.created_at}))};
}
async function refresh(env){let prior={};try{prior=JSON.parse(await env.OIL_PULSE.get(KEY)||"{}")}catch{}
  let prices=prior.prices||{items:[]},priceError=null; try{prices=await getPrices(env)}catch(e){priceError=e.message}
  const news=await getNews(); const data={updatedAt:new Date().toISOString(),prices,priceError,news,sources:SOURCES.map(x=>x[0])};
  await env.OIL_PULSE.put(KEY,JSON.stringify(data)); return data;
}
const css=`:root{font-family:Inter,system-ui,sans-serif;color:#eaf2ff;background:#07111f}*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#07111f,#0d2238);min-height:100vh}.wrap{max-width:760px;margin:auto;padding:18px}.top{display:flex;justify-content:space-between;gap:12px;align-items:center}.brand{font-size:22px;font-weight:800}.muted{color:#9bb0c8;font-size:12px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:18px 0}.card{background:#102943;border:1px solid #244765;border-radius:18px;padding:16px;box-shadow:0 10px 30px #0004}.price{font-size:28px;font-weight:800;margin-top:8px}.tabs{display:flex;gap:8px;overflow:auto;padding-bottom:8px}.tab,button{border:0;border-radius:999px;padding:9px 13px;background:#183b5d;color:#d9eaff;font-weight:700}.tab.on{background:#23b5d3;color:#04131d}.news{display:grid;gap:11px}.item{text-decoration:none;color:inherit;display:block}.row{display:flex;justify-content:space-between;gap:12px}.src{color:#6bdbee;font-weight:700;font-size:12px}.title{font-weight:700;line-height:1.35;margin:7px 0}.pill{font-size:11px;padding:4px 8px;border-radius:999px;background:#274767;white-space:nowrap}.Bullish{background:#125b43}.Bearish{background:#692e3b}.foot{text-align:center;padding:24px;color:#8ba3bb;font-size:11px}@media(max-width:430px){.wrap{padding:14px}.grid{grid-template-columns:1fr 1fr}.card{padding:13px}.price{font-size:23px}}`;
const js=`let data,filter='All';const $=s=>document.querySelector(s);function fmt(v){return v==null?'Set API key':'$'+Number(v).toFixed(2)}function render(){const p=data.prices?.items||[];$('#prices').innerHTML=p.slice(0,2).map(x=>'<div class="card"><div class="muted">'+(x.name||x.code)+'</div><div class="price">'+fmt(x.price??x.value)+'</div><div class="muted">USD/bbl</div></div>').join('')||'<div class="card">Price unavailable</div>';const ss=['All',...data.sources];$('#tabs').innerHTML=ss.map(s=>'<button class="tab '+(s===filter?'on':'')+'" data-s="'+s+'">'+s+'</button>').join('');document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{filter=b.dataset.s;render()});let n=(data.news||[]).filter(x=>filter==='All'||x.source===filter);$('#news').innerHTML=n.map(x=>'<a class="item card" target="_blank" rel="noopener" href="'+x.link+'"><div class="row"><span class="src">'+x.source+'</span><span class="pill '+x.sentiment+'">'+x.sentiment+'</span></div><div class="title">'+x.title+'</div><div class="muted">'+new Date(x.published).toLocaleString()+'</div></a>').join('')||'<div class="card muted">No matching headlines yet.</div>';$('#updated').textContent='Updated '+new Date(data.updatedAt).toLocaleString();}async function load(force=false){$('#refresh').disabled=true;try{data=await (await fetch('/api/data'+(force?'?refresh=1':''))).json();render()}finally{$('#refresh').disabled=false}}$('#refresh').onclick=()=>load(true);load();setInterval(load,3600000);if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js');`;
function page(){return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#07111f"><link rel="manifest" href="/manifest.json"><title>Oil Pulse</title><style>${css}</style></head><body><main class="wrap"><div class="top"><div><div class="brand">Oil Pulse</div><div class="muted" id="updated">Loading market update…</div></div><button id="refresh">Refresh</button></div><section class="grid" id="prices"></section><h3>Top oil-market news</h3><div class="tabs" id="tabs"></div><section class="news" id="news"></section><div class="foot">Hourly market monitor • Headlines link to original publishers • Sentiment is keyword-based, not investment advice</div></main><script>${js}</script></body></html>`}
export default {
 async fetch(req,env){const u=new URL(req.url); if(u.pathname==='/api/data'){let d; if(u.searchParams.get('refresh')==='1') d=await refresh(env); else {d=JSON.parse(await env.OIL_PULSE.get(KEY)||'null'); if(!d)d=await refresh(env)} return Response.json(d,{headers:{'cache-control':'no-store'}})}
 if(u.pathname==='/manifest.json')return Response.json({name:'Oil Pulse Market Update',short_name:'Oil Pulse',start_url:'/',display:'standalone',background_color:'#07111f',theme_color:'#07111f'});
 if(u.pathname==='/sw.js')return new Response(`self.addEventListener('fetch',e=>{if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>caches.match('/')))})`,{headers:{'content-type':'application/javascript'}});
 return new Response(page(),{headers:{'content-type':'text/html;charset=UTF-8'}})},
 async scheduled(c,env,ctx){ctx.waitUntil(refresh(env))}
};
