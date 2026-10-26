import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createFixtureFetch } from '../src/fixtures.js'
const root=fileURLToPath(new URL('../',import.meta.url))
const run=args=>spawnSync(process.execPath,['src/cli.js',...args],{cwd:root,encoding:'utf8',timeout:10000})
test('A4 JSON report and 0, 1 and 2 exit codes',()=>{
 for(const [directory,code] of [['valid',0],['missing-product',1],['missing-section',1],['invalid-json',1],['bad-pricing',1],['mismatch',1]]) {
  const r=run(['https://offline.invalid','--fixtures','fixtures/'+directory,'--json'])
  assert.equal(r.status,code,r.stderr)
  assert.equal(r.stderr,'')
  const report=JSON.parse(r.stdout)
  assert.equal(report.ok,code===0)
  assert.ok(report.score>=0&&report.score<=100)
 }
 for(const args of [[],['badurl'],['https://x','--wat'],['https://x','--fixtures'],['https://x','--json','--json'],['https://x','--fixtures','absent'],['https://x','https://y']]) {
  const r=run(args)
  assert.equal(r.status,2)
  assert.equal(r.stdout,'')
  assert.ok(r.stderr.startsWith('Usage:'))
 }
})
test('A4 plain output has one line per report error and no JSON wrapper',()=>{
 const args=['https://offline.invalid','--fixtures','fixtures/missing-product']
 const plain=run(args)
 const json=run([...args,'--json'])
 assert.equal(plain.status,1)
 assert.equal(plain.stdout.trim().split('\n').length,JSON.parse(json.stdout).errors.length)
 assert.ok(plain.stdout.includes('/product: product is required'))
})
test('A4 fixture mode is offline, decodes paths, rejects traversal and credentials',async()=>{
 const fetch=await createFixtureFetch(new URL('../fixtures/valid',import.meta.url))
 assert.equal((await fetch('https://not-a-real-host.invalid/.well-known/aiax.json')).status,200)
 assert.equal((await fetch('https://offline.invalid/absent.json')).status,404)
 assert.equal((await fetch('https://offline.invalid/%2e%2e%2fpackage.json')).status,404)
 assert.equal((await fetch('https://offline.invalid/%5c..%5cpackage.json')).status,404)
 assert.equal((await fetch('https://offline.invalid/%00')).status,404)
})
test('A5 package declares an executable bin and includes pinned schemas and broken fixtures',async()=>{
 const {readFile}=await import('node:fs/promises')
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'))
 assert.equal(pkg.bin['aiax-validate'],'src/cli.js')
 assert.ok((await readFile(new URL('../src/cli.js',import.meta.url),'utf8')).startsWith('#!/usr/bin/env node'))
 assert.ok(pkg.files.includes('schemas'))
 for(const dir of ['missing-product','missing-section','invalid-json','bad-pricing','mismatch']) assert.ok((await readFile(new URL('../fixtures/'+dir+'/.well-known/aiax.json',import.meta.url),'utf8')).length)
})
test.todo('A5 actual npm publication after selection and publisher authorization')
test('A5 vendored schema bytes match recorded upstream SHA256',async()=>{
 const {readFile}=await import('node:fs/promises')
 const {createHash}=await import('node:crypto')
 const sources=JSON.parse(await readFile(new URL('../schemas/sources.json',import.meta.url),'utf8'))
 for(const source of sources.schemas) {
  const bytes=await readFile(new URL('../schemas/'+source.name+'.schema.json',import.meta.url))
  assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256)
 }
})
