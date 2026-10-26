import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { readFileSync } from 'node:fs'
const ajv=new Ajv2020({allErrors:true,strict:true})
addFormats(ajv)
const validators=Object.fromEntries(['manifest','section'].map(name=>[name,ajv.compile(JSON.parse(readFileSync(new URL(`../schemas/${name}.schema.json`,import.meta.url),'utf8')))]))
const pointer=s=>String(s).replaceAll('~','~0').replaceAll('/','~1')
export function validateDocument(kind,document,url) {
 const validator=validators[kind]
 if(validator(document)) return []
 const errors=validator.errors??[]
 const unions=errors.filter(e=>e.keyword==='oneOf'||e.keyword==='anyOf')
 const normalized=errors.filter(error=>!unions.some(parent=>error!==parent&&error.schemaPath.startsWith(parent.schemaPath+'/'))).map(error=>{
  const field=error.params.missingProperty??error.params.additionalProperty
  const path=error.instancePath+(field===undefined?'':'/'+pointer(field))
  const label=field??(error.instancePath.split('/').pop()||kind)
  const message=error.keyword==='required'?`${label} is required`:error.keyword==='additionalProperties'?`${label} is not an allowed field`:error.keyword==='type'?`${label} must be ${error.params.type}`:error.keyword==='enum'?`${label} must be one of ${error.params.allowedValues.join(', ')}`:error.keyword==='oneOf'?`${label} must be an object or a string`:`${label} ${error.message}`
  return {url,path,message}
 })
 // Ajv can report both type and enum for the same value. Keep one field diagnosis.
 return normalized.filter((error,index)=>normalized.findIndex(other=>other.path===error.path)===index)
}
