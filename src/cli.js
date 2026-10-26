#!/usr/bin/env node
import { stat } from 'node:fs/promises'
import { validateSite } from './validator.js'
import { createFixtureFetch } from './fixtures.js'
import { httpUrl } from './fetch.js'
async function main() {
 const args=process.argv.slice(2)
 let url,json=false,directory
 try {
  while(args.length) {
   const arg=args.shift()
   if(arg==='--json'&&!json) json=true
   else if(arg==='--fixtures'&&directory===undefined&&args.length&&!args[0].startsWith('--')) directory=args.shift()
   else if(!arg.startsWith('-')&&url===undefined) url=arg
   else throw new Error()
  }
  if(!url) throw new Error()
  httpUrl(url)
  if(directory!==undefined&&!(await stat(directory)).isDirectory()) throw new Error()
 } catch {
  process.stderr.write('Usage: aiax-validate <http-url> [--json] [--fixtures <directory>]\n')
  process.exitCode=2
  return
 }
 const fetch=directory===undefined?globalThis.fetch:await createFixtureFetch(directory)
 const report=await validateSite(url,{fetch})
 if(json) process.stdout.write(JSON.stringify(report)+'\n')
 else if(report.ok) process.stdout.write(`Valid AIAX surface. Score ${report.score}.\n`)
 else for(const error of report.errors) process.stdout.write(`${error.url} ${error.path||'/'}: ${error.message}\n`)
 process.exitCode=report.ok?0:1
}
main().catch(()=>{process.stderr.write('Could not validate the site\n')
 process.exitCode=1})
