import { readFileSync } from 'node:fs'
export const sample=JSON.parse(readFileSync(new URL('../fixtures/lax.kognai.ai.json',import.meta.url),'utf8'))
export const site='https://lax.kognai.ai'
export const manifest=()=>structuredClone(sample.manifest)
export function mock(document=manifest(),mutate=value=>value) {
 return async target=>{
  const path=new URL(target).pathname
  if(path==='/.well-known/aiax.json') return Response.json(document)
  const section=sample.sections.find(value=>new URL(value.url).pathname===path)
  return section?Response.json(mutate(structuredClone(section.body))):new Response('',{status:404})
 }
}
