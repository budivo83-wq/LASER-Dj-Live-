/* Geometry helpers for the virtual-only vector editor. No hardware output. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.LaserVectorEdit=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const clamp=v=>Math.max(-1,Math.min(1,v));
  function point(x,y,snap=false){
    if(!Number.isFinite(x)||!Number.isFinite(y))return null;
    const unit=snap?1/8:0;
    return [clamp(unit?Math.round(x/unit)*unit:x),clamp(unit?Math.round(y/unit)*unit:y)];
  }
  function vertexHit(points,target,width,height,radius=12){
    if(!Array.isArray(points)||!target||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return -1;
    let closest=-1,best=radius*radius;
    points.forEach((p,i)=>{
      const d=((p[0]-target[0])*width/2)**2+((p[1]-target[1])*height/2)**2;
      if(d<=best){best=d;closest=i}
    });
    return closest;
  }
  function segmentHit(points,target,width,height,closed=false,radius=11){
    if(!Array.isArray(points)||points.length<2||!target||width<=0||height<=0)return null;
    let closest=null,best=radius*radius;
    const count=closed?points.length:points.length-1;
    for(let i=0;i<count;i++){
      const a=points[i],b=points[(i+1)%points.length];
      const dx=(b[0]-a[0])*width/2,dy=(b[1]-a[1])*height/2;
      const lenSq=dx*dx+dy*dy;
      if(lenSq<1e-10)continue;
      const ox=(target[0]-a[0])*width/2,oy=(target[1]-a[1])*height/2;
      const t=Math.max(0,Math.min(1,(ox*dx+oy*dy)/lenSq));
      const d=(ox-t*dx)**2+(oy-t*dy)**2;
      if(d<=best){best=d;closest={after:i+1,point:[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])],distancePx:Math.sqrt(d)}}
    }
    return closest;
  }
  function preset(name){
    if(name==='star')return{closed:true,points:Array.from({length:10},(_,i)=>{
      const a=-Math.PI/2+i*Math.PI/5,r=i%2?.34:.82;return point(Math.cos(a)*r,Math.sin(a)*r)
    })};
    if(name==='hexagon')return{closed:true,points:Array.from({length:6},(_,i)=>{
      const a=-Math.PI/2+i*Math.PI/3;return point(Math.cos(a)*.8,Math.sin(a)*.8)
    })};
    if(name==='wave')return{closed:false,points:Array.from({length:29},(_,i)=>{
      const x=-.9+1.8*i/28;return point(x,.54*Math.sin(i/28*4*Math.PI))
    })};
    return null;
  }
  return {point,vertexHit,segmentHit,preset};
});
