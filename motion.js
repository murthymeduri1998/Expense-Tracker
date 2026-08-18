/* Life Planner V9.2 - reliable motion engine */
(function(){
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  const easing = 'cubic-bezier(.2,.75,.25,1)';
  let lastView = null;

  function animate(el, keyframes, options){
    if (!el || el.dataset.lpAnimated === '1') return;
    el.dataset.lpAnimated = '1';
    try { el.animate(keyframes, Object.assign({duration: 360, easing, fill:'both'}, options||{})); } catch(e) {}
  }

  function animateMain(){
    const main = document.getElementById('main');
    if (!main) return;
    if (main.dataset.lpView !== lastView) {
      lastView = main.dataset.lpView || String(Date.now());
      main.animate([
        {opacity:0, transform:'translateY(10px)'},
        {opacity:1, transform:'translateY(0)'}
      ], {duration:300,easing,fill:'both'});
    }

    const selectors = '.hero,.card,.metric,.category,.tx,.settingCard,.chartCard,.waterCard,.waterHero,.empty,.sectionHead,.actions,.reportTabs,.summaryGrid';
    main.querySelectorAll(selectors).forEach((el,i)=>{
      if (el.dataset.lpAnimated === '1') return;
      el.dataset.lpAnimated='1';
      try { el.animate([
        {opacity:0, transform:'translateY(12px) scale(.985)'},
        {opacity:1, transform:'translateY(0) scale(1)'}
      ], {duration:360,delay:Math.min(i*35,240),easing,fill:'both'}); } catch(e) {}
    });

    // Animate progress fills after they have their final width.
    main.querySelectorAll('.progress i,.bar i,.progressFill,.barFill').forEach(el=>{
      const width = el.style.width || getComputedStyle(el).width;
      el.animate([{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:650,easing,fill:'both'});
    });

    // Animate numeric values with a short pop, without changing the value.
    main.querySelectorAll('.hero strong,.metric b,.card h3,.statValue,.waterValue').forEach(el=>{
      if(el.dataset.lpNumber==='1') return;
      el.dataset.lpNumber='1';
      try{el.animate([{transform:'translateY(5px)',opacity:.45},{transform:'translateY(0)',opacity:1}],{duration:420,easing,fill:'both'});}catch(e){}
    });

    // SVG/canvas chart entrance.
    main.querySelectorAll('svg,canvas').forEach(el=>{
      try{el.animate([{opacity:0,transform:'scale(.97)'},{opacity:1,transform:'scale(1)'}],{duration:500,easing,fill:'both'});}catch(e){}
    });
  }

  function animateMenu(open){
    const drawer=document.getElementById('drawer');
    const backdrop=document.getElementById('backdrop');
    if(open){
      try{drawer?.animate([{transform:'translateX(-105%)'},{transform:'translateX(0)'}],{duration:280,easing,fill:'forwards'});}catch(e){}
      try{backdrop?.animate([{opacity:0},{opacity:1}],{duration:220,fill:'forwards'});}catch(e){}
      drawer?.querySelectorAll('nav button').forEach((b,i)=>{
        try{b.animate([{opacity:0,transform:'translateX(-12px)'},{opacity:1,transform:'translateX(0)'}],{duration:260,delay:Math.min(i*22,220),easing,fill:'both'});}catch(e){}
      });
    }
  }

  function bind(){
    document.addEventListener('click', function(e){
      const nav=e.target.closest('[data-view]');
      if(nav){
        // Render is async; let the application update first, then animate the new view.
        setTimeout(animateMain, 30);
        setTimeout(animateMain, 180);
      }
      const menu=e.target.closest('.iconBtn');
      if(menu) setTimeout(()=>animateMenu(true),10);
    }, true);

    const main=document.getElementById('main');
    if(main){
      const observer=new MutationObserver(()=>{
        main.dataset.lpView=String(Date.now());
        requestAnimationFrame(animateMain);
      });
      observer.observe(main,{childList:true,subtree:true});
    }

    // Initial render can occur before this file executes.
    setTimeout(animateMain,50);
    setTimeout(animateMain,500);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
