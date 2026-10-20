const catalog=[
{id:'chair-squat',name:'سكوات إلى كرسي',prompt:'Side view, full body, adult fitness trainer in a black shirt with small red accents, charcoal gym with neutral lighting. Demonstrate one slow controlled chair squat toward a stable bench: stand, lower hips gently until lightly touching the bench, stand again. Both feet stay planted. Fixed camera, no cuts, no text or music.'},
{id:'wall-pushup',name:'ضغط على الحائط',prompt:'Side view, full body, adult trainer wearing black with red accents, minimal white and charcoal studio. Demonstrate one slow wall push-up, palms on a fixed wall at shoulder height, body in a straight line, elbows bend then extend smoothly. Feet remain planted. Fixed camera, no cuts, no text or music.'},
{id:'glute-bridge',name:'جسر الحوض',prompt:'Side view, full body, adult trainer wearing black with red accents on a mat in a charcoal fitness studio. Demonstrate one slow glute bridge: lying on back with knees bent and feet planted, raise hips gently, pause and lower under control. Neutral spine without excessive arching. Fixed camera, no cuts, no text or music.'},
{id:'lat-pulldown',name:'سحب أمامي',prompt:'Three-quarter side view, full body, adult trainer in black with red accents seated at a lat pulldown machine in a charcoal gym. Demonstrate one controlled repetition: thigh pad secure, pull bar in front of head toward upper chest, return slowly without swinging. Fixed camera, no cuts, no text or music.'},
{id:'calf-raise',name:'رفع السمانة مع دعم',prompt:'Side view, full body, adult trainer in black with red accents in a neutral charcoal fitness studio. Demonstrate one slow standing calf raise on flat floor while lightly holding a stable support, both heels rise, pause, lower gently. No bouncing. Fixed camera, no cuts, no text or music.'}
];
const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,'content-type':'application/json; charset=utf-8'}});
const identity=req=>({id:req.headers.get('oai-authenticated-user-id'),email:req.headers.get('oai-authenticated-user-email')});
const admin=(req,env)=>{const who=identity(req);return !!(who.id&&who.email&&env.SPARTACUS_ADMIN_EMAIL&&who.email.toLowerCase()===env.SPARTACUS_ADMIN_EMAIL.toLowerCase());};
const ready=env=>!!(env.RUNWAY_API_KEY&&env.BUCKET&&env.RUNWAY_GENERATION_ENABLED==='true');
async function get(bucket,key){const o=await bucket.get(key);return o?o.json():null;}
async function put(bucket,key,value){await bucket.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});}
async function listJobs(bucket){const result=await bucket.list({prefix:'jobs/',limit:50});return (await Promise.all(result.objects.map(o=>get(bucket,o.key)))).filter(Boolean).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
function publicJob(job){return{requestId:job.requestId,exerciseId:job.exerciseId,status:job.status,createdAt:job.createdAt,message:job.message||null,reviewer:job.reviewer||null,video:job.videoKey?'/api/admin/preview/'+job.requestId:null};}
async function runway(env,path,method='GET',body){return fetch('https://api.dev.runwayml.com/v1/'+path,{method,headers:{Authorization:'Bearer '+env.RUNWAY_API_KEY,'X-Runway-Version':'2024-11-06','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});}
async function generate(req,env,data){if(!ready(env))return json({error:'التوليد غير مفعّل. يلزم إعداد مفتاح Runway والرصيد وتفعيل الخدمة.'},409);const exercise=catalog.find(x=>x.id===data.exerciseId);if(!exercise||data.acceptCost!==true||!/^[-a-zA-Z0-9]{20,50}$/.test(data.requestId||''))return json({error:'طلب غير صالح أو لم يتم قبول تكلفة التوليد.'},400);
const key='jobs/'+data.requestId+'.json';const previous=await get(env.BUCKET,key);if(previous)return json({job:publicJob(previous),reused:true});
const lock=await env.BUCKET.put('generation-lock','locked',{onlyIf:{etagDoesNotMatch:'*'}});if(!lock)return json({error:'طلب توليد آخر جارٍ الآن. لم يُرسل طلب جديد.'},409);
try{const again=await get(env.BUCKET,key);if(again)return json({job:publicJob(again),reused:true});const jobs=await listJobs(env.BUCKET);if(jobs.length>=5)return json({error:'وصلت إلى حد التجربة: خمسة طلبات. مراجعة النتائج مطلوبة قبل توسيع الإنتاج.'},409);const job={requestId:data.requestId,exerciseId:exercise.id,status:'SUBMITTING',createdAt:new Date().toISOString()};await put(env.BUCKET,key,job);
try{const response=await runway(env,'text_to_video','POST',{model:'gen4.5',promptText:exercise.prompt,ratio:'1280:720',duration:5});if(!response.ok){job.status='SUBMISSION_UNCERTAIN';job.message='لم نتأكد من قبول الطلب (HTTP '+response.status+'). افحص Runway قبل إعادة التوليد.';}else{const result=await response.json();if(typeof result.id!=='string')throw Error('Missing task ID');job.taskId=result.id;job.status='PENDING';}}catch{job.status='SUBMISSION_UNCERTAIN';job.message='تعذر تأكيد قبول الطلب. لا نعيده تلقائياً؛ افحص لوحة Runway.';}await put(env.BUCKET,key,job);return json({job:publicJob(job)});
}finally{await env.BUCKET.delete('generation-lock');}}
async function sync(env,data){const key='jobs/'+data.requestId+'.json';const job=await get(env.BUCKET,key);if(!job)return json({error:'الطلب غير موجود.'},404);if(!job.taskId||job.videoKey||['FAILED','CANCELED'].includes(job.status))return json({job:publicJob(job)});if(!env.RUNWAY_API_KEY)return json({error:'مفتاح Runway غير معد.'},409);
const response=await runway(env,'tasks/'+encodeURIComponent(job.taskId));if(!response.ok)return json({error:'تعذر تحديث حالة الطلب. لا يوجد توليد جديد.'},502);const task=await response.json();if(task.status==='SUCCEEDED'){
const uri=task.output?.[0];if(typeof uri!=='string'||!uri.startsWith('https://'))return json({error:'نتيجة Runway لا تحتوي رابط فيديو صالحاً.'},502);const parsed=new URL(uri);if(parsed.hostname==='localhost'||/^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname)||parsed.hostname.startsWith('['))return json({error:'رابط ناتج غير مقبول.'},502);
const video=await fetch(uri,{redirect:'error',signal:AbortSignal.timeout(60000)});if(!video.ok||!video.body)return json({error:'تعذر حفظ الفيديو. حدّث الحالة مجدداً قبل انتهاء رابط Runway.'},502);if(Number(video.headers.get('content-length')||0)>50*1024*1024)return json({error:'الفيديو يتجاوز حد التخزين التجريبي.'},413);let size=0;const bounded=video.body.pipeThrough(new TransformStream({transform(chunk,controller){size+=chunk.byteLength;if(size>50*1024*1024)throw Error('Video too large');controller.enqueue(chunk);}}));job.videoKey='videos/'+job.requestId+'.mp4';await env.BUCKET.put(job.videoKey,await new Response(bounded).arrayBuffer(),{httpMetadata:{contentType:'video/mp4'}});job.status='REVIEW_REQUIRED';job.message='تم حفظ الفيديو. يلزم فحص التنفيذ بواسطة مدرب قبل الاعتماد.';
}else if(['FAILED','CANCELED','CANCELLED'].includes(task.status)){job.status='FAILED';job.message='فشل التوليد لدى Runway؛ لم تتم إعادة الطلب.';}else job.status=['PENDING','RUNNING','THROTTLED'].includes(task.status)?task.status:'PENDING';await put(env.BUCKET,key,job);return json({job:publicJob(job)});}
async function approve(req,env,data){const key='jobs/'+data.requestId+'.json';const job=await get(env.BUCKET,key);if(!job||!job.videoKey||job.status!=='REVIEW_REQUIRED')return json({error:'الفيديو غير جاهز للاعتماد.'},409);if(data.reviewConfirmed!==true||typeof data.reviewer!=='string'||data.reviewer.trim().length<2||data.reviewer.length>80)return json({error:'يلزم اسم المراجع وتأكيد مراجعة صحة الحركة.'},400);job.status='APPROVED';job.reviewer=data.reviewer.trim();job.reviewedAt=new Date().toISOString();await put(env.BUCKET,key,job);await put(env.BUCKET,'approved/'+job.exerciseId+'.json',{videoKey:job.videoKey,requestId:job.requestId});return json({job:publicJob(job)});}
async function streamVideo(req,env,key){const range=req.headers.get('range');let rangeOptions;if(range){const m=/^bytes=(\d+)-(\d*)$/.exec(range);if(!m)return new Response(null,{status:416});const offset=Number(m[1]);rangeOptions={offset,...(m[2]?{length:Number(m[2])-offset+1}:{})};if(rangeOptions.length!==undefined&&rangeOptions.length<=0)return new Response(null,{status:416});}
const item=await env.BUCKET.get(key,rangeOptions?{range:rangeOptions}:undefined);if(!item)return new Response('Not found',{status:404});const h=new Headers({...headers,'content-type':'video/mp4','accept-ranges':'bytes'});let status=200;if(item.range){const offset=item.range.offset||0,length=item.range.length||item.size-offset;h.set('content-range',`bytes ${offset}-${offset+length-1}/${item.size}`);h.set('content-length',String(length));status=206;}else h.set('content-length',String(item.size));return new Response(req.method==='HEAD'?null:item.body,{status,headers:h});}

/* Search verified per-100g nutrient records; do not fill missing data by guess. */
const numeric=(v,max=900)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max?v:null;
function validatedFood(f) {
 const kcal=numeric(f.kcal),p=numeric(f.p,100),c=numeric(f.c,100),fat=numeric(f.f,100);
 if (kcal===null||p===null||c===null||fat===null||!f.name||typeof f.name!=='string') return null;
 if (p+c+fat>115) return null;
 return {id:String(f.id||'').slice(0,100),name:f.name.slice(0,160),
  brand:String(f.brand||'').slice(0,120),state:String(f.state||'').slice(0,160),
  source:f.source,sourceUrl:f.sourceUrl,kcal,p,c,f:fat,unit:'100g'};
}
async function searchWorldFoods(q) {
 const query=new URLSearchParams({search_terms:q,search_simple:'1',action:'process',json:'1',page_size:'16',fields:'code,product_name,product_name_en,brands,nutriments'});
 const response=await fetch('https://world.openfoodfacts.org/cgi/search.pl?'+query,{
  headers:{'User-Agent':'SpartacusCoach/1.0 (info@spartacusprotein.com)','Accept':'application/json'},
  signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('Open Food Facts unavailable');
 const raw=await response.json();
 return (raw.products||[]).map(x=>{
  const n=x.nutriments||{};
  return validatedFood({id:'off:'+x.code,name:x.product_name||x.product_name_en,
    brand:x.brands||'',state:'Packaged product, as sold',
    source:'Open Food Facts',sourceUrl:'https://world.openfoodfacts.org/product/'+encodeURIComponent(x.code||''),
    kcal:n['energy-kcal_100g'],p:n.proteins_100g,c:n.carbohydrates_100g,f:n.fat_100g});
 }).filter(Boolean).slice(0,12);
}
async function searchUsdaFoods(q,env) {
 if(!env.USDA_FDC_API_KEY)return [];
 const response=await fetch('https://api.nal.usda.gov/fdc/v1/foods/search?api_key='+encodeURIComponent(env.USDA_FDC_API_KEY),{
  method:'POST',headers:{'content-type':'application/json','accept':'application/json'},
  body:JSON.stringify({query:q,pageSize:12}),
  signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('USDA unavailable');
 const raw=await response.json();
 return (raw.foods||[]).map(x=>{
  const find=(nums)=>{const n=(x.foodNutrients||[]).find(y=>nums.includes(String(y.nutrientNumber||y.number||'')));return n?.value;};
  return validatedFood({id:'usda:'+x.fdcId,name:x.description,brand:x.brandOwner||'',
    state:'Check raw/cooked description and per-100g values',
    source:'USDA FoodData Central',sourceUrl:'https://fdc.nal.usda.gov/food-details/'+x.fdcId+'/nutrients',
    kcal:find(['208']),p:find(['203']),c:find(['205']),f:find(['204'])});
 }).filter(Boolean).slice(0,12);
}
async function globalFoodLookup(req,env,url) {
 const q=(url.searchParams.get('q')||'').trim();
 if(q.length<2||q.length>90)return json({error:'أدخل اسم طعام بين حرفين و90 حرفاً.'},400);
 const provider=url.searchParams.get('source')||'all';
 if(!['all','openfoodfacts','usda'].includes(provider))return json({error:'مصدر غير صالح.'},400);
 let foods=[],notes=[];
 const sources=provider==='all'?['openfoodfacts','usda']:[provider];
 const results=await Promise.allSettled(sources.map(x=>x==='usda'?searchUsdaFoods(q,env):searchWorldFoods(q)));
 results.forEach((result,i)=>{if(result.status==='fulfilled')foods.push(...result.value);
  else notes.push(sources[i]+': currently unavailable');});
 return json({foods:foods.slice(0,24),query:q,sources,notes,
  disclaimer:'Nutrients reflect the source record per 100g; verify label, edible state and serving size. Blank fields are excluded, never estimated.'});
}

export default{async fetch(req,env){const url=new URL(req.url),path=url.pathname;try{
if(path.startsWith('/api/')){if(!identity(req).id)return json({error:'يلزم تسجيل الدخول.'},401);const isAdmin=admin(req,env);
if(path==='/api/foods/search'&&req.method==='GET')return globalFoodLookup(req,env,url);
if(path==='/api/admin/config'&&req.method==='GET'){if(!isAdmin)return json({error:'هذا القسم للإدارة فقط.'},403);return json({ready:ready(env),keyConfigured:!!env.RUNWAY_API_KEY,storageReady:!!env.BUCKET,generationEnabled:env.RUNWAY_GENERATION_ENABLED==='true',catalog,model:'gen4.5',duration:5,estimatedCredits:60,estimatedUSD:.60,pilotLimit:5});}
if(path.startsWith('/api/admin/')){if(!isAdmin)return json({error:'هذا القسم للإدارة فقط.'},403);if(!env.BUCKET)return json({error:'التخزين غير متاح.'},503);if(path==='/api/admin/jobs'&&req.method==='GET')return json({jobs:(await listJobs(env.BUCKET)).map(publicJob)});if(path.startsWith('/api/admin/preview/')&&['GET','HEAD'].includes(req.method)){const job=await get(env.BUCKET,'jobs/'+path.split('/').pop()+'.json');return job?.videoKey?streamVideo(req,env,job.videoKey):json({error:'لا يوجد فيديو محفوظ.'},404);}
if(req.method!=='POST')return json({error:'طريقة غير مسموحة.'},405);if(req.headers.get('origin')!==url.origin)return json({error:'مصدر الطلب غير مسموح.'},403);if(path==='/api/admin/import'){const exerciseId=req.headers.get('x-exercise-id');if(!catalog.some(e=>e.id===exerciseId)||!req.headers.get('content-type')?.includes('video/mp4'))return json({error:'اختر تمريناً وملف MP4 صالحاً.'},400);let size=0;const stream=req.body?.pipeThrough(new TransformStream({transform(chunk,c){size+=chunk.byteLength;if(size>25*1024*1024)throw Error('Too large');c.enqueue(chunk);}}));if(!stream)return json({error:'ملف فارغ.'},400);const bytes=await new Response(stream).arrayBuffer();if(bytes.byteLength<12||String.fromCharCode(...new Uint8Array(bytes).slice(4,8))!=='ftyp')return json({error:'الملف ليس MP4 صالحاً.'},400);const requestId=crypto.randomUUID();const job={requestId,exerciseId,status:'REVIEW_REQUIRED',createdAt:new Date().toISOString(),videoKey:'videos/'+requestId+'.mp4',message:'فيديو تجريبي مستورد؛ ينتظر مراجعة صحة الحركة.'};await env.BUCKET.put(job.videoKey,bytes,{httpMetadata:{contentType:'video/mp4'}});await put(env.BUCKET,'jobs/'+requestId+'.json',job);return json({job:publicJob(job)});}
if(!req.headers.get('content-type')?.includes('application/json'))return json({error:'يلزم JSON.'},415);const raw=await req.text();if(raw.length>4096)return json({error:'طلب كبير.'},413);let data;try{data=JSON.parse(raw);}catch{return json({error:'JSON غير صالح.'},400);}if(path==='/api/admin/generate')return generate(req,env,data);if(path==='/api/admin/sync'){if(!/^[-a-zA-Z0-9]{20,50}$/.test(data.requestId||''))return json({error:'طلب غير صالح.'},400);return sync(env,data);}if(path==='/api/admin/approve'){if(!/^[-a-zA-Z0-9]{20,50}$/.test(data.requestId||''))return json({error:'طلب غير صالح.'},400);return approve(req,env,data);}return json({error:'غير موجود.'},404);}
if(path==='/api/videos'&&req.method==='GET'){const videos={},drafts={};if(env.BUCKET&&isAdmin){for(const j of await listJobs(env.BUCKET))if(j.videoKey&&j.status==='REVIEW_REQUIRED'&&!drafts[j.exerciseId])drafts[j.exerciseId]='/api/admin/preview/'+j.requestId;}if(env.BUCKET)for(const e of catalog){const approved=await get(env.BUCKET,'approved/'+e.id+'.json');if(approved)videos[e.id]='/api/video/'+e.id;}return json({videos,drafts});}
if(path.startsWith('/api/video/')&&['GET','HEAD'].includes(req.method)){if(!env.BUCKET)return json({error:'غير جاهز.'},404);const e=catalog.find(x=>x.id===path.split('/').pop());if(!e)return json({error:'غير موجود.'},404);const record=await get(env.BUCKET,'approved/'+e.id+'.json');return record?streamVideo(req,env,record.videoKey):json({error:'لا يوجد فيديو معتمد بعد.'},404);}
return json({error:'غير موجود.'},404);}
if(!['GET','HEAD'].includes(req.method))return new Response('Method not allowed',{status:405});const asset=ASSETS[path==='/'?'/index.html':path];if(!asset)return new Response('Not found',{status:404});const body=Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0));return new Response(req.method==='HEAD'?null:body,{headers:{...headers,'content-type':asset.type,'referrer-policy':'same-origin'}});
}catch{return json({error:'تعذر إكمال العملية. لا تُعد التوليد تلقائياً؛ راجع حالة الطلب أولاً.'},500);}}};
