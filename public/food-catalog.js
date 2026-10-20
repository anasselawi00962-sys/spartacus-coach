/* Spartacus Coach global food lookup and session-only meal table additions.
 * The seven curated starter foods remain available offline.
 * Unknown nutrient numbers are NEVER guessed.
 */
(function(){
'use strict';
let selected=null;
const additions=[];
const el=id=>document.getElementById(id);
const fmt=v=>Number(v).toFixed(1);
const safe=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keyFor=f=>'global_'+String(f.id).replace(/[^a-zA-Z0-9]/g,'_');
function addTableRow(entry){
 if(!mealPlan || !window.CoachNutrition)return false;
 const m=mealPlan.meals[entry.meal];
 if(!m)return false;
 const f=entry.food;
 const key=keyFor(f);
 window.CoachNutrition.foods[key]={name:f.name,state:(f.brand?f.brand+' • ':'')+f.source+' • per 100g',kcal:f.kcal,p:f.p,c:f.c,f:f.f,
 source:f.source,sourceUrl:f.sourceUrl};
 const j=m.rows.length;
 m.rows.push({food:key,g:entry.grams});
 const table=el('mealOutput')?.querySelectorAll('.meal-table')?.[entry.meal];
 const tbody=table?.querySelector('tbody');
 if(!tbody)return false;
 const row=document.createElement('tr');
 const nameCell=document.createElement('td');
 nameCell.textContent=f.name+(f.brand?' — '+f.brand:'');
 const note=document.createElement('small');
 note.textContent=f.source+' · '+f.state;
 nameCell.appendChild(note);
 row.appendChild(nameCell);
 const gramCell=document.createElement('td');
 const input=document.createElement('input');
 input.type='number';input.min='0';input.max='1500';input.step='0.1';input.value=String(entry.grams);
 input.setAttribute('aria-label','كمية '+f.name+' بالغرام');
 input.dataset.meal=String(entry.meal);input.dataset.row=String(j);
 input.addEventListener('input',()=>{
  const n=Number(input.value);
  if(!Number.isFinite(n)||n<0||n>1500||input.value===''){
   const status=el('mealStatus');if(status)status.textContent='الكمية يجب أن تكون بين صفر و1500 غرام.';
   return;
  }
  m.rows[j].g=n;
  const item=additions.find(a=>a.uid===entry.uid);
  if(item)item.grams=n;
  for(const k of ['kcal','p','c','f'])el('nut-'+entry.meal+'-'+j+'-'+k).textContent=fmt(f[k]*n/100);
  window.refreshTotals();
 });
 gramCell.appendChild(input);row.appendChild(gramCell);
 for(const k of ['kcal','p','c','f']) {
  const td=document.createElement('td');td.id='nut-'+entry.meal+'-'+j+'-'+k;
  td.textContent=fmt(f[k]*entry.grams/100);row.appendChild(td);
 }
 tbody.appendChild(row);
 return true;
}
function mount(){
 const output=el('mealOutput');
 if(!output||!mealPlan?.meals)return;
 const panel=document.createElement('section');
 panel.id='globalFoodPanel';
 panel.className='card';
 panel.style.cssText='margin-top:22px;border:1px solid #ddd;padding:18px;background:#fafafa';
 panel.innerHTML='<h3>🌍 أضف طعاماً عالمياً لجدولك</h3>'+
 '<p class="muted">ابحث باسم المنتج بالعربي أو الإنجليزي. القيم الغذائية من قاعدة البيانات كما هي لكل 100 غرام، وليست تقديرات من الذكاء الاصطناعي.</p>'+
 '<form id="globalFoodSearch" style="display:flex;gap:8px;flex-wrap:wrap">'+
 '<label style="flex:1 1 200px">اسم الطعام أو المنتج<input id="globalFoodQuery" type="search" minlength="2" maxlength="90" placeholder="e.g. oats, yogurt, rice" required></label>'+
 '<label style="flex:0 1 180px">مصدر البيانات<select id="globalFoodSource"><option value="all">المصادر المتاحة</option><option value="openfoodfacts">Open Food Facts</option><option value="usda">USDA (عند الربط)</option></select></label>'+
 '<button type="submit" style="align-self:end">بحث</button></form>'+
 '<p class="muted" id="globalFoodStatus" role="status" aria-live="polite"></p>'+
 '<div id="globalFoodResults"></div>'+
 '<div id="globalFoodSelection" hidden><h4 id="globalFoodSelectedName"></h4>'+
 '<div class="row"><label>الوجبة<select id="globalFoodMeal"></select></label><label>الكمية بالغرام<input id="globalFoodGrams" type="number" min="1" max="1500" step="1" value="100"></label></div>'+
 '<button id="globalFoodAdd" type="button">إضافة إلى جدول اليوم</button></div>'+
 '<p class="muted">البيانات من مساهمات عامة أو قواعد مرجعية: تحقق من الملصق، حالة الطعام مطبوخ أو نيّئ، والكمية. الإضافات الحالية محفوظة داخل هذه الجلسة فقط.</p>';
 output.appendChild(panel);
 const meals=el('globalFoodMeal');mealPlan.meals.forEach((m,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=m.name;meals.append(o)});
 el('globalFoodSearch').addEventListener('submit',async event=>{
  event.preventDefault();selected=null;el('globalFoodSelection').hidden=true;
  const q=el('globalFoodQuery').value.trim();
  if(q.length<2)return;
  const box=el('globalFoodResults');box.replaceChildren();
  const status=el('globalFoodStatus');status.textContent='جاري البحث في قواعد البيانات...';
  try{
   const src=el('globalFoodSource').value;
   const response=await fetch('/api/foods/search?q='+encodeURIComponent(q)+'&source='+encodeURIComponent(src),{credentials:'same-origin'});
   if(!response.ok){status.textContent=response.status===401?'يلزم تسجيل الدخول لاستخدام البحث العالمي.':'تعذّر الاتصال بقاعدة الطعام ('+response.status+').';return;}
   const data=await response.json();
   const foods=(data.foods||[]).filter(f=>['kcal','p','c','f'].every(k=>typeof f[k]==='number'&&Number.isFinite(f[k])&&f[k]>=0));
   status.textContent=foods.length?'اختر الطعام المناسب من النتائج ('+foods.length+'). راجع العلامة التجارية وحالة التحضير.':'لا توجد نتائج بقيم غذائية مكتملة. جرّب الاسم الإنجليزي أو منتجاً مختلفاً.';
   if(data.notes?.length)status.textContent+=' بعض المصادر غير متاحة حالياً.';
   foods.forEach(f=>{
    const btn=document.createElement('button');btn.type='button';
    btn.style.cssText='display:block;text-align:start;width:100%;background:#fff;color:#222;border:1px solid #ddd;margin:6px 0;padding:10px;';
    btn.textContent=f.name+(f.brand?' — '+f.brand:'')+' | '+f.kcal+' kcal, P '+f.p+'g, C '+f.c+'g, F '+f.f+'g / 100g · '+f.source;
    btn.addEventListener('click',()=>{selected=f;el('globalFoodSelection').hidden=false;
      el('globalFoodSelectedName').textContent=f.name+' — '+f.source;});
    box.append(btn);
   });
  }catch{status.textContent='تعذّر الاتصال بالمصدر العالمي. تحقق من الإنترنت أو جرّب لاحقاً.';}
 });
 el('globalFoodAdd').addEventListener('click',()=>{
  const g=Number(el('globalFoodGrams').value),meal=Number(el('globalFoodMeal').value);
  if(!selected||!Number.isFinite(g)||g<=0||g>1500||!Number.isInteger(meal)||meal<0||meal>=mealPlan.meals.length){
   el('globalFoodStatus').textContent='اختر طعاماً صالحاً وكمية بين 1 و1500 غرام.';return;}
  const entry={uid:Date.now()+'-'+additions.length,meal,grams:g,food:{...selected}};
  additions.push(entry);
  if(addTableRow(entry)){window.refreshTotals();el('globalFoodStatus').textContent='تمت إضافة '+selected.name+' إلى '+mealPlan.meals[meal].name+'.';}
 });
 for(const a of additions)addTableRow(a);
 if(additions.length)window.refreshTotals();
}
if(typeof window.buildMealOutput==='function'){
 const original=window.buildMealOutput;
 window.buildMealOutput=function(...args){original(...args);mount();};
}
})();
