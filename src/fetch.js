export function httpUrl(input,base) {
 const url=new URL(input,base)
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password) throw new Error('An HTTP or HTTPS URL without credentials is required')
 return url
}
export async function fetchJson(url,fetcher,timeoutMs) {
 const controller=new AbortController()
 let timer
 try {
  return await Promise.race([new Promise((_,reject)=>{timer=setTimeout(()=>{reject(new Error('Fetch timed out'))
   controller.abort()},timeoutMs)}),(async()=>{
   const response=await fetcher(url,{signal:controller.signal})
   if(!response.ok) throw new Error(`HTTP ${response.status}`)
   const actual=response.url?httpUrl(response.url).href:url
   return {url:actual,document:await response.json()}
  })()])
 } finally {clearTimeout(timer)}
}
