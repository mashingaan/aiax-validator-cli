import { validateDocument } from './schema.js'
import { fetchJson,httpUrl } from './fetch.js'
export const scoreReport=(errors,warnings)=>Math.max(0,100-10*errors.length-2*warnings.length)
export async function validateSite(url,{fetch:fetcher=globalThis.fetch,timeoutMs=15000}={}) {
 const report={url:typeof url==='string'?url:'',manifest_url:null,ok:false,score:0,errors:[],warnings:[],sections:[]}
 const finish=()=>{
  report.errors=report.errors.filter((error,index,all)=>all.findIndex(other=>other.url===error.url&&other.path===error.path)===index)
  return {...report,ok:report.errors.length===0,score:scoreReport(report.errors,report.warnings)}
 }
 let site
 try {
  if(typeof url!=='string') throw new Error()
  site=httpUrl(url)
  if(typeof fetcher!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>2147483647) throw new Error()
 } catch {
  report.errors.push({url:report.url,path:'',message:'Site URL must be HTTP or HTTPS and options must be valid'})
  return finish()
 }
 let manifest
 for(const path of ['/.well-known/aiax.json','/aiax/manifest.json']) {
  const target=new URL(path,site).href
  try {
   const result=await fetchJson(target,fetcher,timeoutMs)
   manifest=result.document
   report.manifest_url=result.url
   break
  } catch {}
 }
 if(report.manifest_url===null) {
  report.errors.push({url:new URL('/aiax/manifest.json',site).href,path:'',message:'Manifest could not be fetched or decoded from either location'})
  return finish()
 }
 report.errors.push(...validateDocument('manifest',manifest,report.manifest_url))
 const entries=Array.isArray(manifest?.entry_points)?manifest.entry_points:[]
 // Four at a time bounds provider load without imposing an undocumented entry limit.
 let offset=0
 const rows=Array(entries.length)
 const work=async()=>{
  while(offset<entries.length) {
   const index=offset++
   const entry=entries[index]
   const row={id:typeof entry?.id==='string'?entry.id:'',url:'',ok:false,errors:[]}
   rows[index]=row
   if(entry===null||typeof entry!=='object'||Array.isArray(entry)) {
    row.errors.push(...report.errors.filter(error=>error.path===`/entry_points/${index}`))
    continue
   }
   try {
    if(typeof entry?.url!=='string') throw new Error()
    row.url=httpUrl(entry.url,report.manifest_url).href
   } catch {
    row.errors.push({url:report.manifest_url,path:`/entry_points/${index}/url`,message:'url must resolve to HTTP or HTTPS without credentials'})
    continue
   }
   try {
    const {document}=await fetchJson(row.url,fetcher,timeoutMs)
    row.errors.push(...validateDocument('section',document,row.url))
    if(typeof document?.section_id==='string'&&document.section_id!==entry.id) row.errors.push({url:row.url,path:'/section_id',message:'section_id must match its manifest entry point id'})
   } catch {row.errors.push({url:row.url,path:'',message:'Section could not be fetched or decoded as JSON'})}
   row.ok=row.errors.length===0
  }
 }
 await Promise.all(Array.from({length:Math.min(4,entries.length)},work))
 report.sections=rows
 report.errors.push(...rows.flatMap(row=>row.errors))
 return finish()
}
