/* UK onboarding localisation. Extends the existing onboarding flow without forking it. */
(function(){
  const root=document.getElementById('ob-root');
  if(!root)return;

  const supported=new Set(['US','GB','ZA']);
  let detectedRegion=window.LearnerRegions?.inferred?.()?.countryCode||'ZA';
  let activeRegion=detectedRegion;
  let familyCountryTouched=false;
  let educatorCountryTouched=false;

  function educationSystemFor(curriculum){
    const code=String(curriculum||'').toUpperCase();
    if(code==='UK_SCOTLAND_CFE')return 'Scotland';
    if(code==='UK_WALES_CFW')return 'Wales';
    if(code==='UK_NI')return 'Northern Ireland';
    if(code==='CAMBRIDGE')return 'UK / international education';
    return 'England';
  }

  function patchOnboardingRpc(){
    const client=window.LearnerAuth?.supabase;
    if(!client?.rpc||client.__ukOnboardingRpcPatched)return;
    const original=client.rpc.bind(client);
    client.rpc=function(fn,args,options){
      if(fn==='complete_family_onboarding'&&String(args?.p_country_code||'').toUpperCase()==='GB'){
        const raw=String(args?.p_grade||'').replace(/^grade\s*/i,'').replace(/^year\s*/i,'').trim();
        args={...args,
          p_grade:/^(r|reception)$/i.test(raw)?'Reception':`Year ${raw}`,
          p_education_system:educationSystemFor(args?.p_curriculum_code),
          p_maths_convention:'BODMAS'
        };
      }
      return original(fn,args,options);
    };
    client.__ukOnboardingRpcPatched=true;
  }

  function ensureGbOption(select){
    if(!select||select.querySelector('option[value="GB"]'))return;
    const option=document.createElement('option');
    option.value='GB';
    option.textContent='United Kingdom';
    const us=select.querySelector('option[value="US"]');
    if(us?.nextSibling)select.insertBefore(option,us.nextSibling);else select.appendChild(option);
  }

  function setCurriculumOptions(select,regionCode){
    if(!select||!window.LearnerRegions)return;
    const region=window.LearnerRegions.byCode(regionCode);
    const options=[...region.curricula];
    if(select.id==='edu-curriculum'&&!options.some(([value])=>value==='MIXED'))options.push(['MIXED','Mixed / multiple curricula']);
    const current=select.value;
    select.innerHTML=options.map(([value,label])=>`<option value="${String(value).replace(/"/g,'&quot;')}">${String(label).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</option>`).join('');
    if(options.some(([value])=>value===current))select.value=current;
  }

  function localiseFamilyLevel(){
    const select=document.getElementById('grade');
    if(!select)return;
    const field=select.closest('.ob-field');
    const label=field?.querySelector('label');
    const isGb=activeRegion==='GB';
    if(!isGb){
      if(label)label.textContent='Grade';
      return;
    }

    if(label)label.textContent='School year';
    const current=String(select.value||'5');
    const values=[['R','Reception'],...Array.from({length:13},(_,i)=>[String(i+1),`Year ${i+1}`])];
    select.innerHTML=values.map(([value,text])=>`<option value="${value}">${text}</option>`).join('');
    select.value=values.some(([value])=>value===current)?current:'5';
  }

  function localiseEducatorLevels(){
    const container=document.getElementById('grade-pills');
    if(!container)return;
    const field=container.closest('.ob-field');
    const label=field?.querySelector('label');
    if(activeRegion==='GB'){
      if(label)label.textContent='Years you work with';
      container.querySelectorAll('[data-grade]').forEach(button=>{
        button.textContent=`Year ${button.dataset.grade}`;
      });
    }else if(label){
      label.textContent='Grades you work with';
      container.querySelectorAll('[data-grade]').forEach(button=>{button.textContent=`Grade ${button.dataset.grade}`;});
    }
  }

  function wireFamilyCountry(){
    const select=document.getElementById('country');
    if(!select)return;
    ensureGbOption(select);
    if(!select.dataset.ukRegionWired){
      select.dataset.ukRegionWired='1';
      if(!familyCountryTouched&&supported.has(detectedRegion))select.value=detectedRegion;
      activeRegion=select.value;
      select.addEventListener('change',()=>{
        familyCountryTouched=true;
        activeRegion=select.value;
      });
    }
  }

  function wireEducatorCountry(){
    const select=document.getElementById('edu-country');
    if(!select)return;
    ensureGbOption(select);
    if(!select.dataset.ukRegionWired){
      select.dataset.ukRegionWired='1';
      if(!educatorCountryTouched&&supported.has(activeRegion))select.value=activeRegion;
      activeRegion=select.value;
      setCurriculumOptions(document.getElementById('edu-curriculum'),activeRegion);
      select.addEventListener('change',()=>{
        educatorCountryTouched=true;
        activeRegion=select.value;
        setCurriculumOptions(document.getElementById('edu-curriculum'),activeRegion);
        requestAnimationFrame(localiseEducatorLevels);
      });
    }
  }

  function apply(){
    patchOnboardingRpc();
    wireFamilyCountry();
    wireEducatorCountry();
    localiseFamilyLevel();
    localiseEducatorLevels();

    const curriculum=document.getElementById('curriculum');
    if(curriculum&&activeRegion==='GB'&&!curriculum.querySelector('option[value="UK_ENGLAND_NC"]'))setCurriculumOptions(curriculum,'GB');

    root.querySelectorAll('.ob-price').forEach(price=>{
      if(activeRegion==='GB'&&price.textContent?.includes('$')&&!price.querySelector('.uk-billing-note')){
        price.insertAdjacentHTML('beforeend',' <small class="uk-billing-note" style="font-size:11px;font-weight:700;color:var(--muted)">USD</small>');
      }
    });
  }

  const observer=new MutationObserver(()=>requestAnimationFrame(apply));
  observer.observe(root,{childList:true,subtree:true});
  apply();

  fetch('/.netlify/functions/geo-region',{cache:'no-store'})
    .then(response=>response.ok?response.json():null)
    .then(data=>{
      const region=String(data?.region||'').toUpperCase();
      if(!supported.has(region))return;
      detectedRegion=region;
      if(!familyCountryTouched&&!educatorCountryTouched)activeRegion=region;
      apply();
    })
    .catch(()=>{});
})();
