(() => {
  const dataNode=document.getElementById('folio-data');
  if(!dataNode)return;
  const projects=JSON.parse(dataNode.textContent), rows=[...document.querySelectorAll('.folio-row')];
  if(!projects.length)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const display=document.querySelector('.folio-display'), dialog=document.querySelector('.folio-dialog');
  const bySlug=new Map(projects.map(project=>[project.slug,project]));
  let current=projects[0].slug,fade,selection=0;
  function portrait(image){image.classList.toggle('is-portrait',image.dataset.fit==='contain'||image.naturalHeight>image.naturalWidth*1.7)}
  const firstImage=display.querySelector('img');
  if(firstImage.complete)portrait(firstImage);else firstImage.addEventListener('load',()=>portrait(firstImage),{once:true});
  async function select(row){
    const project=bySlug.get(row.dataset.project);
    if(!project||project.slug===current)return;
    current=project.slug;
    const token=++selection;
    rows.forEach(candidate=>candidate.classList.toggle('is-current',candidate===row));
    const image=row.querySelector('.folio-source').cloneNode();image.hidden=false;image.className='folio-preview';
    try{await image.decode()}catch{return}
    if(token!==selection)return;
    portrait(image);display.replaceChildren(image);
    document.querySelector('[data-preview-name]').textContent=project.name;
    document.querySelector('[data-preview-number]').textContent=`${String(projects.indexOf(project)+1).padStart(2,'0')} / ${String(projects.length).padStart(2,'0')}`;
    fade?.cancel();
    if(!reduced.matches)fade=image.animate([{opacity:.35},{opacity:1}],{duration:160,easing:'ease-out'});
  }
  rows.forEach(row=>{
    row.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')select(row)});
    row.addEventListener('focusin',()=>select(row));
  });

  let opener,previousOverflow='',frame=0,last=0,value=0,velocity=0,target=1;
  function paint(){dialog.style.opacity=String(Math.max(0,Math.min(1,value)));dialog.style.transform=reduced.matches?'none':`translateY(${(1-value)*18}px) scale(${.965+value*.035})`}
  function close(){dialog.close();document.documentElement.style.overflow=previousOverflow;opener?.focus({preventScroll:true})}
  function tick(stamp){
    const dt=last?Math.min((stamp-last)/1000,1/60):1/60;last=stamp;
    const omega=24;velocity+=(omega*omega*(target-value)-2*omega*velocity)*dt;value+=velocity*dt;paint();
    if(Math.abs(value-target)+Math.abs(velocity)<.008){value=target;velocity=0;frame=0;last=0;paint();if(!target)close()}
    else frame=requestAnimationFrame(tick);
  }
  function animate(next){
    target=next;
    if(reduced.matches){cancelAnimationFrame(frame);frame=0;last=0;value=target;velocity=0;paint();if(!target)close()}
    else if(!frame)frame=requestAnimationFrame(tick);
  }
  document.querySelectorAll('[data-open]').forEach(button=>button.addEventListener('click',()=>{
    const project=bySlug.get(button.dataset.open);if(!project)return;
    opener=button;const image=dialog.querySelector('[data-detail-image]');image.src=project.cover;image.alt=`${project.name} 界面`;
    dialog.querySelector('#folio-detail-title').textContent=project.name;
    dialog.querySelector('[data-detail-type]').textContent=project.category.join(' / ');
    dialog.querySelector('[data-detail-description]').textContent=project.description;
    dialog.querySelector('[data-detail-role]').textContent=project.role;
    dialog.querySelector('[data-detail-tech]').textContent=project.tech.join(' · ');
    dialog.querySelector('[data-detail-page]').href=project.path;
    const external=dialog.querySelector('[data-detail-external]');external.hidden=!project.external;external.href=project.external;external.textContent=`${project.externalLabel} ↗`;
    previousOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';
    value=0;velocity=0;paint();dialog.showModal();
    const from=button.getBoundingClientRect(),to=dialog.getBoundingClientRect();
    dialog.style.transformOrigin=`${Math.max(0,Math.min(100,(from.left+from.width/2-to.left)/to.width*100))}% ${Math.max(0,Math.min(100,(from.top+from.height/2-to.top)/to.height*100))}%`;
    dialog.querySelector('.folio-dialog-scroll').scrollTop=0;animate(1);
  }));
  dialog.querySelector('.folio-close').addEventListener('click',()=>animate(0));
  dialog.addEventListener('cancel',event=>{event.preventDefault();animate(0)});
  dialog.addEventListener('click',event=>{if(event.target===dialog)animate(0)});
  reduced.addEventListener('change',()=>{fade?.cancel();if(dialog.open&&reduced.matches)animate(target)});
})();
