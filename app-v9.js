const DB_NAME='ExpensePlannerV4DB',DB_VERSION=9,TX_STORE='transactions',META_STORE='meta',HEALTH_STORE='health',SYNC_KEY='expensePlannerV4Sync',DEVICE_KEY='expensePlannerV4Device',PROFILE_KEY='expensePlannerV9Profile',SESSION_KEY='expensePlannerV9Session';
let db,currentView='dashboard',reportMode='finance',reportRange='7d',meta;
function safeSyncConfig(){try{return JSON.parse(localStorage.getItem(SYNC_KEY)||'null')}catch(e){console.warn('Ignoring invalid saved sync config',e);try{localStorage.removeItem(SYNC_KEY)}catch(_){}return null}}
let syncConfig=safeSyncConfig();
function normalizeMetaValue(m){
  const base=defaults.map(x=>({name:x[0],budget:x[1],icon:x[2]}));
  m=m&&typeof m==='object'?m:{};
  if(!Array.isArray(m.categories)||!m.categories.length)m.categories=base;
  m.categories=m.categories.map((c,i)=>({name:String(c?.name||base[i]?.name||'Other'),budget:Number(c?.budget||0),icon:String(c?.icon||base[i]?.icon||'📦')}));
  m.income=Number(m.income||0);
  m.budget=Number(m.budget||m.categories.reduce((s,c)=>s+Number(c.budget||0),0));
  return m;
}
const defaults=[['Housing',5000,'🏠'],['Food',6000,'🍱'],['Transport',3000,'🚗'],['Shopping',2000,'🛍️'],['Bills & EMI',7000,'💳'],['Entertainment',2000,'🎬'],['Other',2000,'📦']];
const money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:0}),today=()=>new Date().toISOString().slice(0,10),esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])),uid=()=>crypto.randomUUID?crypto.randomUUID():'TX-'+Date.now()+'-'+Math.random().toString(16).slice(2);
function openDB(){return new Promise((ok,no)=>{
  const openAt=(v)=>{
    let r;
    try{r=indexedDB.open(DB_NAME,v)}catch(e){no(e);return}
    r.onupgradeneeded=()=>{let d=r.result;if(!d.objectStoreNames.contains(TX_STORE))d.createObjectStore(TX_STORE,{keyPath:'id'});if(!d.objectStoreNames.contains(META_STORE))d.createObjectStore(META_STORE,{keyPath:'key'});if(!d.objectStoreNames.contains(HEALTH_STORE))d.createObjectStore(HEALTH_STORE,{keyPath:'id'})};
    r.onsuccess=()=>ok(r.result);
    r.onerror=()=>no(r.error);
    r.onblocked=()=>console.warn('IndexedDB upgrade is blocked by another tab/window');
  };
  let probe;
  try{probe=indexedDB.open(DB_NAME)}catch(e){no(e);return}
  probe.onsuccess=()=>{const current=probe.result.version;probe.result.close();openAt(Math.max(DB_VERSION,current))};
  probe.onerror=()=>openAt(DB_VERSION);
})}
function allTxRaw(){return new Promise((ok,no)=>{let r=db.transaction(TX_STORE).objectStore(TX_STORE).getAll();r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
function allTx(){return allTxRaw().then(rows=>rows.filter(x=>!x.deleted))}
function putTx(x){return new Promise((ok,no)=>{let r=db.transaction(TX_STORE,'readwrite').objectStore(TX_STORE).put(x);r.onsuccess=ok;r.onerror=()=>no(r.error)})}
function clearTx(){return new Promise((ok,no)=>{let r=db.transaction(TX_STORE,'readwrite').objectStore(TX_STORE).clear();r.onsuccess=ok;r.onerror=()=>no(r.error)})}
function getMeta(){return new Promise((ok,no)=>{let r=db.transaction(META_STORE).objectStore(META_STORE).get('meta');r.onsuccess=()=>ok(r.result?.value||{income:0,budget:0,categories:defaults.map(x=>({name:x[0],budget:x[1],icon:x[2]}))});r.onerror=()=>no(r.error)})}
function putMeta(){return new Promise((ok,no)=>{let r=db.transaction(META_STORE,'readwrite').objectStore(META_STORE).put({key:'meta',value:meta});r.onsuccess=ok;r.onerror=()=>no(r.error)})}
function deviceId(){let x=localStorage.getItem(DEVICE_KEY);if(!x){x='DEV-'+uid();localStorage.setItem(DEVICE_KEY,x)}return x}
function allHealthRaw(){return new Promise((ok,no)=>{let r=db.transaction(HEALTH_STORE).objectStore(HEALTH_STORE).getAll();r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
function allHealth(){return allHealthRaw().then(rows=>rows.filter(x=>!x.deleted))}
function putHealth(x){return new Promise((ok,no)=>{let r=db.transaction(HEALTH_STORE,'readwrite').objectStore(HEALTH_STORE).put(x);r.onsuccess=ok;r.onerror=()=>no(r.error)})}
function deleteHealth(id){return new Promise((ok,no)=>{let r=db.transaction(HEALTH_STORE,'readwrite').objectStore(HEALTH_STORE).delete(id);r.onsuccess=ok;r.onerror=()=>no(r.error)})}
function healthUid(prefix='HL'){return prefix+'-'+uid()}
function selectedDate(id){return document.getElementById(id)?.value||today()}
function num(v){return Number(v||0)}
function chartColor(i){return ['#5b5ce2','#14b8a6','#f59e0b','#ef6b73','#7c8cf8','#38bdf8','#a78bfa','#34d399'][i%8]}
function svgDonut(items,total,label){
  const size=240,r=78,c=2*Math.PI*r; let offset=0;
  const rings=items.filter(x=>x.value>0).map((x,i)=>{const len=total?c*x.value/total:0;const el=`<circle cx="120" cy="120" r="${r}" fill="none" stroke="${chartColor(i)}" stroke-width="28" stroke-linecap="round" stroke-dasharray="${len} ${Math.max(0,c-len)}" stroke-dashoffset="${-offset}"/>`;offset+=len;return el}).join('');
  return `<div class="donutWrap"><svg class="donut" viewBox="0 0 ${size} ${size}" aria-label="${esc(label)}"><g transform="rotate(-90 120 120)"><circle cx="120" cy="120" r="${r}" fill="none" stroke="#edf0f5" stroke-width="28"/>${rings}</g><text x="120" y="112" text-anchor="middle" class="donutValue">${esc(label)}</text><text x="120" y="136" text-anchor="middle" class="donutSub">${Math.round(total).toLocaleString('en-IN')}</text></svg></div>`;
}
function svgBars(data,title,format='number'){
  const max=Math.max(...data.map(x=>x.value),1),w=560,h=250,pad={l:42,r:16,t:30,b:44},cw=(w-pad.l-pad.r)/data.length,barW=Math.min(34,cw*.55);
  const bars=data.map((x,i)=>{const bh=(x.value/max)*(h-pad.t-pad.b);const bx=pad.l+i*cw+(cw-barW)/2,by=h-pad.b-bh;return `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(bh,2).toFixed(1)}" rx="8" fill="${chartColor(i)}"/><text x="${(bx+barW/2).toFixed(1)}" y="${Math.max(by-8,14).toFixed(1)}" text-anchor="middle" class="barValue">${format==='money'?money(x.value):Math.round(x.value)}</text><text x="${(bx+barW/2).toFixed(1)}" y="${h-18}" text-anchor="middle" class="barLabel">${esc(x.label)}</text>`}).join('');
  return `<div class="chartSvgWrap"><div class="chartTitle">${esc(title)}</div><svg class="barChart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><line x1="${pad.l}" y1="${h-pad.b}" x2="${w-pad.r}" y2="${h-pad.b}" stroke="#dfe5ee"/><line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${h-pad.b}" stroke="#dfe5ee"/>${bars}</svg></div>`;
}
function waterRing(ml,goal){const pct=goal?Math.min(100,ml/goal*100):0;const r=74,c=2*Math.PI*r,len=c*pct/100;return `<div class="waterRing"><svg viewBox="0 0 180 180"><circle cx="90" cy="90" r="${r}" fill="none" stroke="#e9e7ff" stroke-width="14"/><circle cx="90" cy="90" r="${r}" fill="none" stroke="#6c63e8" stroke-width="14" stroke-linecap="round" stroke-dasharray="${len} ${c-len}" transform="rotate(-90 90 90)"/><text x="90" y="86" text-anchor="middle" class="ringValue">${Math.round(ml)} ml</text><text x="90" y="108" text-anchor="middle" class="ringSub">of ${Math.round(goal)} ml</text></svg></div>`}
function updateWaterAppIcon(ml,goal){try{window.LPWaterIcon?.setLevel(goal?ml/goal*100:0)}catch(e){console.warn('Water icon update failed',e)}}
function last7Days(){const out=[];const now=new Date();for(let i=6;i>=0;i--){const d=new Date(now);d.setDate(now.getDate()-i);out.push(d.toISOString().slice(0,10))}return out}
function dayLabel(d){return new Date(d+'T00:00:00').toLocaleDateString('en-US',{weekday:'short'}).slice(0,3)}
function parseFoodEntries(text){
  const parts=String(text||'').split(/[,;]+/).map(x=>x.trim()).filter(Boolean), out=[];
  for(const part of parts){const m=part.match(/^(.*?)(?:\s+)(\d+(?:\.\d+)?)\s*(?:g|gram|grams)$/i);if(m)out.push({food:m[1].trim(),grams:Number(m[2])});else{const n=part.match(/^(.*?)\s*[:=-]\s*(\d+(?:\.\d+)?)\s*g?$/i);if(n)out.push({food:n[1].trim(),grams:Number(n[2])});}}
  return out;
}
function calcFoodText(text){return parseFoodEntries(text).reduce((s,x)=>{const c=foodCalc(x.food,x.grams);return {calories:s.calories+c.calories,protein:s.protein+c.protein,carbs:s.carbs+c.carbs}}, {calories:0,protein:0,carbs:0})}

const foodCatalog=[['Rice',130,2.7,28],['Oats',389,16.9,66.3],['Paneer',265,18.3,6.1],['Curd',61,3.5,4.7],['Milk',61,3.2,4.8],['Soya Chunks',345,52,33],['Dal',116,9,20],['Chana',164,8.9,27.4],['Rajma',127,8.7,22.8],['Carrot',41,0.9,9.6],['Cucumber',15,0.7,3.6],['Apple',52,0.3,13.8],['Banana',89,1.1,22.8],['Peanuts',567,25.8,16.1],['Almonds',579,21.2,21.6]];
function foodMatch(q){q=String(q||'').toLowerCase();return foodCatalog.filter(x=>x[0].toLowerCase().includes(q)).slice(0,8)}
function foodCalc(name,grams){let f=foodCatalog.find(x=>x[0].toLowerCase()===String(name||'').toLowerCase());if(!f)return {calories:0,protein:0,carbs:0};let k=num(grams)/100;return {calories:Math.round(f[1]*k),protein:+(f[2]*k).toFixed(1),carbs:+(f[3]*k).toFixed(1)}}
function healthDateNav(kind,date){return `<div class="dateNav"><button type="button" onclick="shiftHealthDate('${kind}',-1)">‹</button><input id="${kind}Date" type="date" value="${date||today()}" onchange="render()"><button type="button" onclick="shiftHealthDate('${kind}',1)">›</button></div>`}
function shiftHealthDate(kind,delta){let el=document.getElementById(kind+'Date');if(!el)return;let d=new Date(el.value+'T00:00:00');d.setDate(d.getDate()+delta);el.value=d.toISOString().slice(0,10);render()}
function totals(a){const signed=a.reduce((s,x)=>s+(x.type==='income'?Math.abs(Number(x.amount)||0):-Math.abs(Number(x.amount)||0)),0),spent=a.filter(x=>x.type==='expense').reduce((s,x)=>s+Math.abs(Number(x.amount)||0),0),income=a.filter(x=>x.type==='income').reduce((s,x)=>s+Math.abs(Number(x.amount)||0),0),budget=Number(meta.budget||meta.categories.reduce((s,x)=>s+Number(x.budget||0),0)),savings=Math.max(income-spent,0),deficit=Math.max(spent-income,0);return{spent,budget,income,available:Math.max(income-spent,0),savings,deficit,signed}}
function iconFor(c){return meta.categories.find(x=>x.name===c)?.icon||'₹'}
function txHtml(x){return `<div class="tx"><div class="txIcon">${x.type==='income'?'💰':iconFor(x.category)}</div><div class="txMain"><b>${esc(x.note||x.category||'Income')}</b><small>${esc(x.date)} · ${esc(x.category||'Income')}${x.method?' · '+esc(x.method):''}</small></div><div class="txAmt ${x.type==='income'?'income':'expense'}">${x.type==='income'?'+':'−'}${money(Math.abs(x.amount))}</div></div>`}
async function render(){let a=await allTx();let fn={dashboard:dashboard,transactions:transactions,planner:planner,reports:reports,settings:settings,categories:categories,gym:gym,cardio:cardio,measurements:measurements,food:food,water:water,healthIssues:healthIssues}[currentView]||dashboard;document.getElementById('main').innerHTML=await fn(a);if(currentView==='water'){const hh=await allHealth(),dd=document.getElementById('waterDate')?.value||today(),rr=hh.filter(x=>x.kind==='water'&&x.date===dd),mm=rr.reduce((q,x)=>q+num(x.amount),0),gg=num(rr.find(x=>x.goal)?.goal)||2500;updateWaterAppIcon(mm,gg)}let titles={dashboard:'Dashboard',transactions:'Transactions',planner:'Budget Planner',reports:'Reports',settings:'Settings & Sync',categories:'Categories',gym:'Gym Workouts',cardio:'Cardio & Core',measurements:'Body Measurements',food:'Food & Calories',water:'Water Intake',healthIssues:'Health Issues'};document.getElementById('pageTitle').textContent=titles[currentView]||'Dashboard';document.getElementById('eyebrow').textContent=['gym','cardio','measurements','food','water','healthIssues','categories'].includes(currentView)?'FITNESS & HEALTH':currentView==='dashboard'?'AUGUST 2026':'EXPENSE PLANNER';document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===currentView))}

function showReport(mode){reportMode=mode;currentView='reports';render();const main=document.getElementById('main');if(main)main.scrollTo({top:0,behavior:'smooth'})}
function setReportRange(v){reportRange=v;render()}
function smartSuggestions(a,h){const out=[];const t=totals(a);if(t.deficit>0)out.push(`⚠️ Spending is ${money(t.deficit)} above income. Review the highest-spend category.`);else if(t.savings>0)out.push(`💰 You have ${money(t.savings)} available after expenses. Consider assigning part of it to a savings goal.`);const todayStr=today();const water=h.filter(x=>x.kind==='water'&&x.date===todayStr).reduce((s,x)=>s+num(x.amount),0);if(water<2000)out.push(`💧 Hydration is ${Math.round(water)} ml today. Add water entries to reach your daily target.`);const workouts=h.filter(x=>(x.kind==='workout'||x.kind==='cardio'||x.kind==='core')&&x.date===todayStr);if(!workouts.length)out.push('🏋️ No workout logged today. If today is a training day, add your workout.');const weights=h.filter(x=>x.kind==='weight'||(x.kind==='measurement'&&x.weight)).sort((x,y)=>x.date.localeCompare(y.date));if(weights.length>=2){const a1=num(weights[weights.length-2].weight),a2=num(weights[weights.length-1].weight);if(a2>a1)out.push(`⚖️ Weight is up ${(a2-a1).toFixed(1)} kg from the previous log; review the weekly trend rather than a single day.`);else if(a2<a1)out.push(`⚖️ Weight is down ${(a1-a2).toFixed(1)} kg from the previous log.`)}return out.slice(0,4).map(x=>`<p>• ${esc(x)}</p>`).join('')||'<p>Keep logging data to unlock suggestions.</p>'}
async function dashboard(a){
  const t=totals(a),h=await allHealth(),d=today();
  const todayFood=h.filter(x=>x.kind==='food'&&x.date===d),cal=todayFood.reduce((s,x)=>s+num(x.calories),0),protein=todayFood.reduce((s,x)=>s+num(x.protein),0);
  const todayWater=h.filter(x=>x.kind==='water'&&x.date===d),waterMl=todayWater.reduce((s,x)=>s+num(x.amount),0),waterGoal=num(todayWater.find(x=>x.goal)?.goal)||2500;
  const work=h.filter(x=>(x.kind==='workout'||x.kind==='cardio'||x.kind==='core')&&x.date===d);
  const days=last7Days(),weekSpend=days.map(x=>({label:dayLabel(x),value:a.filter(t=>t.type==='expense'&&t.date===x).reduce((s,z)=>s+num(z.amount),0)}));
  return `<section class="hero"><div class="heroTop"><div><small>Available this month</small><strong>${money(t.available)}</strong></div><div class="monthPill">August 2026</div></div><div class="heroStats"><div><small>Income</small><b>${money(t.income)}</b></div><div><small>Expenses</small><b>${money(t.spent)}</b></div><div><small>Savings</small><b>${money(t.savings)}</b></div></div></section>
  <div class="summaryGrid dashboardStats"><div class="metric"><small>Food today</small><b>${cal} kcal</b><small>${protein.toFixed(1)} g protein</small></div><div class="metric"><small>Workout today</small><b>${work.length} logs</b><small>${work.filter(x=>x.kind==='cardio').length} cardio · ${work.filter(x=>x.kind==='core').length} core</small></div><div class="metric"><small>Water today</small><b>${Math.round(waterMl)} ml</b><small>Goal ${Math.round(waterGoal)} ml</small></div><div class="metric"><small>Sync</small><b>${navigator.onLine?(syncConfig?'Connected':'Local'):'Offline'}</b><small>Local data is always available</small></div></div>
  <div class="sectionHead"><div><h2>Water intake</h2><p class="subtle compact">Daily hydration target</p></div><button onclick="showView('water')">Open</button></div>
  <section class="waterCard"><div class="waterCopy"><span class="eyebrowPill">TODAY</span><h2>${Math.round(waterMl)} ml</h2><p>of ${Math.round(waterGoal)} ml goal</p><button class="waterAdd" onclick="openWater()">＋ Drink water</button></div><div class="waterGlass" aria-label="Animated water glass"><div class="waterLiquid" style="height:${Math.min(100,waterGoal?waterMl/waterGoal*100:0)}%"><span></span></div><div class="waterGlassShine"></div></div>${waterRing(waterMl,waterGoal)}</section>
  <div class="chartGrid"><section class="chartCard">${svgBars(weekSpend,'Last 7 days spending','money')}</section><section class="chartCard"><div class="sectionHead"><h2>Smart suggestions</h2></div><div class="suggestions">${smartSuggestions(a,h)}</div></section></div>`
}
async function transactions(a){
  a.sort((x,y)=>y.created-x.created);const t=totals(a),recent=a.slice(0,8);
  return `<h2 class="pageTitle">Finance</h2><p class="subtle">Detailed income, expenses, budget usage and recent transactions.</p>
  <div class="summaryGrid"><div class="metric"><small>Income</small><b>${money(t.income)}</b></div><div class="metric"><small>Expenses</small><b>${money(t.spent)}</b></div><div class="metric"><small>Savings</small><b>${money(t.savings)}</b></div><div class="metric"><small>Deficit</small><b>${money(t.deficit)}</b></div></div>
  <div class="sectionHead"><h2>Budget overview</h2><button onclick="showView('planner')">Manage</button></div>
  ${meta.categories.map(c=>{const spent=a.filter(x=>x.type==='expense'&&x.category===c.name).reduce((z,x)=>z+Math.abs(num(x.amount)),0),pct=c.budget?Math.round(spent/c.budget*100):0;return `<div class="category"><div class="catTop"><b>${c.icon} ${esc(c.name)}</b><span>${money(spent)} / ${money(c.budget)}</span></div><div class="bar"><i class="${pct>100?'over':''}" style="width:${Math.min(100,pct)}%"></i></div></div>`}).join('')}
  <div class="sectionHead"><h2>Recent transactions</h2><span>${a.length} total</span></div>
  <input class="search" id="txSearch" oninput="filterTx()" placeholder="Search merchant, category or note"><div id="txList">${recent.length?recent.map(txHtml).join(''):'<div class="empty"><b>No transactions</b>Your records appear here.</div>'}</div>`
}
async function filterTx(){let q=document.getElementById('txSearch').value.toLowerCase(),a=(await allTx()).filter(x=>`${x.note} ${x.category} ${x.method} ${x.date}`.toLowerCase().includes(q)).sort((x,y)=>y.created-x.created);document.getElementById('txList').innerHTML=a.map(txHtml).join('')||'<div class="empty">No matching transactions.</div>'}
async function planner(a){let t=totals(a);return `<h2 class="pageTitle">Budget Planner</h2><p class="subtle">Your plan is stored locally and synced safely.</p><div class="summaryGrid"><div class="metric"><small>Monthly income</small><b>${money(meta.income)}</b></div><div class="metric"><small>Total budget</small><b>${money(t.budget)}</b></div><div class="metric"><small>Savings</small><b>${money(t.savings)}</b></div><div class="metric"><small>Deficit</small><b>${money(t.deficit)}</b></div></div><div class="actions"><button class="primary" onclick="editPlan()">Edit plan</button><button onclick="openCategory()">＋ Add category</button></div><div class="settingCard">${meta.categories.map(c=>`<div class="settingRow"><div class="grow"><b>${c.icon} ${esc(c.name)}</b><small>Budget ${money(c.budget)}</small></div><button onclick="editCategory('${esc(c.name)}')">Edit</button></div>`).join('')}</div>`}
async function categories(){return `<h2 class="pageTitle">Categories</h2><p class="subtle">Categories are user-defined and stored locally; sync them to Google Sheets when connected.</p><div class="actions"><button class="primary" onclick="openCategory()">＋ Add category</button></div><div class="settingCard">${meta.categories.map(c=>`<div class="settingRow"><div class="grow"><b>${c.icon} ${esc(c.name)}</b><small>Budget ${money(c.budget)}</small></div><button onclick="editCategory('${esc(c.name)}')">Edit</button></div>`).join('')}</div>`}
async function reports(a){
  const h=await allHealth();
  const days=last7Days();
  const rangeDays=reportRange==='30d'?30:reportRange==='all'?3650:7;
  const now=new Date();
  const range=[];
  for(let i=rangeDays-1;i>=0;i--){const d=new Date(now);d.setDate(now.getDate()-i);range.push(d.toISOString().slice(0,10))}
  const inRange=d=>range.includes(d);
  const tab=(id,label,icon)=>`<button class="${reportMode===id?'active':''}" onclick="showReport('${id}')">${icon} ${label}</button>`;
  const rangeSelect=`<select class="reportRange" onchange="setReportRange(this.value)"><option value="7d" ${reportRange==='7d'?'selected':''}>Last 7 days</option><option value="30d" ${reportRange==='30d'?'selected':''}>Last 30 days</option><option value="all" ${reportRange==='all'?'selected':''}>All records</option></select>`;
  let content='';
  if(reportMode==='finance'){
    const tx=a.filter(x=>x.type==='expense'&&inRange(x.date));
    const spent=tx.reduce((s,x)=>s+num(x.amount),0);
    const cats=meta.categories.map(c=>({name:c.name,value:tx.filter(x=>x.category===c.name).reduce((s,x)=>s+num(x.amount),0)})).filter(x=>x.value>0).sort((x,y)=>y.value-x.value);
    const trend=range.slice(-14).map(d=>({label:dayLabel(d),value:tx.filter(x=>x.date===d).reduce((s,x)=>s+num(x.amount),0)}));
    content=`<div class="summaryGrid"><div class="metric"><small>Expenses</small><b>${money(spent)}</b></div><div class="metric"><small>Transactions</small><b>${tx.length}</b></div><div class="metric"><small>Average / day</small><b>${money(range.length?spent/range.length:0)}</b></div><div class="metric"><small>Top category</small><b>${esc(cats[0]?.name||'—')}</b></div></div><div class="chartGrid"><section class="chartCard"><div class="sectionHead"><h2>Expense mix</h2><span>${money(spent)}</span></div><div class="donutLayout">${svgDonut(cats,spent,'Expense')}<div class="legend">${cats.slice(0,8).map((x,i)=>`<div><i style="background:${chartColor(i)}"></i><span>${esc(x.name)}</span><b>${money(x.value)}</b></div>`).join('')||'<div class="subtle">No expense data.</div>'}</div></div></section><section class="chartCard">${svgBars(trend,'Spending trend','money')}</section></div>`;
  } else if(reportMode==='gym'){
    const rows=h.filter(x=>x.kind==='workout'&&inRange(x.date));
    const byDay=range.slice(-14).map(d=>({label:dayLabel(d),value:rows.filter(x=>x.date===d).length}));
    const sets=rows.reduce((s,x)=>s+num(x.sets),0),reps=rows.reduce((s,x)=>s+num(x.reps),0);
    const exercises={};rows.forEach(x=>{const k=x.exercise||'Unknown';exercises[k]=(exercises[k]||0)+1});
    const top=Object.entries(exercises).map(([name,value])=>({label:name.length>12?name.slice(0,12)+'…':name,value})).sort((a,b)=>b.value-a.value).slice(0,8);
    content=`<div class="summaryGrid"><div class="metric"><small>Workout logs</small><b>${rows.length}</b></div><div class="metric"><small>Sets</small><b>${sets}</b></div><div class="metric"><small>Reps</small><b>${reps}</b></div><div class="metric"><small>Exercises</small><b>${Object.keys(exercises).length}</b></div></div><div class="chartGrid"><section class="chartCard">${svgBars(byDay,'Workout frequency')}</section><section class="chartCard">${svgBars(top,'Most logged exercises')}</section></div>`;
  } else if(reportMode==='cardio'){
    const rows=h.filter(x=>(x.kind==='cardio'||x.kind==='core')&&inRange(x.date));
    const cardioRows=rows.filter(x=>x.kind==='cardio'),coreRows=rows.filter(x=>x.kind==='core');
    const trend=range.slice(-14).map(d=>({label:dayLabel(d),value:rows.filter(x=>x.date===d).length}));
    const minutes=cardioRows.reduce((s,x)=>s+num(x.duration),0),coreSets=coreRows.reduce((s,x)=>s+num(x.sets),0);
    content=`<div class="summaryGrid"><div class="metric"><small>Total logs</small><b>${rows.length}</b></div><div class="metric"><small>Cardio</small><b>${cardioRows.length}</b></div><div class="metric"><small>Core</small><b>${coreRows.length}</b></div><div class="metric"><small>Cardio time</small><b>${minutes} min</b></div></div><div class="chartGrid"><section class="chartCard">${svgBars(trend,'Cardio & core frequency')}</section><section class="chartCard">${svgBars([{label:'Cardio',value:cardioRows.length},{label:'Core',value:coreRows.length}],'Cardio vs Core')}</section></div>`;
  } else if(reportMode==='food'){
    const rows=h.filter(x=>x.kind==='food'&&inRange(x.date));
    const calories=rows.reduce((s,x)=>s+num(x.calories),0),protein=rows.reduce((s,x)=>s+num(x.protein),0),grams=rows.reduce((s,x)=>s+num(x.grams),0);
    const meals=['Breakfast','Lunch','Snack','Dinner','Cheat Meal'].map(m=>({label:m.replace('Cheat Meal','Cheat'),value:rows.filter(x=>x.meal===m).reduce((s,x)=>s+num(x.calories),0)}));
    const trend=range.slice(-14).map(d=>({label:dayLabel(d),value:rows.filter(x=>x.date===d).reduce((s,x)=>s+num(x.calories),0)}));
    content=`<div class="summaryGrid"><div class="metric"><small>Calories</small><b>${Math.round(calories)} kcal</b></div><div class="metric"><small>Protein</small><b>${protein.toFixed(1)} g</b></div><div class="metric"><small>Food logs</small><b>${rows.length}</b></div><div class="metric"><small>Food grams</small><b>${Math.round(grams)} g</b></div></div><div class="chartGrid"><section class="chartCard">${svgBars(meals,'Calories by meal')}</section><section class="chartCard">${svgBars(trend,'Daily calories')}</section></div>`;
  } else if(reportMode==='water'){
    const rows=h.filter(x=>x.kind==='water'&&inRange(x.date));
    const total=rows.reduce((s,x)=>s+num(x.amount),0),daysHit=new Set(rows.filter(x=>num(x.goal)>0&&num(x.amount)>=num(x.goal)).map(x=>x.date)).size;
    const trend=range.slice(-14).map(d=>({label:dayLabel(d),value:rows.filter(x=>x.date===d).reduce((s,x)=>s+num(x.amount),0)}));
    content=`<div class="summaryGrid"><div class="metric"><small>Total intake</small><b>${Math.round(total)} ml</b></div><div class="metric"><small>Entries</small><b>${rows.length}</b></div><div class="metric"><small>Goal days</small><b>${daysHit}</b></div><div class="metric"><small>Daily average</small><b>${Math.round(range.length?total/range.length:0)} ml</b></div></div><div class="chartGrid"><section class="chartCard">${svgBars(trend,'Daily water intake')}</section><section class="chartCard">${waterRing(total,range.length?2500*range.length:2500)}<p class="subtle center">Total vs cumulative goal</p></section></div>`;
  } else if(reportMode==='body'){
    const rows=h.filter(x=>(x.kind==='weight'||x.kind==='measurement')&&inRange(x.date)&&num(x.weight)>0).sort((x,y)=>x.date.localeCompare(y.date));
    const weights=rows.map(x=>({label:dayLabel(x.date),value:num(x.weight)}));
    const latest=rows[rows.length-1],previous=rows[rows.length-2],diff=latest&&previous?num(latest.weight)-num(previous.weight):0;
    content=`<div class="summaryGrid"><div class="metric"><small>Latest weight</small><b>${latest?num(latest.weight).toFixed(1)+' kg':'—'}</b></div><div class="metric"><small>Weekly change</small><b>${previous?(diff>0?'+':'')+diff.toFixed(1)+' kg':'—'}</b></div><div class="metric"><small>Weight logs</small><b>${rows.length}</b></div><div class="metric"><small>Body entries</small><b>${h.filter(x=>x.kind==='measurement'&&inRange(x.date)).length}</b></div></div><div class="chartGrid"><section class="chartCard">${svgBars(weights.slice(-12),'Weight trend (kg)')}</section><section class="chartCard"><div class="sectionHead"><h2>Weekly insight</h2></div><div class="insight"><p>${latest&&previous?(diff<0?'Weight is trending down. Keep comparing week-to-week rather than day-to-day.':diff>0?'Weight is trending up. Review your weekly food/activity pattern.':'Weight is stable across the latest logs.'):'Add two or more weekly weight logs to generate an insight.'}</p></div></section></div>`;
  } else {
    const rows=h.filter(x=>x.kind==='issue'&&inRange(x.date));
    const sev=rows.length?rows.reduce((s,x)=>s+num(x.severity),0)/rows.length:0;
    const trend=range.slice(-14).map(d=>({label:dayLabel(d),value:rows.filter(x=>x.date===d).length}));
    content=`<div class="summaryGrid"><div class="metric"><small>Issues logged</small><b>${rows.length}</b></div><div class="metric"><small>Average severity</small><b>${sev.toFixed(1)}/10</b></div><div class="metric"><small>High severity</small><b>${rows.filter(x=>num(x.severity)>=7).length}</b></div><div class="metric"><small>Tracked days</small><b>${new Set(rows.map(x=>x.date)).size}</b></div></div><div class="chartGrid"><section class="chartCard">${svgBars(trend,'Health issues over time')}</section><section class="chartCard">${svgBars([{label:'1–3',value:rows.filter(x=>num(x.severity)<=3).length},{label:'4–6',value:rows.filter(x=>num(x.severity)>=4&&num(x.severity)<=6).length},{label:'7–10',value:rows.filter(x=>num(x.severity)>=7).length}],'Severity distribution')}</section></div>`;
  }
  return `<h2 class="pageTitle">Reports</h2><p class="subtle">Select a module to view its report here. Reports do not redirect to the module.</p><div class="reportToolbar"><div class="reportTabs">${tab('finance','Finance','₹')}${tab('gym','Gym','🏋')}${tab('cardio','Cardio & Core','🏃')}${tab('food','Nutrition','🍽')}${tab('water','Water','💧')}${tab('body','Body','⚖️')}${tab('health','Health','❤️')}</div>${rangeSelect}</div>${content}`;
}
async function gym(a){let h=await allHealth(),d=document.getElementById('gymDate')?.value||today(),logs=h.filter(x=>x.kind==='workout'&&x.date===d);return `<h2 class="pageTitle">Gym Workouts</h2><p class="subtle">Log exercises, weight, sets and reps for any date.</p>${healthDateNav('gym',d)}<div class="actions"><button class="primary" onclick="openWorkout()">＋ Workout</button><button onclick="showView('cardio')">Cardio</button></div><div class="sectionHead"><h2>${d}</h2><span>${logs.length} exercises</span></div>${logs.length?logs.map(x=>`<div class="tx"><div class="txIcon">🏋️</div><div class="txMain"><b>${esc(x.exercise)}</b><small>${esc(x.muscle||'Workout')} · ${x.sets||0} sets × ${x.reps||0} reps · ${x.weight||0} kg</small></div><button onclick="removeHealth('${x.id}')">×</button></div>`).join(''):'<div class="empty"><b>No workout logged</b>Add your first exercise for this date.</div>'}`}
async function cardio(a){let h=await allHealth(),d=document.getElementById('cardioDate')?.value||today(),logs=h.filter(x=>(x.kind==='cardio'||x.kind==='core')&&x.date===d);return `<h2 class="pageTitle">Cardio & Core</h2><p class="subtle">Track normal cardio and core work by date.</p>${healthDateNav('cardio',d)}<div class="actions"><button class="primary" onclick="openCardio('cardio')">＋ Cardio</button><button onclick="openCardio('core')">＋ Core</button></div>${logs.length?logs.map(x=>`<div class="tx"><div class="txIcon">${x.kind==='core'?'🔥':'🏃'}</div><div class="txMain"><b>${esc(x.exercise)}</b><small>${x.kind==='core'?`${x.sets||0} sets × ${x.reps||0} reps · ${x.duration||0} sec`:`${x.duration||0} min${x.distance?` · ${x.distance} km`:''}`}</small></div><button onclick="removeHealth('${x.id}')">×</button></div>`).join(''):'<div class="empty"><b>No cardio/core logged</b>Track your activity for this date.</div>'}`}
async function measurements(a){let h=await allHealth(),rows=h.filter(x=>x.kind==='measurement').sort((x,y)=>y.date.localeCompare(x.date)),weights=h.filter(x=>x.kind==='weight'||(x.kind==='measurement'&&x.weight)).map(x=>({date:x.date,weight:num(x.weight),updated:x.updated||x.created})).filter(x=>x.weight>0).sort((x,y)=>x.date.localeCompare(y.date));const latest=weights[weights.length-1],prev=weights.length>1?weights[weights.length-2]:null,diff=latest&&prev?latest.weight-prev.weight:0;const weekly=weights.slice(-8).map(x=>({label:dayLabel(x.date),value:x.weight}));const insight=latest&&prev?(diff<0?`Great: weight is down ${Math.abs(diff).toFixed(1)} kg from the previous logged measurement.`:diff>0?`Weight is up ${diff.toFixed(1)} kg from the previous logged measurement.`:'Weight is unchanged from the previous logged measurement.'):'Add at least two weekly weight logs to see a comparison.';return `<h2 class="pageTitle">Body & Weight</h2><p class="subtle">Weight is tracked weekly. Other body measurements are tracked monthly.</p><section class="chartCard"><div class="sectionHead"><h2>Weekly weight comparison</h2><button class="primary" onclick="openWeight()">＋ Add weight</button></div><div class="summaryGrid"><div class="metric"><small>Latest weight</small><b>${latest?latest.weight+' kg':'—'}</b></div><div class="metric"><small>Change</small><b>${prev?(diff>0?'+':'')+diff.toFixed(1)+' kg':'—'}</b></div></div>${svgBars(weekly,'Weekly weight (kg)')}<div class="insight"><b>Weekly insight</b><p>${esc(insight)}</p></div></section><div class="sectionHead"><h2>Monthly body measurements</h2><button onclick="openMeasurement()">＋ Add measurement</button></div>${rows.length?rows.map(x=>`<div class="card" style="margin:9px 0"><div class="catTop"><b>${esc(x.date)}</b><button onclick="removeHealth('${x.id}')">×</button></div><div class="summaryGrid"><div class="metric"><small>Height</small><b>${x.height||'—'} cm</b></div><div class="metric"><small>Chest</small><b>${x.chest||'—'} cm</b></div><div class="metric"><small>Waist</small><b>${x.waist||'—'} cm</b></div><div class="metric"><small>Shoulders</small><b>${x.shoulders||'—'} cm</b></div><div class="metric"><small>Back</small><b>${x.back||'—'} cm</b></div><div class="metric"><small>Arms</small><b>${x.arms||'—'} cm</b></div><div class="metric"><small>Thighs</small><b>${x.thighs||'—'} cm</b></div><div class="metric"><small>Legs</small><b>${x.legs||'—'} cm</b></div></div></div>`).join(''):'<div class="empty"><b>No monthly measurements yet</b>Add your first monthly measurement.</div>'}`}
async function food(a){let h=await allHealth(),d=document.getElementById('foodDate')?.value||today(),rows=h.filter(x=>x.kind==='food'&&x.date===d),cal=rows.reduce((s,x)=>s+num(x.calories),0),protein=rows.reduce((s,x)=>s+num(x.protein),0);return `<h2 class="pageTitle">Food & Calories</h2><p class="subtle">Free-hand meal logging with grams and automatic calories.</p>${healthDateNav('food',d)}<div class="summaryGrid"><div class="metric"><small>Calories</small><b>${cal} kcal</b></div><div class="metric"><small>Protein</small><b>${protein.toFixed(1)} g</b></div></div><div class="actions"><button class="primary" onclick="openFood()">＋ Add food</button></div>${['Breakfast','Lunch','Snack','Dinner','Cheat Meal'].map(m=>{let r=rows.filter(x=>x.meal===m);return `<div class="sectionHead"><h2>${m}</h2><span>${Math.round(r.reduce((s,x)=>s+x.calories,0))} kcal</span></div>${r.length?r.map(x=>`<div class="tx"><div class="txIcon">🍽️</div><div class="txMain"><b>${esc(x.food)} · ${x.grams} g</b><small>${x.calories} kcal · ${x.protein} g protein · ${x.carbs} g carbs</small></div><button onclick="removeHealth('${x.id}')">×</button></div>`).join(''):'<div class="empty" style="padding:16px">No food logged.</div>'}`}).join('')}`}
async function healthIssues(a){let h=await allHealth(),d=document.getElementById('issueDate')?.value||today(),rows=h.filter(x=>x.kind==='issue'&&x.date===d);return `<h2 class="pageTitle">Health Issues</h2><p class="subtle">Track issues, severity and notes by date.</p>${healthDateNav('issue',d)}<div class="actions"><button class="primary" onclick="openIssue()">＋ Add issue</button></div>${rows.length?rows.map(x=>`<div class="tx"><div class="txIcon">❤️</div><div class="txMain"><b>${esc(x.issue)}</b><small>Severity ${x.severity}/10${x.note?' · '+esc(x.note):''}</small></div><button onclick="removeHealth('${x.id}')">×</button></div>`).join(''):'<div class="empty"><b>No issues logged</b>Add an issue if something needs tracking.</div>'}`}
function workoutRow(i=0){return `<div class="workoutEntry" data-workout-row="${i}"><div class="rowHeader"><b>Exercise ${i+1}</b>${i>0?`<button type="button" class="removeRow" onclick="this.closest('[data-workout-row]').remove()">Remove</button>`:''}</div><div class="field"><label>Exercise</label><input class="wExercise" placeholder="e.g. Incline dumbbell press"></div><div class="field"><label>Muscle / Workout</label><input class="wMuscle" placeholder="Chest, back, legs…"></div><div class="summaryGrid"><div class="field"><label>Weight (kg)</label><input class="wWeight" type="number" step="0.5"></div><div class="field"><label>Sets</label><input class="wSets" type="number"></div></div><div class="field"><label>Reps</label><input class="wReps" type="number"></div></div>`}
function openWorkout(){openModal(`<h2>Log Workout</h2><p class="subtle">Add multiple exercises in one workout. Exercise names are free-hand.</p><div class="field"><label>Date</label><input id="wDate" type="date" value="${today()}"></div><div id="workoutEntries">${workoutRow(0)}</div><button type="button" class="secondaryAdd" onclick="addWorkoutRow()">＋ Add another exercise</button><button class="submit" onclick="saveWorkout()">Save Workout</button>`)}
function addWorkoutRow(){const wrap=document.getElementById('workoutEntries');if(!wrap)return;const i=wrap.querySelectorAll('[data-workout-row]').length;wrap.insertAdjacentHTML('beforeend',workoutRow(i))}
async function saveWorkout(){const rows=[...document.querySelectorAll('[data-workout-row]')];const date=selectedDate('wDate');const now=Date.now();const records=rows.map(row=>({id:healthUid('WO'),kind:'workout',created:now,updated:Date.now(),date,muscle:row.querySelector('.wMuscle')?.value.trim()||'',exercise:row.querySelector('.wExercise')?.value.trim()||'',weight:num(row.querySelector('.wWeight')?.value),sets:num(row.querySelector('.wSets')?.value),reps:num(row.querySelector('.wReps')?.value)})).filter(x=>x.exercise);if(!records.length)return alert('Add at least one exercise.');for(const x of records)await putHealth(x);closeModal();await render();syncHealthNow()}
function openCardio(kind){openModal(`<h2>${kind==='core'?'Log Core':'Log Cardio'}</h2><p class="subtle">Free-hand exercise entry. No dropdown.</p><div class="field"><label>Date</label><input id="cDate" type="date" value="${today()}"></div><div class="field"><label>Exercise</label><input id="cExercise" placeholder="e.g. Treadmill, plank, cycling…"></div>${kind==='core'?`<div class="summaryGrid"><div class="field"><label>Sets</label><input id="cSets" type="number"></div><div class="field"><label>Reps</label><input id="cReps" type="number"></div></div><div class="field"><label>Duration (seconds)</label><input id="cDuration" type="number">`:`<div class="field"><label>Time (minutes)</label><input id="cDuration" type="number"></div><div class="field"><label>Distance (km, optional)</label><input id="cDistance" type="number" step="0.1">`}</div><button class="submit" onclick="saveCardio('${kind}')">Save ${kind}</button>`)}
async function saveCardio(kind){let x={id:healthUid(kind==='core'?'CO':'CA'),kind,created:Date.now(),updated:Date.now(),date:selectedDate('cDate'),exercise:document.getElementById('cExercise').value,sets:num(document.getElementById('cSets')?.value),reps:num(document.getElementById('cReps')?.value),duration:num(document.getElementById('cDuration')?.value),distance:num(document.getElementById('cDistance')?.value)};if(!x.exercise)return alert('Select an exercise.');await putHealth(x);closeModal();await render();syncHealthNow()}
function openWeight(){openModal(`<h2>Weekly Weight</h2><p class="subtle">Use this for your weekly weight check. It does not replace monthly body measurements.</p><div class="field"><label>Date</label><input id="wtDate" type="date" value="${today()}"></div><div class="field"><label>Weight (kg)</label><input id="wtWeight" type="number" step="0.1" inputmode="decimal"></div><div class="field"><label>Note</label><input id="wtNote" placeholder="Optional note"></div><button class="submit" onclick="saveWeight()">Save Weight</button>`)}
async function saveWeight(){const weight=num(document.getElementById('wtWeight').value);if(!weight)return alert('Enter weight.');const x={id:healthUid('WT'),kind:'weight',created:Date.now(),updated:Date.now(),date:selectedDate('wtDate'),weight,note:document.getElementById('wtNote').value.trim()};await putHealth(x);closeModal();await render();syncHealthNow()}
function openMeasurement(){openModal(`<h2>Monthly Measurement</h2><div class="field"><label>Date</label><input id="mDate" type="date" value="${today()}"></div><div class="summaryGrid">${[['weight','Weight (kg)'],['height','Height (cm)'],['chest','Chest (cm)'],['shoulders','Shoulders (cm)'],['back','Back (cm)'],['waist','Waist (cm)'],['hips','Hips (cm)'],['legs','Legs (cm)'],['thighs','Thighs (cm)'],['arms','Arms (cm)'],['calves','Calves (cm)']].map(([id,l])=>`<div class="field"><label>${l}</label><input id="m_${id}" type="number" step="0.1"></div>`).join('')}</div><button class="submit" onclick="saveMeasurement()">Save Measurement</button>`)}
async function saveMeasurement(){let ids=['weight','height','chest','shoulders','back','waist','hips','legs','thighs','arms','calves'],x={id:healthUid('ME'),kind:'measurement',created:Date.now(),updated:Date.now(),date:selectedDate('mDate')};ids.forEach(k=>x[k]=num(document.getElementById('m_'+k).value)||'');await putHealth(x);closeModal();await render();syncHealthNow()}
function foodRow(i=0){return `<div class="foodEntry" data-food-row="${i}"><div class="rowHeader"><b>Food ${i+1}</b>${i>0?`<button type="button" class="removeRow" onclick="this.closest('[data-food-row]').remove();updateFoodRowsCalc()">Remove</button>`:''}</div><div class="field"><label>Food + grams</label><input class="fFoodText" oninput="updateFoodRowsCalc()" placeholder="Rice 150 grams"></div></div>`}
function openFood(){openModal(`<h2>Add Food</h2><p class="subtle">Add multiple foods in one meal. Each row accepts food name + grams.</p><div class="field"><label>Date</label><input id="fDate" type="date" value="${today()}"></div><div class="field"><label>Meal</label><select id="fMeal">${['Breakfast','Lunch','Snack','Dinner','Cheat Meal'].map(x=>`<option>${x}</option>`).join('')}</select></div><div id="foodEntries">${foodRow(0)}</div><button type="button" class="secondaryAdd" onclick="addFoodRow()">＋ Add another food</button><div id="foodCalc" class="card foodCalc"><b>0 kcal</b><small> Add food + grams.</small></div><button class="submit" onclick="saveFood()">Save Food</button>`)}
function addFoodRow(){const wrap=document.getElementById('foodEntries');if(!wrap)return;const i=wrap.querySelectorAll('[data-food-row]').length;wrap.insertAdjacentHTML('beforeend',foodRow(i));}
function updateFoodRowsCalc(){const items=[...document.querySelectorAll('.fFoodText')].flatMap(el=>parseFoodEntries(el.value||''));const c=items.reduce((s,x)=>{const n=foodCalc(x.food,x.grams);return{calories:s.calories+n.calories,protein:s.protein+n.protein,carbs:s.carbs+n.carbs}},{calories:0,protein:0,carbs:0});const el=document.getElementById('foodCalc');if(el)el.innerHTML=`<b>${c.calories} kcal</b><small> · Protein ${c.protein.toFixed(1)} g · Carbs ${c.carbs.toFixed(1)} g · ${items.length} item(s)</small>`}
async function saveFood(){const textItems=[...document.querySelectorAll('.fFoodText')].flatMap(el=>parseFoodEntries(el.value||''));if(!textItems.length)return alert('Add at least one food with grams.');const now=Date.now(),date=selectedDate('fDate'),meal=document.getElementById('fMeal').value;for(const item of textItems){const n=foodCalc(item.food,item.grams);await putHealth({id:healthUid('FO'),kind:'food',created:now,updated:Date.now(),date,meal,food:item.food,grams:item.grams,calories:n.calories,protein:n.protein,carbs:n.carbs});}closeModal();await render();syncHealthNow()}
function openWater(){const hPromise=allHealth();openModal(`<h2>Log Water</h2><p class="subtle">Quickly record each glass or bottle. Your daily total is calculated automatically.</p><div class="field"><label>Date</label><input id="waterDate" type="date" value="${today()}"></div><div class="field"><label>Time</label><input id="waterTime" type="time" value="${new Date().toTimeString().slice(0,5)}"></div><div class="field"><label>Water amount (ml)</label><input id="waterAmount" type="number" inputmode="numeric" placeholder="250"></div><div class="field"><label>Daily goal (ml)</label><input id="waterGoal" type="number" value="2500"></div><button class="submit" onclick="saveWater()">Save Water</button>`)}
async function saveWater(){const amount=num(document.getElementById('waterAmount').value),goal=num(document.getElementById('waterGoal').value)||2500;if(!amount)return alert('Enter water amount in ml.');const x={id:healthUid('WA'),kind:'water',created:Date.now(),updated:Date.now(),date:document.getElementById('waterDate').value,time:document.getElementById('waterTime').value,amount,goal};await putHealth(x);closeModal();await render();syncHealthNow()}
async function water(){
  const h=await allHealth();
  const d=document.getElementById('waterDate')?.value||today();
  const rows=h.filter(x=>x.kind==='water'&&x.date===d).sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')));
  const ml=rows.reduce((s,x)=>s+num(x.amount),0);
  const goal=num(rows.find(x=>x.goal)?.goal)||2500;
  const pct=Math.min(100,goal?ml/goal*100:0);
  const days=last7Days();
  const weekly=days.map(x=>({label:dayLabel(x),value:h.filter(z=>z.kind==='water'&&z.date===x).reduce((s,z)=>s+num(z.amount),0)}));
  const rem=window.LPWaterReminders?.get?.()||{enabled:false,intervalMinutes:120,start:'08:00',end:'22:00',amountMl:250};
  return `<h2 class="pageTitle">Water Intake</h2>
  <p class="subtle">Track hydration throughout the day, compare your weekly intake and set reminders.</p>
  ${healthDateNav('water',d)}
  <section class="waterHero waterHeroEnhanced">
    <div class="waterHeroCopy">
      <span class="eyebrowPill">DAILY HYDRATION</span>
      <h2>${Math.round(ml)} ml</h2>
      <p>Goal ${Math.round(goal)} ml · ${Math.round(pct)}% complete</p>
      <button class="waterAdd" onclick="openWater()">＋ Add water</button>
    </div>
    <div class="waterGlass waterGlassLarge" aria-label="Animated water glass at ${Math.round(pct)} percent">
      <div class="waterLiquid" style="height:${pct}%"><span></span></div>
      <div class="waterGlassShine"></div>
    </div>
    ${waterRing(ml,goal)}
  </section>
  <div class="chartGrid">
    <section class="chartCard">${svgBars(weekly,'Weekly hydration (ml)')}</section>
    <section class="chartCard">
      <div class="sectionHead"><h2>Today's records</h2><span>${rows.length} entries</span></div>
      ${rows.length?rows.map(x=>`<div class="tx"><div class="txIcon waterIcon">💧</div><div class="txMain"><b>${x.amount} ml</b><small>${esc(x.time||'')} · Water</small></div><button onclick="removeHealth('${x.id}')">×</button></div>`).join(''):'<div class="empty"><b>No water logged</b>Add your first glass.</div>'}
    </section>
  </div>
  <section class="card waterReminderCard">
    <div class="sectionHead">
      <div><h2>Water reminders</h2><p class="subtle compact">Remind me to drink during my chosen hours.</p></div>
      <span class="status ${rem.enabled?'connected':''}">${rem.enabled?'ON':'OFF'}</span>
    </div>
    <div class="summaryGrid">
      <div class="field"><label>Every (minutes)</label><input id="waterReminderInterval" type="number" min="15" step="15" value="${rem.intervalMinutes}"></div>
      <div class="field"><label>Amount (ml)</label><input id="waterReminderAmount" type="number" min="50" step="50" value="${rem.amountMl}"></div>
      <div class="field"><label>Start</label><input id="waterReminderStart" type="time" value="${rem.start}"></div>
      <div class="field"><label>End</label><input id="waterReminderEnd" type="time" value="${rem.end}"></div>
    </div>
    <div class="actions reminderActions">
      <button class="primary" onclick="saveWaterReminders()">Save & enable</button>
      <button onclick="testWaterReminder()">Test notification</button>
      <button onclick="disableWaterReminders()">Disable</button>
    </div>
    <p class="subtle reminderNote">The settings are stored locally. Browser notifications require permission. A normal web/PWA timer cannot guarantee a notification when iOS has completely suspended the app; reliable closed-app iPhone reminders require Web Push/native notification support.</p>
  </section>`;
}
function openIssue(){openModal(`<h2>Add Health Issue</h2><div class="field"><label>Date</label><input id="iDate" type="date" value="${today()}"></div><div class="field"><label>Issue</label><input id="iIssue" placeholder="Back pain, fatigue, headache…"></div><div class="field"><label>Severity (1–10)</label><input id="iSeverity" type="number" min="1" max="10" value="5"></div><div class="field"><label>Notes</label><input id="iNote" placeholder="Optional note"></div><button class="submit" onclick="saveIssue()">Save Issue</button>`)}
async function saveIssue(){let issue=document.getElementById('iIssue').value.trim();if(!issue)return alert('Enter an issue.');let x={id:healthUid('IS'),kind:'issue',created:Date.now(),updated:Date.now(),date:selectedDate('iDate'),issue,severity:Math.max(1,Math.min(10,num(document.getElementById('iSeverity').value))),note:document.getElementById('iNote').value.trim()};await putHealth(x);closeModal();await render();syncHealthNow()}
async function removeHealth(id){if(!confirm('Delete this log?'))return;const rows=await allHealthRaw();const x=rows.find(r=>r.id===id);if(x){x.deleted=true;x.updated=Date.now();await putHealth(x)}await render();syncHealthNow()}
async function syncHealthNow(){if(!syncConfig||!navigator.onLine)return;try{let h=await allHealthRaw();let r=await api('upsertHealth',{records:h});if(r.ok){syncConfig.lastSync=Date.now();syncConfig.devices=r.devices||syncConfig.devices||[];localStorage.setItem(SYNC_KEY,JSON.stringify(syncConfig));updateBadge()}}catch(e){console.warn('Health background sync failed',e)}}
function disableWaterReminders(){
  if(window.LPWaterReminders?.disable) window.LPWaterReminders.disable();
  else if(window.LPWaterReminders){const s=window.LPWaterReminders.get();s.enabled=false;window.LPWaterReminders.save(s);}
  toast('Water reminders disabled.');
  render();
}
async function saveWaterReminders(){
  if(!window.LPWaterReminders)return;
  const interval=Math.max(15,num(document.getElementById('waterReminderInterval')?.value)||120);
  const amount=Math.max(50,num(document.getElementById('waterReminderAmount')?.value)||250);
  const start=document.getElementById('waterReminderStart')?.value||'08:00';
  const end=document.getElementById('waterReminderEnd')?.value||'22:00';
  const permission=await window.LPWaterReminders.requestPermission();
  if(permission!=='granted'){toast('Notification permission was not granted.');return}
  const current=window.LPWaterReminders.get();
  window.LPWaterReminders.save({...current,enabled:true,intervalMinutes:interval,amountMl:amount,start,end});
  window.LPWaterReminders.schedule();
  toast('Water reminders enabled.');
  await render();
}
async function testWaterReminder(){
  if(!window.LPWaterReminders)return;
  const permission=await window.LPWaterReminders.requestPermission();
  if(permission!=='granted'){toast('Notification permission was not granted.');return}
  const old=window.LPWaterReminders.get();
  window.LPWaterReminders.save({...old,enabled:true});
  await window.LPWaterReminders.notify();
  toast('Test reminder sent.');
}
async function settings(){
  const last=syncConfig?.lastSync?new Date(syncConfig.lastSync).toLocaleString():'Never';
  const devices=syncConfig?.devices||[];
  const rows=devices.length?devices.map(d=>{
    const online=Date.now()-new Date(d.lastSeen||0).getTime()<180000;
    return `<div class="device"><span class="dot ${online?'online':''}"></span><div><b>${esc(d.deviceName||'Device')}</b><small>${online?'Online':'Offline'} · ${d.lastSeen?'Last seen '+new Date(d.lastSeen).toLocaleString():'Not seen'}</small></div></div>`;
  }).join(''):'<div class="empty">No devices checked in yet.</div>';
  return `<h2 class="pageTitle">Settings & Sync</h2><p class="subtle">One shared Google Sheet connection. Sync is merge-first and never clears old logs.</p>
  <div class="settingCard">
    <div class="settingRow"><div class="grow"><b>Google Sheets</b><small>${syncConfig?'Connected · '+esc(syncConfig.sheetLabel||'Expense Planner'):'Not connected'}</small></div><span class="status ${syncConfig?'connected':''}">${syncConfig?'CONNECTED':'OFFLINE'}</span></div>
    <div class="settingRow"><div class="grow"><b>Connect / Reconnect Google Sheets</b><small>Connect the first device. Other devices discover the same Sheet automatically.</small></div><button type="button" onclick="connectWizard()">Connect</button></div>
    ${syncConfig?`<div class="settingRow"><div class="grow"><b>Last sync</b><small>${last}</small></div><button type="button" onclick="syncNow(true)">Sync now</button></div>
    <div class="settingRow"><div class="grow"><b>Connection ID</b><small>${esc(syncConfig.connectionId||'')}</small></div></div>
    <div class="settingRow"><div class="grow"><b>Remove this device</b><small>Disconnect this device only. Cloud data remains.</small></div><button type="button" onclick="removeConnection()">Remove</button></div>`:''}
  </div>
  <div class="sectionHead"><h2>Devices</h2><button type="button" onclick="syncNow(true)">Refresh</button></div>
  <div class="settingCard">${rows}</div>
  <div class="settingCard"><div class="settingRow"><div class="grow"><b>Water notifications</b><small>Manage hydration reminders from the Water module.</small></div><button type="button" onclick="showView('water')">Manage</button></div><div class="settingRow"><div class="grow"><b>Offline profile</b><small>${esc(getProfile()?.name||'Local user')} · login works without internet.</small></div><button type="button" onclick="logoutOffline()">Log out</button></div><div class="settingRow"><div class="grow"><b>Export CSV</b><small>Download local transactions.</small></div><button type="button" onclick="exportCSV()">Export</button></div><div class="settingRow"><div class="grow"><b>Clear local database</b><small>Does not delete Google Sheet.</small></div><button type="button" onclick="clearLocal()">Clear</button></div></div>`;
}

function form(type){let cats=meta.categories.map(c=>`<option value="${esc(c.name)}">${c.icon} ${esc(c.name)}</option>`).join('');return `<h2>Add ${type==='expense'?'Expense':'Income'}</h2><div class="segment"><button class="${type==='expense'?'active':''}" onclick="openExpense()">Expense</button><button class="${type==='income'?'active':''}" onclick="openIncome()">Income</button></div><div class="field"><label>Amount</label><input id="amount" class="amountInput" type="number" inputmode="decimal" step="0.01" placeholder="₹ 0 or -₹ 0"><small class="subtle">Positive = selected type. Negative reverses the type.</small></div>${type==='expense'?`<div class="field"><label>Category</label><input id="category" list="categoryList" autocomplete="off" placeholder="Type or choose a category"><datalist id="categoryList">${cats}</datalist><small class="subtle">You can type a new category; it will be saved automatically.</small></div>`:''}<div class="field"><label>Date</label><input id="date" type="date" value="${today()}"></div>${type==='expense'?`<div class="field"><label>Payment method</label><select id="method"><option>UPI</option><option>Cash</option><option>Debit Card</option><option>Credit Card</option><option>Bank Transfer</option></select></div>`:''}<div class="field"><label>${type==='expense'?'Merchant / note':'Income source'}</label><input id="note" placeholder="${type==='expense'?'e.g. Groceries':'e.g. Salary'}"></div><button class="submit" onclick="addTx('${type}')">Save ${type}</button>`}
function openExpense(){openModal(form('expense'))}function openIncome(){openModal(form('income'))}function openModal(x){document.getElementById('modalContent').innerHTML=x;document.getElementById('modal').classList.remove('hidden');setTimeout(()=>document.getElementById('amount')?.focus(),50)}function closeModal(){document.getElementById('modal').classList.add('hidden')}function modalOutside(e){if(e.target.id==='modal')closeModal()}
async function addTx(type){let raw=Number(document.getElementById('amount').value);if(!raw||Number.isNaN(raw))return alert('Enter a valid amount.');let finalType=raw<0?(type==='income'?'expense':'income'):type,amount=Math.abs(raw),category=finalType==='expense'?(document.getElementById('category')?.value.trim()||'Other'):'Income';if(finalType==='expense'&&!meta.categories.some(c=>c.name.toLowerCase()===category.toLowerCase())){meta.categories.push({name:category,budget:0,icon:'📦'});}let x={id:uid(),created:Date.now(),updated:Date.now(),deleted:false,type:finalType,amount,category,date:document.getElementById('date').value,method:document.getElementById('method')?.value||'',note:document.getElementById('note').value.trim()};await putTx(x);await putMeta();closeModal();await render();if(syncConfig){syncMetaNow();syncNow(false)}}
function openCategory(){openModal(`<h2>Add category</h2><div class="field"><label>Category name</label><input id="newCategory" placeholder="e.g. Medical, Fuel, Investments"></div><div class="field"><label>Monthly budget (optional)</label><input id="newCategoryBudget" type="number" value="0"></div><button class="submit" onclick="saveNewCategory()">Save category</button>`)}
async function saveNewCategory(){const name=document.getElementById('newCategory').value.trim();if(!name)return alert('Enter a category name.');if(meta.categories.some(c=>c.name.toLowerCase()===name.toLowerCase()))return alert('Category already exists.');meta.categories.push({name,budget:num(document.getElementById('newCategoryBudget').value),icon:'📦'});await putMeta();closeModal();await render();if(syncConfig){syncMetaNow();syncNow(false)}}
function editPlan(){openModal(`<h2>Edit monthly plan</h2><div class="field"><label>Monthly income</label><input id="planIncome" type="number" value="${meta.income}"></div><div class="field"><label>Total budget</label><input id="planBudget" type="number" value="${meta.budget||meta.categories.reduce((s,x)=>s+x.budget,0)}"></div><button class="submit" onclick="savePlan()">Save plan</button>`)}async function savePlan(){meta.income=Number(document.getElementById('planIncome').value)||0;meta.budget=Number(document.getElementById('planBudget').value)||0;await putMeta();closeModal();render();if(syncConfig){syncMetaNow();syncNow(false)}}function editCategory(n){let c=meta.categories.find(x=>x.name===n);openModal(`<h2>Edit category</h2><div class="field"><label>Category</label><input disabled value="${esc(c.name)}"></div><div class="field"><label>Monthly budget</label><input id="catBudget" type="number" value="${c.budget}"></div><button class="submit" onclick="saveCategory('${esc(n)}')">Save</button>`)}async function saveCategory(n){meta.categories.find(x=>x.name===n).budget=Number(document.getElementById('catBudget').value)||0;await putMeta();closeModal();render()}
function openDrawer(){document.getElementById('drawer').classList.add('open');document.getElementById('backdrop').classList.remove('hidden')}function closeDrawer(){document.getElementById('drawer').classList.remove('open');document.getElementById('backdrop').classList.add('hidden')}function showView(v){currentView=v;render();const main=document.getElementById('main');if(main)main.scrollTo({top:0,behavior:'smooth'})}
function toast(s){let t=document.getElementById('toast');t.textContent=s;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400)}
function updateBadge(){let b=document.getElementById('syncBadge');const online=navigator.onLine; b.classList.toggle('online',!!syncConfig&&online);b.querySelector('span').textContent=!online?'Offline':(syncConfig?'Online':'Local only')}
window.addEventListener('online',()=>{updateBadge();if(syncConfig)syncNow(false)});window.addEventListener('offline',updateBadge);
const DEFAULT_API_URL='https://script.google.com/macros/s/AKfycby00swQ-oSPEPW4aWnyL-jf_suo_XQaSGCZ50T0KgAePXx8a4V95iSUO9VRO0NymqEopQ/exec';
function deviceNameGuess(){const ua=navigator.userAgent;if(/iPhone/i.test(ua))return'iPhone';if(/iPad/i.test(ua))return'iPad';if(/Android/i.test(ua))return'Android';return'Laptop';}
function normalizeSheetId(v){v=String(v||'').trim();const m=v.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);return m?m[1]:v;}
async function api(action,payload={}){
  if(!navigator.onLine) throw Error('OFFLINE');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try{
    const r=await fetch(DEFAULT_API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,deviceId:deviceId(),deviceName:syncConfig?.deviceName||deviceNameGuess(),sheetId:syncConfig?.sheetId||'',...payload}),signal:controller.signal,cache:'no-store'});
    const text=await r.text();
    let data;try{data=JSON.parse(text)}catch(e){throw Error('Apps Script returned non-JSON (HTTP '+r.status+'): '+text.slice(0,180))}
    if(!r.ok) throw Error('Apps Script HTTP '+r.status+(data?.error?': '+data.error:''));
    return data;
  }catch(e){
    if(e?.name==='AbortError') throw Error('Google sync timed out after 20 seconds.');
    throw e;
  }finally{clearTimeout(timer)}
}
async function mergeMetaCloud(cloud){if(!cloud||!Array.isArray(cloud.categories))return;let changed=false;for(const c of cloud.categories){if(!c.name)continue;const local=meta.categories.find(x=>x.name.toLowerCase()===String(c.name).toLowerCase());if(!local){meta.categories.push({name:String(c.name),budget:num(c.budget),icon:String(c.icon||'📦')});changed=true}else if(num(c.updated||0)>0&&num(c.updated)>0&&num(c.updated)>num(local.updated||0)){local.budget=num(c.budget);local.icon=String(c.icon||local.icon);changed=true}}if(changed)await putMeta()}
async function discoverConnection(){
  if(!navigator.onLine)return !!syncConfig;
  try{const r=await api('discover');if(r.ok&&r.connection){syncConfig={url:DEFAULT_API_URL,...r.connection,deviceId:deviceId(),deviceName:r.device?.deviceName||deviceNameGuess(),devices:r.devices||[]};localStorage.setItem(SYNC_KEY,JSON.stringify(syncConfig));await mergeLocalWithCloud(r.transactions||[],false);await mergeHealth(r.health||[],false);await mergeMetaCloud(r.meta);return true}return !!syncConfig}catch(e){console.warn('DISCOVER ERROR',e);return !!syncConfig}}
function connectWizard(){
  openModal(`<h2>Connect Google Sheets</h2><p class="subtle">Paste your Google Sheet ID or full Google Sheet URL. The Apps Script URL is already configured.</p>
  <div class="field"><label>Google Sheet ID or URL</label><input id="sheetId" autocomplete="off" placeholder="1AbC... or https://docs.google.com/spreadsheets/d/..."></div>
  <div class="field"><label>Device name</label><input id="deviceName" autocomplete="off" value="${esc(deviceNameGuess())}"></div>
  <button type="button" class="submit" id="connectSubmit" onclick="startConnection()">Connect & Merge</button>
  <p id="connectError" class="subtle"></p>`);
}
async function startConnection(){
  const sheetId=normalizeSheetId(document.getElementById('sheetId')?.value);
  const name=document.getElementById('deviceName')?.value.trim()||deviceNameGuess();
  const err=document.getElementById('connectError'),btn=document.getElementById('connectSubmit');
  if(!sheetId){if(err)err.textContent='Please enter the Google Sheet ID or URL.';return}
  if(btn){btn.disabled=true;btn.textContent='Connecting…'}
  try{
    const r=await api('connect',{sheetId,deviceName:name});
    if(!r.ok)throw Error(r.error||'Google Sheet connection failed.');
    if(!r.connection)throw Error('No connection was returned by Apps Script.');
    syncConfig={url:DEFAULT_API_URL,...r.connection,deviceId:deviceId(),deviceName:name,devices:r.devices||[]};
    localStorage.setItem(SYNC_KEY,JSON.stringify(syncConfig));
    await mergeLocalWithCloud(r.transactions||[],true);
    await mergeMetaCloud(r.meta);
    closeModal();updateBadge();await render();toast('Google Sheets connected and synced.');
  }catch(e){console.error('CONNECT ERROR',e);if(err)err.textContent='Connection failed: '+(e.message||e);if(btn){btn.disabled=false;btn.textContent='Connect & Merge'}}
}
async function mergeLocalWithCloud(cloud,pushAfterMerge=true){const local=await allTxRaw(),m=new Map();[...cloud,...local].forEach(x=>{const old=m.get(x.id);if(!old||Number(x.updated||x.created||0)>Number(old.updated||old.created||0))m.set(x.id,x)});for(const x of m.values())await putTx({...x});if(pushAfterMerge&&syncConfig){const r=await api('upsertMany',{transactions:[...m.values()]});if(!r.ok)throw Error(r.error||'Upload failed');if(r.health)await mergeHealth(r.health,false);syncConfig.lastSync=Date.now();syncConfig.devices=r.devices||[];localStorage.setItem(SYNC_KEY,JSON.stringify(syncConfig))}}
async function mergeHealth(cloud,pushAfterMerge=true){const local=await allHealthRaw(),m=new Map();[...(cloud||[]),...local].forEach(x=>{const old=m.get(x.id);if(!old||Number(x.updated||x.created||0)>Number(old.updated||old.created||0))m.set(x.id,x)});for(const x of m.values())await putHealth({...x});if(pushAfterMerge&&syncConfig){const r=await api('upsertHealth',{records:[...m.values()]});if(!r.ok)throw Error(r.error||'Health upload failed')}}
async function syncMetaNow(){if(!syncConfig)return;try{const r=await api('upsertMeta',{meta});if(r.ok){syncConfig.lastSync=Date.now();localStorage.setItem(SYNC_KEY,JSON.stringify(syncConfig));updateBadge()}}catch(e){console.warn('Meta sync failed',e)}}
let syncBusy=false;
async function syncNow(manual=false){
  if(syncBusy)return;if(!navigator.onLine){updateBadge();if(manual)toast('Offline — data is saved locally.');return}
  if(!syncConfig){if(!manual)return;if(!(await discoverConnection())){connectWizard();return}}
  syncBusy=true;const b=document.getElementById('syncBadge');b?.classList.add('syncing');if(b)b.querySelector('span').textContent='Syncing…';
  try{const r=await api('getAll');if(!r.ok)throw Error('Cloud read failed: '+(r.error||'unknown error'));await mergeLocalWithCloud(r.transactions||[],false);await mergeHealth(r.health||[],false);await mergeMetaCloud(r.meta);const allT=await allTxRaw(),allH=await allHealthRaw();const up=await api('upsertMany',{transactions:allT});if(!up.ok)throw Error('Transactions sync failed: '+(up.error||'unknown error'));const uh=await api('upsertHealth',{records:allH});if(!uh.ok)throw Error('Health sync failed: '+(uh.error||'unknown error'));const um=await api('upsertMeta',{meta});if(!um.ok)throw Error('Categories/budget sync failed: '+(um.error||'unknown error'));syncConfig.devices=uh.devices||up.devices||um.devices||syncConfig.devices||[];syncConfig.lastSync=Date.now();localStorage.setItem(SYNC_KEY,JSON.stringify(syncConfig));updateBadge();if(manual)toast('Sync complete')}
  catch(e){console.error('SYNC ERROR',e);updateBadge();if(manual)toast((e?.message||'Sync failed')+' — local data is safe.')}
  finally{b?.classList.remove('syncing');updateBadge();syncBusy=false}
}
async function removeConnection(){
  if(confirm('Remove Google connection from this device? Cloud data and other devices stay connected.')){
    try{await api('removeDevice',{deviceId:deviceId()})}catch(e){console.warn(e)}
    syncConfig=null;localStorage.removeItem(SYNC_KEY);updateBadge();render();toast('This device was disconnected. Cloud data was kept.');
  }
}
async function exportCSV(){let a=await allTx(),rows=[['id','date','type','amount','category','method','note'],...a.map(x=>[x.id,x.date,x.type,x.amount,x.category,x.method,x.note])],csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\\n'),aEl=document.createElement('a');aEl.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));aEl.download='expense-transactions.csv';aEl.click()}
async function clearLocal(){if(confirm('Clear local transactions from this device? Google Sheet will NOT be deleted.')){await clearTx();render();toast('Local data cleared.')}}
async function hashText(value){const data=new TextEncoder().encode(String(value));const buf=await crypto.subtle.digest('SHA-256',data);return Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,'0')).join('')}
function getProfile(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')}catch(e){return null}}
function loggedIn(){return !!getProfile()}
function authScreen(mode='login',message=''){const setup=mode==='setup';document.getElementById('main').innerHTML=`<section class="authCard"><div class="authBrand">₹</div><h1>${setup?'Create offline profile':'Welcome back'}</h1><p class="subtle">${setup?'Your profile stays on this device. You can use the app without internet.':'Login works offline on this device.'}</p>${message?`<div class="errorCard"><p>${esc(message)}</p></div>`:''}${setup?`<div class="field"><label>Name</label><input id="authName" autocomplete="name" placeholder="Your name"></div>`:''}<div class="field"><label>PIN</label><input id="authPin" type="password" inputmode="numeric" maxlength="8" placeholder="4–8 digit PIN"></div>${setup?`<div class="field"><label>Confirm PIN</label><input id="authPin2" type="password" inputmode="numeric" maxlength="8" placeholder="Confirm PIN"></div>`:''}<button class="submit" onclick="${setup?'createOfflineProfile()':'loginOffline()'}">${setup?'Create profile':'Login offline'}</button>${!setup&&getProfile()?`<p class="subtle center">${esc(getProfile().name||'Local user')}</p>`:''}</section>`}
async function createOfflineProfile(){const name=document.getElementById('authName').value.trim()||'Local User',pin=document.getElementById('authPin').value,confirmPin=document.getElementById('authPin2').value;if(!/^\d{4,8}$/.test(pin))return alert('PIN must be 4–8 digits.');if(pin!==confirmPin)return alert('PINs do not match.');localStorage.setItem(PROFILE_KEY,JSON.stringify({name,pinHash:await hashText(pin),createdAt:Date.now()}));localStorage.setItem(SESSION_KEY,'1');document.querySelector('.topbar')?.style.removeProperty('display');document.getElementById('drawer')?.style.removeProperty('display');await render();updateBadge();toast('Offline profile created.')}
async function loginOffline(){const p=getProfile(),pin=document.getElementById('authPin').value;if(!p)return authScreen('setup');if(await hashText(pin)!==p.pinHash)return authScreen('login','Incorrect PIN. Your local data has not been changed.');localStorage.setItem(SESSION_KEY,'1');document.querySelector('.topbar')?.style.removeProperty('display');document.getElementById('drawer')?.style.removeProperty('display');await render();updateBadge();toast('Logged in offline.')}
function logoutOffline(){localStorage.removeItem(SESSION_KEY);authScreen('login');}
function ensureAuth(){if(loggedIn()){localStorage.setItem(SESSION_KEY,'1');return true}authScreen('setup');return false}
async function init(){
  try{db=await openDB();meta=normalizeMetaValue(await getMeta());await putMeta();if(!ensureAuth())return;await render();updateBadge();if(navigator.onLine){const found=await discoverConnection();if(found)await syncNow(false)}window.addEventListener('online',async()=>{updateBadge();if(syncConfig)await syncNow(false);else if(await discoverConnection())await syncNow(false)});window.addEventListener('offline',()=>updateBadge());setInterval(()=>{if(navigator.onLine&&syncConfig)syncNow(false)},120000)}catch(e){console.error('App startup failed',e);const m=document.getElementById('main');if(m)m.innerHTML='<div class="card errorCard"><b>Application could not start</b><p>'+esc(e?.message||e)+'</p><button class="primary" onclick="location.reload()">Reload</button></div>'}}
window.addEventListener('error',e=>{console.error('Unhandled app error',e.error||e.message)});init();
