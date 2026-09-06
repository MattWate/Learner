/* LearnerGenie regional configuration. Keep country-specific behaviour here rather than scattering it through activities. */
(function(){
  const regions={
    US:{countryCode:'US',label:'United States',currency:'USD',billingCurrency:'USD',locale:'en-US',levelLabel:'Grade',levelType:'grade',mathsConvention:'PEMDAS',paymentProvider:'paypal',freeWeeklyActivities:5,pricing:{one:5.99,two:7.99,four:10.99},curricula:[['US_COMMON_CORE','Common Core'],['US_STATE','State standards'],['US_HOMESCHOOL','Homeschool / Custom'],['OTHER','Other']]},
    GB:{countryCode:'GB',label:'United Kingdom',currency:'GBP',billingCurrency:'USD',locale:'en-GB',levelLabel:'Year',levelType:'year',mathsConvention:'BODMAS',paymentProvider:'paypal',freeWeeklyActivities:5,pricing:{one:5.99,two:7.99,four:10.99},curricula:[['UK_ENGLAND_NC','England National Curriculum'],['UK_WALES_CFW','Curriculum for Wales'],['UK_SCOTLAND_CFE','Curriculum for Excellence (Scotland)'],['UK_NI','Northern Ireland Curriculum'],['CAMBRIDGE','Cambridge / International'],['OTHER','Other']]},
    ZA:{countryCode:'ZA',label:'South Africa',currency:'ZAR',billingCurrency:'ZAR',locale:'en-ZA',levelLabel:'Grade',levelType:'grade',mathsConvention:'BODMAS',paymentProvider:'paystack',freeWeeklyActivities:5,pricing:null,curricula:[['ZA_CAPS','CAPS'],['ZA_IEB','IEB'],['CAMBRIDGE','Cambridge'],['OTHER','Other']]}
  };
  function byCode(code){return regions[String(code||'').toUpperCase()]||regions.ZA;}
  function inferred(){
    const host=location.hostname.toLowerCase();
    if(host.startsWith('us.'))return regions.US;
    if(host.startsWith('uk.')||host.startsWith('gb.'))return regions.GB;
    if(host.startsWith('za.')||host.startsWith('sa.'))return regions.ZA;
    const meta=document.querySelector('meta[name="learnergenie-region"]')?.content;
    if(meta&&regions[String(meta).toUpperCase()])return regions[String(meta).toUpperCase()];
    return regions.ZA;
  }
  window.LearnerRegions={regions,byCode,inferred};
})();
