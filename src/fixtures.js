import { readFile,realpath } from 'node:fs/promises'
import { resolve,sep } from 'node:path'
export async function createFixtureFetch(directory) {
 const root=await realpath(directory)
 const inside=path=>path===root||path.startsWith(root+sep)
 return async url=>{
  try {
   const path=decodeURIComponent(new URL(url).pathname)
   if(path.includes('\\')||path.includes('\0')||path.split('/').includes('..')) throw new Error()
   const file=resolve(root,'.'+path)
   if(!inside(file)) throw new Error()
   const actual=await realpath(file)
   if(!inside(actual)) throw new Error()
   return new Response(await readFile(actual),{status:200,headers:{'content-type':'application/json'}})
  } catch {return new Response('Missing fixture',{status:404})}
 }
}
