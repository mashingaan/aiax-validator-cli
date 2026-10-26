import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { validateSite } from '../index.js'
const results=[]
for(const url of ['https://lax.kognai.ai','https://www.kognai.ai']) {
 const report=await validateSite(url)
 assert.equal(report.ok,true,JSON.stringify(report.errors))
 assert.ok(report.score>=90)
 const cli=spawnSync(process.execPath,['src/cli.js',url,'--json'],{encoding:'utf8',timeout:120000})
 assert.equal(cli.status,0,cli.stdout+cli.stderr)
 assert.ok(JSON.parse(cli.stdout).score>=90)
 results.push({checked_at:new Date().toISOString(),report,cli:JSON.parse(cli.stdout)})
 console.log(url+' valid, score '+report.score)
}
writeFileSync('live-results.json',JSON.stringify(results,null,2)+'\n')
