/* Life Planner V9.6 - local water reminder controller */
(() => {
  const KEY='lp_water_reminder_settings_v96';
  const DEFAULTS={enabled:false,intervalMinutes:120,start:'08:00',end:'22:00',amountMl:250};
  const load=()=>{try{return {...DEFAULTS,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {...DEFAULTS}}};
  const save=s=>localStorage.setItem(KEY,JSON.stringify(s));
  const inWindow=()=>{const s=load(),n=new Date(),m=n.getHours()*60+n.getMinutes(),[sh,sm]=s.start.split(':').map(Number),[eh,em]=s.end.split(':').map(Number);return m>=sh*60+sm&&m<=eh*60+em};
  async function requestPermission(){
    if(!('Notification' in window))return 'unsupported';
    if(Notification.permission==='default')return await Notification.requestPermission();
    return Notification.permission;
  }
  async function notify(){
    const s=load();
    if(!s.enabled||!inWindow())return;
    const p=await requestPermission();
    if(p!=='granted')return;
    const title='Water reminder 💧';
    const options={body:`Time for ${s.amountMl} ml of water.`,tag:'life-planner-water',icon:'icon.svg',badge:'icon.svg'};
    try{
      if('serviceWorker' in navigator){
        const reg=await navigator.serviceWorker.ready;
        if(reg?.showNotification){await reg.showNotification(title,options);return;}
      }
      new Notification(title,options);
    }catch(e){console.warn('Water notification unavailable',e)}
  }
  function schedule(){
    clearTimeout(window.__lpWaterReminderTimer);
    const s=load();
    if(!s.enabled||!s.intervalMinutes)return;
    window.__lpWaterReminderTimer=setTimeout(async()=>{await notify();schedule()},Math.max(1,s.intervalMinutes)*60000);
  }
  window.LPWaterReminders={get:load,save,schedule,requestPermission,notify,enable:async()=>{const s=load(),p=await requestPermission();if(p==='granted'){s.enabled=true;save(s);schedule()}return p},disable:()=>{const s=load();s.enabled=false;save(s);clearTimeout(window.__lpWaterReminderTimer)}};
  window.LPWaterIcon={setLevel(percent){
    const p=Math.max(0,Math.min(100,Number(percent)||0));
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><clipPath id="g"><rect x="10" y="7" width="44" height="50" rx="10"/></clipPath></defs><rect x="10" y="7" width="44" height="50" rx="10" fill="none" stroke="#0f766e" stroke-width="4"/><g clip-path="url(#g)"><rect x="10" y="${57-50*p/100}" width="44" height="${50*p/100}" fill="#38bdf8"/><path d="M8 ${56-50*p/100} Q18 ${50-50*p/100} 28 ${56-50*p/100} T48 ${56-50*p/100} T68 ${56-50*p/100}" fill="none" stroke="white" stroke-width="2" opacity=".85"/></g><path d="M26 4h12" stroke="#0f766e" stroke-width="4" stroke-linecap="round"/></svg>`;
    const href='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    let l=document.querySelector('link[rel="icon"][data-lp-water]');
    if(!l){l=document.createElement('link');l.rel='icon';l.dataset.lpWater='1';document.head.appendChild(l)}
    l.href=href;
  }};
  document.addEventListener('DOMContentLoaded',()=>schedule());
})();
