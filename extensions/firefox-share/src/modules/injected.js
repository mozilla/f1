
(function () {
  // __API_* strings are replaced in injector.js with specifics from
  // the provider class
  let apibase = '__API_BASE__';
  let fname = '__API_NAME__';
  let api_ns = apibase.split('.');
  let api = this;
  for (let i in api_ns) {
    if (!api[api_ns[i]]) 
      api[api_ns[i]] = {}
    api = api[api_ns[i]]
  }
  api[fname] = this['__API_INJECTED__'];
  delete this['__API_INJECTED__'];
  //dump("injected: "+eval(apibase+'.'+fname)+"\n");
})();
