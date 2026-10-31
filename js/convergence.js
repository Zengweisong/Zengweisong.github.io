(()=>{
  const model=window.ConvergenceModel,ns='http://www.w3.org/2000/svg';
  const hero=document.querySelector('.hero'),stage=document.querySelector('.art');
  const lines=document.getElementById('ribbon-lines'),bloom=document.getElementById('ribbon-glow');
  const replay=document.getElementById('replay-story'),pause=document.getElementById('pause-story'),skip=document.getElementById('skip-story');
  const status=document.getElementById('field-status'),media=matchMedia('(prefers-reduced-motion: reduce)');
  const mobile=matchMedia('(max-width:700px)').matches,count=mobile?17:25,samples=mobile?20:26;
  const loopHold=1.5;
  function create(tag,attrs,parent){const el=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);parent.appendChild(el);return el}
  const paths=Array.from({length:count},(_,i)=>create('path',{fill:'none',stroke:'url(#ribbon)','stroke-width':i%5===0?1.9:.85,opacity:.3+.6*Math.sin((i+1)/(count+1)*Math.PI)},lines));
  const glow=create('path',{fill:'none',stroke:'url(#ribbon)','stroke-width':24,opacity:.6},bloom);
  const spine=create('path',{fill:'none',stroke:'url(#ribbon)','stroke-width':1.8,'stroke-linecap':'round',opacity:0},lines);
  const bases=paths.map((_,i)=>Array.from({length:samples+1},(_,k)=>model.basis(k/samples,(i-(count-1)/2)/((count-1)/2))));
  const weights=paths.map((_,i)=>.22+.7*Math.sin((i+1)/(count+1)*Math.PI));
  const sparks=create('g',{'aria-hidden':'true'},lines);
  const particles=Array.from({length:mobile?18:32},(_,i)=>create('circle',{r:i%6===0?2.2:1.2,fill:i%3?'#d6c3ff':'#ffffff'},sparks));
  const focus=create('g',{},document.getElementById('field'));
  const halo=create('circle',{cx:560,cy:163,r:26,fill:'url(#point-glow)',opacity:0},focus);
  const core=create('circle',{cx:560,cy:163,r:5.5,fill:'#f6f1ff',opacity:0},focus);
  let time=media.matches?model.duration:0,playing=!media.matches,completed=media.matches,inView=true,last=0,raf=0,previousStage='',strandsVisible=true;
  function draw(){
    const s=model.frame(time);let center='';
    if(s.strands>0){
      paths.forEach((p,i)=>{const d=model.curve(bases[i].map(b=>model.sample(b,s)));
        p.setAttribute('d',d);p.style.opacity=String(weights[i]*s.strands);
        if(i===Math.floor(count/2))center=d;
      });strandsVisible=true;
    }else{
      if(strandsVisible){paths.forEach(p=>{p.style.opacity='0'});strandsVisible=false}
      center=model.curve(bases[Math.floor(count/2)].map(b=>model.sample(b,s)));
    }
    spine.setAttribute('d',center);spine.setAttribute('opacity',s.spine*s.line);
    glow.setAttribute('d',center);glow.setAttribute('opacity',String((.42+.18*s.spine)*s.line));
    particles.forEach((p,i)=>{const u=((i*.61803398875+time*(.06+(i%4)*.009))%1),row=Math.sin(i*2.39);const pt=model.sample(model.basis(u,row),s);p.setAttribute('cx',pt.x);p.setAttribute('cy',pt.y);p.setAttribute('opacity',String(Math.sin(u*Math.PI)**2*.9*(1-s.collapse)))});
    halo.setAttribute('opacity',s.dot);core.setAttribute('opacity',s.dot);
    hero.style.setProperty('--clarity',s.reveal.toFixed(3));
    hero.style.setProperty('--noise',((1-s.alignment)*.75+.25*(1-s.collapse)).toFixed(3));
    if(previousStage!==s.stage){previousStage=s.stage;hero.dataset.story=s.stage;status.textContent={complex:'纷繁',line:'归一',point:'凝聚',simple:'把复杂，变简单。'}[s.stage]}
  }
  function reflect(){
    const done=completed;
    pause.hidden=done;skip.hidden=done;replay.hidden=!done;
    pause.textContent=playing?'Ⅱ 暂停':'▷ 继续';pause.setAttribute('aria-pressed',String(!playing));
    pause.setAttribute('aria-label',playing?'暂停收束动效':'继续收束动效');
    stage.setAttribute('aria-label',done?'光线收束成一个点':playing?'多条光线逐渐收束为线与点':'收束动效已暂停');
  }
  function tick(stamp){
    raf=0;if(!playing||!inView||document.hidden)return;
    const dt=last?Math.min((stamp-last)/1000,.12):0;last=stamp;
    time+=dt;
    if(time>=model.duration&&media.matches){finish();return}
    if(time>=model.duration+loopHold)time=0;
    draw();raf=requestAnimationFrame(tick);
  }
  function sync(){cancelAnimationFrame(raf);raf=0;last=0;reflect();if(playing&&inView&&!document.hidden)raf=requestAnimationFrame(tick)}
  function finish(){time=model.duration;playing=false;completed=true;draw();sync()}
  replay.addEventListener('click',()=>{time=0;playing=true;completed=false;previousStage='';draw();sync();pause.focus()});
  pause.addEventListener('click',()=>{playing=!playing;sync()});
  skip.addEventListener('click',()=>{finish();replay.focus()});
  document.addEventListener('visibilitychange',sync);
  new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;sync()},{threshold:.04}).observe(stage);
  media.addEventListener('change',e=>{if(e.matches)finish()});
  addEventListener('pagehide',()=>{cancelAnimationFrame(raf);raf=0;last=0});
  addEventListener('pageshow',e=>{if(e.persisted)sync()});
  draw();sync();
})();
