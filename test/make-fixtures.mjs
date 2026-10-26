import { cpSync,writeFileSync,readFileSync,unlinkSync } from 'node:fs'
const read=path=>JSON.parse(readFileSync(path,'utf8'))
const write=(path,value)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n')
for(const name of ['missing-section','invalid-json','bad-pricing','mismatch']) {
 cpSync('fixtures/valid','fixtures/'+name,{recursive:true})
 const doc=read('fixtures/'+name+'/.well-known/aiax.json')
 const target='fixtures/'+name+new URL(doc.entry_points[0].url,'https://x').pathname
 if(name==='missing-section') unlinkSync(target)
 if(name==='invalid-json') writeFileSync(target,'This is deliberately not JSON\n')
 if(name==='bad-pricing') {
  const section=read(target)
  section.pricing={model:'per_call',amount:1,currency:'USDC',rail:'x402'}
  write(target,section)
 }
 if(name==='mismatch') {
  const section=read(target)
  section.section_id='wrong_section'
  write(target,section)
 }
}
