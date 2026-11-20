/* Data model for independent virtual vector paths. No device or ILDA access. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.LaserVectorPaths=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const MAX_PATHS=16,MAX_POINTS=1000;
  const colorOK=c=>typeof c==='string'&&/^#[0-9a-fA-F]{6}$/.test(c);
  function makePath(name='Path 1',color='#53e9c0'){
    return {name:String(name).slice(0,40)||'Untitled',color:colorOK(color)?color:'#53e9c0',enabled:true,closed:false,points:[]};
  }
  function validate(paths){
    if(!Array.isArray(paths)||paths.length<1||paths.length>MAX_PATHS)throw Error('Invalid vector path count');
    let total=0;
    return paths.map((p,i)=>{
      if(!p||typeof p!=='object'||typeof p.name!=='string'||p.name.length>40||!colorOK(p.color)||
         typeof p.enabled!=='boolean'||typeof p.closed!=='boolean'||!Array.isArray(p.points)||p.points.length>MAX_POINTS)throw Error('Invalid vector path '+(i+1));
      total+=p.points.length;
      if(total>MAX_POINTS)throw Error('Vector layer point budget exceeded');
      if(p.points.some(v=>!Array.isArray(v)||v.length!==2||v.some(n=>!Number.isFinite(n)||n<-1||n>1)))throw Error('Invalid vector point');
      return {name:p.name,color:p.color,enabled:p.enabled,closed:p.closed,points:p.points.map(v=>[...v])};
    });
  }
  function upgradeLayer(layer){
    if(!layer||typeof layer!=='object')throw Error('Invalid vector layer');
    if(layer.vectorPaths!==undefined){
      layer.vectorPaths=validate(layer.vectorPaths);
      layer.custom=[];layer.closed=false;
      return layer.vectorPaths;
    }
    const legacy=Array.isArray(layer.custom)?layer.custom:[];
    const first=makePath('Path 1',layer.color);
    first.points=legacy.map(v=>[...v]);first.closed=!!layer.closed;
    layer.vectorPaths=validate([first]);
    // Legacy geometry has been consumed. Do not redraw it after a path is deleted.
    layer.custom=[];layer.closed=false;
    return layer.vectorPaths;
  }
  function countPoints(paths){return paths.reduce((n,p)=>n+p.points.length,0)}
  return {MAX_PATHS,MAX_POINTS,makePath,validate,upgradeLayer,countPoints};
});
