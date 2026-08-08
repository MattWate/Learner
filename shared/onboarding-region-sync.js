/* Keeps educator curriculum choices aligned to the selected country. */
(function(){
  document.addEventListener('change',event=>{
    if(event.target?.id!=='edu-country') return;
    const curriculum=document.getElementById('edu-curriculum');
    if(!curriculum||!window.LearnerRegions) return;
    const region=window.LearnerRegions.byCode(event.target.value);
    const options=[...region.curricula];
    if(!options.some(([value])=>value==='MIXED')) options.push(['MIXED','Mixed / multiple curricula']);
    curriculum.innerHTML=options.map(([value,label])=>`<option value="${String(value).replace(/"/g,'&quot;')}">${String(label).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</option>`).join('');
  });
})();
