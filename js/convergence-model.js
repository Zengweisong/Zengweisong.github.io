(function(root){
  const duration=9;
  const clamp=x=>Math.max(0,Math.min(1,x));
  const smooth=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10)};
  function state(seconds){
    const time=Math.max(0,Math.min(duration,seconds));
    const alignment=smooth((time-2.2)/3.5),collapse=smooth((time-5.7)/3);
    return {time,alignment,collapse,
      dot:smooth((time-7.9)/.8),reveal:smooth((time-7.2)/1.8),
      strands:1-smooth((alignment-.55)/.45),spine:smooth((alignment-.15)/.85),
      line:1-smooth((collapse-.94)/.06),
      stage:time<2.2?'complex':time<5.7?'line':time<8.7?'point':'simple',done:time>=duration};
  }
  function basis(u,row){return {u,envelope:Math.sin(u*Math.PI),
    sinA:Math.sin(u*Math.PI*3.1+row*1.7),cosA:Math.cos(u*Math.PI*3.1+row*1.7),
    sinB:Math.sin(u*Math.PI*5.2+row*2.5),cosB:Math.cos(u*Math.PI*5.2+row*2.5),offset:row*89};}
  function frame(time){const s=state(time),phase=s.time*.92;return {...s,
    sinA:Math.sin(phase),cosA:Math.cos(phase),sinB:Math.sin(phase*.73),cosB:Math.cos(phase*.73)};}
  function sample(b,f){
    const turbulence=((b.sinA*f.cosA+b.cosA*f.sinA)*82+
      (b.cosB*f.cosB+b.sinB*f.sinB)*31+b.offset)*b.envelope;
    return {x:560+(b.u-.5)*980*(1-f.collapse),y:163+turbulence*(1-f.alignment)};
  }
  function point(u,row,time){
    return sample(basis(u,row),frame(time));
  }
  // Catmull–Rom interpolation keeps the glowing curves smooth between samples.
  function curve(points){
    const n=points.length-1;let d='M'+points[0].x.toFixed(2)+' '+points[0].y.toFixed(2);
    for(let i=0;i<n;i++){
      const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],e=points[Math.min(n,i+2)];
      d+='C'+(b.x+(c.x-a.x)/6).toFixed(2)+' '+(b.y+(c.y-a.y)/6).toFixed(2)+' '+
        (c.x-(e.x-b.x)/6).toFixed(2)+' '+(c.y-(e.y-b.y)/6).toFixed(2)+' '+c.x.toFixed(2)+' '+c.y.toFixed(2);
    }return d;
  }
  const api={duration,state,point,basis,frame,sample,curve};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ConvergenceModel=api;
})(typeof window==='object'?window:globalThis);
