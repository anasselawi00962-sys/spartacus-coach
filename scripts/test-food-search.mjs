import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const workerSource=await readFile('worker/index.js','utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from('const ASSETS={};\n'+workerSource).toString('base64'))).default;
const originalFetch=globalThis.fetch;
globalThis.fetch=async input=>{
 assert.match(String(input),/openfoodfacts.org\/cgi\/search.pl/);
 return Response.json({products:[
  {code:'123',product_name:'Test milk',nutriments:{'energy-kcal_100g':60,proteins_100g:3.2,carbohydrates_100g:4.8,fat_100g:3.3}},
  {code:'124',product_name:'No calories',nutriments:{proteins_100g:2,carbohydrates_100g:10,fat_100g:1}},
  {code:'125',product_name:'Bad fat',nutriments:{'energy-kcal_100g':90,proteins_100g:2,carbohydrates_100g:5,fat_100g:120}}
 ]});
};
try {
 const req=(p,auth=true)=>new Request('https://app.example.test'+p,{headers:auth?{'oai-authenticated-user-id':'u-1'}:{}});
 let r=await worker.fetch(req('/api/foods/search?q=milk'),{});
 assert.equal(r.status,200);let body=await r.json();
 assert.equal(body.items.length,1);
 assert.equal(body.items[0].per100g.kcal,60);
 assert.equal(body.items[0].per100g.protein,3.2);
 assert.equal(body.items[0].source,'Open Food Facts');
 assert.equal((await worker.fetch(req('/api/foods/search?q=milk',false),{})).status,401);
 assert.equal((await worker.fetch(req('/api/foods/search?q=x'),{})).status,400);
 r=await worker.fetch(req('/api/foods/search?q=milk&source=usda'),{});
 body=await r.json();assert.equal(body.items.length,0);assert(body.errors.length>0);
}finally{globalThis.fetch=originalFetch;}
const html=await readFile('public/index.html','utf8');
const catalog=await readFile('public/food-catalog.js','utf8');
for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Function(script[1]);
new Function(catalog);
assert(html.includes('src="food-catalog.js"'));
assert(catalog.includes('data.items'));
console.log('Global food lookup: authenticated search, complete nutrient values, missing values rejected, frontend syntax verified.');
