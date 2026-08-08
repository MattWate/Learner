/* LearnerGenie regional configuration. Keep country-specific behaviour here rather than scattering it through activities. */
(function(){
  const regions={
    US:{countryCode:'US',label:'United States',currency:'USD',mathsConvention:'PEMDAS',paymentProvider:'paypal',freeWeeklyActivities:5,pricing:{one:5.99,two:7.99,four:10.99},curricula:[['US_COMMON_CORE','Common Core'],['US_STATE','State standards'],['US_HOMESCHOOL','Homeschool / Custom'],['OTHER','Other']]},
    ZA:{countryCode:'ZA',label:'South Africa',currency:'ZAR',mathsConvention:'BODMAS',paymentProvider:'paystack',freeWeeklyActivities:5,pricing:null,curricula:[['ZA_CAPS','CAPS'],['ZA_IEB','IEB'],['CAMBRIDGE','Cambridge'],['OTHER','Other']]}
  };
  function byCode(code){return regions[String(code||'').toUpperCase()]||regions.ZA;}
  function inferred(){
    const host=location.hostname.toLowerCase();
    if(host.startsWith('us.'))return regions.US;
    if(host.startsWith('za.')||host.startsWith('sa.'))return regions.ZA;
    return regions.ZA;
  }
  window.LearnerRegions={regions,byCode,inferred};
})();
