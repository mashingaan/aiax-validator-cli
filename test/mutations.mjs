import { mkdtempSync,cpSync,readFileSync,writeFileSync,rmSync } from 'node:fs'
import { resolve,join,sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
const root=process.cwd()
const mutants=[
 ['skip manifest schema','src/validator.js',"report.errors.push(...validateDocument('manifest',manifest,report.manifest_url))",''],
 ['skip section schema','src/validator.js',"row.errors.push(...validateDocument('section',document,row.url))",''],
 ['ignore section id','src/validator.js',"typeof document?.section_id==='string'&&document.section_id!==entry.id",'false'],
 ['accept every report','src/validator.js','ok:report.errors.length===0','ok:true'],
 ['constant score','src/validator.js','100-10*errors.length-2*warnings.length','100'],
 ['resolve against site','src/validator.js','httpUrl(entry.url,report.manifest_url)','httpUrl(entry.url,site)'],
 ['accept extra fields','src/schema.js','const normalized=errors.filter(error=>','const normalized=errors.filter(error=>error.keyword!==\'additionalProperties\').filter(error=>'],
 ['phantom entry URL errors','src/validator.js',"entry===null||typeof entry!=='object'||Array.isArray(entry)",'false']
]
for(const [name,file,before,after] of mutants) {
 const dir=mkdtempSync(join(root,'.mutant-'))
 assert.ok(resolve(dir).startsWith(resolve(root)+sep))
 try {
  for(const file of ['src','schemas','test','fixtures','index.js','package.json']) cpSync(join(root,file),join(dir,file),{recursive:true})
  const path=join(dir,file)
  const source=readFileSync(path,'utf8')
  assert.equal(source.split(before).length,2,name+' target must occur exactly once')
  writeFileSync(path,source.replace(before,after))
  const syntax=spawnSync(process.execPath,['--check',path],{encoding:'utf8'})
  assert.equal(syntax.status,0,syntax.stderr)
  const run=spawnSync(process.execPath,['--test','test/validator.test.js','test/cli.test.js'],{cwd:dir,encoding:'utf8',timeout:30000})
  assert.equal(run.error,undefined,name)
  assert.ok(run.status>0,name+' survived')
  assert.ok(/AssertionError|ERR_ASSERTION/.test(run.stdout),name+' must be killed by an assertion')
  assert.ok(!/ERR_MODULE_NOT_FOUND|SyntaxError/.test(run.stdout+run.stderr),name+' failed to execute')
  console.log('Killed: '+name)
 } finally {rmSync(dir,{recursive:true,force:true})}
}
