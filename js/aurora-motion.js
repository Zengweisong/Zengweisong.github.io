(()=>{
  const reduce=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover:hover) and (pointer:fine)');
  const cards=[...document.querySelectorAll('.product,.flagship,.mini-case,.project,.book,.writing a,.writing-row')];
  document.documentElement.classList.add('motion-ready');
  document.querySelector('.hero h1')?.classList.add('motion-heading');
  const reveal=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');reveal.unobserve(e.target)}}),{threshold:.08,rootMargin:'0px 0px 35px 0px'});
  cards.forEach((el,i)=>{el.classList.add('motion-reveal');el.style.setProperty('--reveal-delay',`${i%3*65}ms`);reveal.observe(el)});
  let progress=document.createElement('div');progress.className='motion-progress';progress.setAttribute('aria-hidden','true');document.body.appendChild(progress);
  let scrollFrame=0;function read(){scrollFrame=0;const d=document.documentElement;progress.style.setProperty('--read',String(scrollY/Math.max(1,d.scrollHeight-innerHeight)))}
  addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(read)},{passive:true});addEventListener('resize',read);read();
  const sections=[...document.querySelectorAll('section[id]')];const nav=[...document.querySelectorAll('nav a[href^="#"]')];
  const wayfinding=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){nav.forEach(a=>{const selected=a.getAttribute('href')==='#'+e.target.id;a.classList.toggle('motion-current',selected);if(selected)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')})}})},{rootMargin:'-15% 0px -55% 0px'});sections.forEach(e=>wayfinding.observe(e));
  const tiltStates=[];
  cards.filter(el=>!el.classList.contains('writing-row')).forEach(el=>{
    const state={el,x:0,y:0,vx:0,vy:0,tx:0,ty:0,raf:0,last:0};tiltStates.push(state);el.classList.add('motion-tilt');
    function tick(time){if(reduce.matches||document.hidden){reset();return}const dt=Math.min((time-(state.last||time))/1000,.025);state.last=time;
      state.vx+=((state.tx-state.x)*380-state.vx*39)*dt;state.vy+=((state.ty-state.y)*380-state.vy*39)*dt;state.x+=state.vx*dt;state.y+=state.vy*dt;
      el.style.setProperty('--tilt-x',state.x.toFixed(3)+'deg');el.style.setProperty('--tilt-y',state.y.toFixed(3)+'deg');
      if(Math.abs(state.tx-state.x)+Math.abs(state.ty-state.y)+Math.abs(state.vx)+Math.abs(state.vy)>.012)state.raf=requestAnimationFrame(tick);else{state.raf=0;state.last=0;if(!el.classList.contains('motion-hover'))el.classList.remove('motion-tracking')}
    }
    function start(){if(!state.raf){state.last=0;el.classList.add('motion-tracking');state.raf=requestAnimationFrame(tick)}}
    function reset(){cancelAnimationFrame(state.raf);Object.assign(state,{x:0,y:0,vx:0,vy:0,tx:0,ty:0,raf:0,last:0});el.classList.remove('motion-tracking','motion-hover')}
    el.addEventListener('pointermove',e=>{if(!fine.matches||reduce.matches||e.pointerType==='touch')return;const r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;state.tx=-(y-.5)*8;state.ty=(x-.5)*8;el.style.setProperty('--pointer-x',(x*100).toFixed(1)+'%');el.style.setProperty('--pointer-y',(y*100).toFixed(1)+'%');el.classList.add('motion-hover');start()},{passive:true});
    el.addEventListener('pointerleave',()=>{state.tx=state.ty=0;el.classList.remove('motion-hover');if(!reduce.matches)start()});
    reduce.addEventListener('change',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset()});
  });
  reduce.addEventListener('change',()=>{if(reduce.matches)cards.forEach(e=>e.classList.add('is-visible'))});
})();
