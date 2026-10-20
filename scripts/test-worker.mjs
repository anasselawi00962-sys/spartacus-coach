import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const text=await readFile('dist/server/index.js','utf8');const worker=(await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'))).default;
class Bucket{constructor(){this.data=new Map();}async get(key){const value=this.data.get(key);return value===undefined?null:{json:async()=>JSON.parse(value)};}async put(key,value,opts){if(opts?.onlyIf&&this.data.has(key))return null;this.data.set(key,value);return{etag:'x'};}async delete(key){this.data.delete(key);}async list({prefix}){return{objects:[...this.data.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))};}}
const env={BUCKET:new Bucket(),SPARTACUS_ADMIN_EMAIL:'owner@example.test',RUNWAY_GENERATION_ENABLED:'false'};
const req=(path,body,extra={})=>new Request('https://coach.example.test'+path,{method:body?'POST':'GET',headers:{'oai-authenticated-user-id':'test-owner','oai-authenticated-user-email':'owner@example.test',...(body?{'content-type':'application/json',origin:'https://coach.example.test'}:{}),...extra},body:body?JSON.stringify(body):undefined});
assert.equal((await worker.fetch(new Request('https://coach.example.test/api/admin/config'),env)).status,401);
assert.equal((await worker.fetch(req('/api/admin/config',null,{'oai-authenticated-user-email':'viewer@example.test'}),env)).status,403);
const config=await(await worker.fetch(req('/api/admin/config'),env)).json();assert.equal(config.ready,false);assert.equal(config.catalog.length,5);
// Food search: authenticated, validates search term, excludes incomplete entries,
// and never infers unknown nutrients.
assert.equal((await worker.fetch(req('/api/foods/search?q=x'),env)).status,400);
assert.equal((await worker.fetch(new Request('https://coach.example.test/api/foods/search?q=rice'),env)).status,401);
const previousFetch=globalThis.fetch;
let foodRequests=0;
globalThis.fetch=async(url)=>{
 assert(String(url).startsWith('https://world.openfoodfacts.org/cgi/search.pl?'));
 foodRequests++;
 return new Response(JSON.stringify({products:[
  {code:'1234567890123',product_name:'Verified Yogurt',brands:'Example',nutriments:{'energy-kcal_100g':60,proteins_100g:4,carbohydrates_100g:6,fat_100g:2}},
  {code:'000',product_name:'Incomplete listing',nutriments:{'energy-kcal_100g':40,proteins_100g:2}}
 ]}),{status:200,headers:{'content-type':'application/json'}});
};
try {
 const foodResult=await worker.fetch(req('/api/foods/search?q=yogurt&source=openfoodfacts'),env);
 assert.equal(foodResult.status,200);
 const payload=await foodResult.json();
 assert.equal(foodRequests,1);
 assert.equal(payload.foods.length,1);
 assert.equal(payload.foods[0].name,'Verified Yogurt');
 assert.equal(payload.foods[0].kcal,60);
 assert.equal(payload.foods[0].source,'Open Food Facts');
 assert.equal(payload.foods[0].unit,'100g');
} finally {globalThis.fetch=previousFetch;}

const body={requestId:'12345678-1234-1234-1234-123456789012',exerciseId:'chair-squat',acceptCost:true};
assert.equal((await worker.fetch(req('/api/admin/generate',body,{origin:'https://evil.example.test'}),env)).status,403);
assert.equal((await worker.fetch(req('/api/admin/generate',body),env)).status,409);
assert.equal((await worker.fetch(req('/'),env)).status,200);assert.equal((await worker.fetch(req('/assets/spartacus-logo.png'),env)).headers.get('content-type'),'image/png');
const originalFetch=globalThis.fetch;let submitted=0;globalThis.fetch=async(url,opts)=>{assert.equal(url,'https://api.dev.runwayml.com/v1/text_to_video');assert.equal(JSON.parse(opts.body).duration,5);submitted++;return new Response(JSON.stringify({id:'task-test'}),{status:200});};
env.RUNWAY_GENERATION_ENABLED='true';env.RUNWAY_API_KEY='mock-test-key';
try{const a=await worker.fetch(req('/api/admin/generate',body),env);assert.equal(a.status,200);assert.equal((await a.json()).job.status,'PENDING');const b=await worker.fetch(req('/api/admin/generate',body),env);assert.equal((await b.json()).reused,true);assert.equal(submitted,1);assert.equal((await worker.fetch(req('/api/admin/approve',{requestId:body.requestId,reviewConfirmed:true,reviewer:'Test Coach'}),env)).status,409);const videos=await(await worker.fetch(req('/api/videos'),env)).json();assert.deepEqual(videos.videos,{});}finally{globalThis.fetch=originalFetch;}
for(const file of ['public/index.html','public/admin.html']){const html=await readFile(file,'utf8');for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new Function(script[1]);assert(!html.includes('mock-test-key'));}
console.log('Auth, admin access, CSRF, disabled generation, duplicate request prevention, review gating, embedded assets, and page syntax verified with mocks. No paid API calls made.');
