import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateSite } from '../index.js'
import { scoreReport } from '../src/validator.js'
import { sample,site,manifest,mock } from './helpers.js'

test('A1 both recorded official sites and all sections pass offline',async()=>{
 for(const host of ['lax.kognai.ai','www.kognai.ai']) {
  const recorded=JSON.parse(readFileSync(new URL(`../fixtures/${host}.json`,import.meta.url),'utf8'))
  const result=await validateSite('https://'+host,{fetch:async target=>new URL(target).pathname==='/.well-known/aiax.json'?Response.json(recorded.manifest):Response.json(recorded.sections.find(value=>value.url===target).body)})
  assert.equal(result.ok,true,JSON.stringify(result.errors))
  assert.equal(result.score,100)
  assert.equal(result.sections.length,recorded.sections.length)
  assert.ok(result.sections.every(row=>row.ok))
 }
})
test('A2 every required manifest and nested product field is named once',async()=>{
 const schema=JSON.parse(readFileSync(new URL('../schemas/manifest.schema.json',import.meta.url)))
 for(const field of schema.required) {
  const doc=manifest()
  delete doc[field]
  const r=await validateSite(site,{fetch:mock(doc)})
  assert.equal(r.ok,false)
  assert.equal(r.errors.filter(e=>e.path==='/'+field).length,1,field)
  assert.ok(r.errors.find(e=>e.path==='/'+field).message.includes(field))
 }
 for(const field of schema.properties.product.required) {
  const doc=manifest()
  delete doc.product[field]
  const r=await validateSite(site,{fetch:mock(doc)})
  assert.equal(r.errors.filter(e=>e.path==='/product/'+field).length,1)
 }
})
test('A2 wrong types, formats, bounds and escaped extra fields have precise pointers',async()=>{
 const cases=[
  [d=>{d.aiax_version=1},'/aiax_version'],
  [d=>{d.entry_points[0].id='INVALID ID'},'/entry_points/0/id'],
  [d=>{d.entry_points[0].est_tokens=0},'/entry_points/0/est_tokens'],
  [d=>{d.updated_at='yesterday'},'/updated_at'],
  [d=>{d.mcp_endpoint='not a uri'},'/mcp_endpoint'],
  [d=>{d.product.name='x'.repeat(61)},'/product/name'],
  [d=>{d['a/b~c']=true},'/a~1b~0c'],
  [d=>{d.entry_points[0].url=12},'/entry_points/0/url']
 ]
 for(const [mutate,path] of cases) {
  const doc=manifest()
  mutate(doc)
  const r=await validateSite(site,{fetch:mock(doc)})
  assert.equal(r.ok,false,path)
  assert.equal(r.errors.filter(e=>e.path===path).length,1,path)
  assert.ok(r.score<100)
 }
})
test('A2 nulls and schema-permitted arbitrary extensions are accepted',async()=>{
 const doc=manifest()
 doc.pricing_summary=null
 doc.mcp_endpoint=null
 doc.extensions={custom:{anything:[1,true,null]}}
 assert.equal((await validateSite(site,{fetch:mock(doc)})).ok,true)
})
test('A3 every required section field is named once per document',async()=>{
 const schema=JSON.parse(readFileSync(new URL('../schemas/section.schema.json',import.meta.url)))
 for(const field of schema.required) {
  const r=await validateSite(site,{fetch:mock(manifest(),doc=>{delete doc[field]
   return doc})})
  assert.equal(r.ok,false)
  assert.ok(r.sections.every(row=>row.errors.length===1),field)
  assert.ok(r.errors.every(e=>e.path==='/'+field&&e.message.includes(field)),field)
 }
})
test('A3 pricing types and formats, unions, mismatch, extras and examples',async()=>{
 const cases=[
  [d=>{d.pricing={model:'per_call',amount:1,currency:'USDC',rail:'x402'}},'/pricing/amount'],
  [d=>{d.pricing={model:'per_call',amount:'-1',currency:'USDC',rail:'x402'}},'/pricing/amount'],
  [d=>{d.pricing={model:'bogus',amount:'1',currency:'USDC',rail:'x402'}},'/pricing/model'],
  [d=>{d.inputs=[]},'/inputs'],
  [d=>{d.outputs=false},'/outputs'],
  [d=>{d.section_id='different'},'/section_id'],
  [d=>{d.unrecognized=true},'/unrecognized'],
  [d=>{d.examples=[]},'/examples']
 ]
 for(const [change,path] of cases) {
  const r=await validateSite(site,{fetch:mock(manifest(),doc=>{change(doc)
   return doc})})
  assert.equal(r.ok,false)
  assert.ok(r.sections.every(row=>!row.ok&&row.errors.length===1),JSON.stringify(r.errors))
  assert.ok(r.errors.every(e=>e.path===path&&e.message.length>5))
 }
 assert.equal((await validateSite(site,{fetch:mock(manifest(),doc=>({...doc,pricing:null}))})).ok,true)
})
test('A3 unavailable, invalid JSON and hanging sections fail independently',async()=>{
 for(const bad of [()=>new Response('',{status:404}),()=>new Response('not json'),()=>Promise.reject(new Error('offline')),()=>new Promise(()=>{})]) {
  const r=await validateSite(site,{timeoutMs:20,fetch:async target=>new URL(target).pathname==='/.well-known/aiax.json'?Response.json(manifest()):bad()})
  assert.equal(r.ok,false)
  assert.equal(r.sections.length,sample.sections.length)
  assert.ok(r.sections.every(row=>!row.ok&&row.errors.length===1))
 }
})
test('A2 manifest fallback and section references use the actual manifest URL',async()=>{
 const doc=manifest()
 doc.entry_points=doc.entry_points.slice(0,1)
 doc.entry_points[0].url='sections/first.json'
 const visited=[]
 const r=await validateSite(site+'/ignored/path',{fetch:async target=>{
  visited.push(target)
  if(target===site+'/.well-known/aiax.json') return new Response('bad json')
  if(target===site+'/aiax/manifest.json') return {ok:true,url:'https://cdn.example/v1/manifest.json',json:async()=>doc}
  assert.equal(target,'https://cdn.example/v1/sections/first.json')
  return Response.json(sample.sections[0].body)
 }})
 assert.equal(r.ok,true,JSON.stringify(r.errors))
 assert.equal(r.manifest_url,'https://cdn.example/v1/manifest.json')
 assert.equal(visited.length,3)
})
test('A2 schema-invalid first manifest is diagnosed without hiding it behind fallback',async()=>{
 const calls=[]
 const r=await validateSite(site,{fetch:async target=>{calls.push(target)
  return Response.json(null)}})
 assert.equal(r.ok,false)
 assert.equal(calls.length,1)
 assert.ok(r.errors[0].message.includes('manifest'))
})
test('A2 missing manifests and invalid input never throw',async()=>{
 for(const fetch of [async()=>new Response('',{status:404}),async()=>{throw new Error('offline')},async()=>new Promise(()=>{})]) {
  const r=await validateSite(site,{fetch,timeoutMs:10})
  assert.equal(r.ok,false)
  assert.equal(r.errors.length,1)
  assert.equal(r.manifest_url,null)
 }
 for(const url of [null,5,'file:///secret','https://user:pass@example.com','nonsense']) assert.equal((await validateSite(url)).ok,false)
 assert.equal((await validateSite(site,{fetch:null})).ok,false)
})
test('A3 at most four section fetches run together and report order is stable',async()=>{
 let active=0,max=0
 const r=await validateSite(site,{fetch:async target=>{
  if(new URL(target).pathname==='/.well-known/aiax.json') return Response.json(manifest())
  active++
  max=Math.max(active,max)
  await new Promise(resolve=>setTimeout(resolve,5))
  active--
  return mock()(target)
 }})
 assert.equal(r.ok,true)
 assert.ok(max>1&&max<=4)
 assert.deepEqual(r.sections.map(row=>row.id),sample.manifest.entry_points.map(row=>row.id))
})
test('A2 score is bounded and strictly decreases for each error before zero',()=>{
 assert.equal(scoreReport([],[]),100)
 let count=1
 while(count<=10) {
  assert.ok(scoreReport(Array(count),[])<scoreReport(Array(count-1),[]))
  count++
 }
 assert.equal(scoreReport(Array(100),[]),0)
 assert.ok(scoreReport([],Array(1))<100)
})
