(function(root){
'use strict';
const foods={
chicken:{name:'صدر دجاج مشوي دون جلد',state:'مطبوخ • دون زيت إضافي',kcal:165,p:31.02,f:3.57,c:0,id:171477},
rice:{name:'أرز أبيض',state:'مطبوخ • دون زيت',kcal:130,p:2.69,f:.28,c:28.17,id:168878},
oil:{name:'زيت زيتون',state:'الكمية المضافة بالكامل',kcal:884,p:0,f:100,c:0,id:171413},
oats:{name:'شوفان',state:'جاف • قبل إضافة الماء',kcal:379,p:13.15,f:6.52,c:67.7,id:173904},
banana:{name:'موز',state:'نيّئ • بدون القشر',kcal:89,p:1.09,f:.33,c:22.84,id:173944},
tofu:{name:'توفو صلب بالكالسيوم',state:'كما هو • دون زيت إضافي',kcal:144,p:17.27,f:8.72,c:2.78,id:172475},
lentils:{name:'عدس',state:'مسلوق • دون زيت',kcal:116,p:9.02,f:.38,c:20.13,id:172421}
};
function totals(rows){return rows.reduce((t,r)=>{for(const k of ['kcal','p','c','f'])t[k]+=foods[r.food][k]*r.g/100;return t;},{kcal:0,p:0,c:0,f:0});}
function solve3(m,v){m=m.map((r,i)=>[...r,v[i]]);for(let i=0;i<3;i++){let pivot=i;for(let j=i+1;j<3;j++)if(Math.abs(m[j][i])>Math.abs(m[pivot][i]))pivot=j;[m[i],m[pivot]]=[m[pivot],m[i]];if(Math.abs(m[i][i])<1e-10)throw Error('تعذر حساب الحصص');let d=m[i][i];for(let k=i;k<4;k++)m[i][k]/=d;for(let j=0;j<3;j++)if(j!==i){let f=m[j][i];for(let k=i;k<4;k++)m[j][k]-=f*m[i][k];}}return m.map(r=>r[3]);}
function plan(cal,protein,vegan=false){if(!Number.isFinite(cal)||!Number.isFinite(protein)||cal<1500||cal>4000||protein<60||protein>220)return {error:'الهدف خارج حدود النموذج التجريبي (1500–4000 سعرة و60–220 غ بروتين). يحتاج تخصيصاً مع مختص؛ لم تُنشأ حصص.'};
const base=[{food:'oats',g:60},{food:'banana',g:120},{food:'lentils',g:120}];let b=totals(base),targetFat=cal*.30/9;const source=vegan?'tofu':'chicken';const vars=[source,'rice','oil'];const matrix=['kcal','p','f'].map(k=>vars.map(id=>foods[id][k]/100));const amounts=solve3(matrix,[cal-b.kcal,protein-b.p,targetFat-b.f]);if(amounts.some(x=>!Number.isFinite(x)||x<0)||amounts[0]>800||amounts[1]>1200||amounts[2]>90)return{error:'لم نجد حصصاً عملية ضمن خيارات الأطعمة الحالية. غيّر الخيارات أو اطلب مراجعة مختص؛ لا نعرض كميات غير مناسبة.'};
const rounded=amounts.map(x=>Math.round(x*10)/10);const split=(amount,part)=>Math.round(amount*part*10)/10;
const meals=[{name:'الفطور',rows:[base[0],{food:'banana',g:60}]},{name:'الغداء',rows:[{food:source,g:split(rounded[0],.55)},{food:'rice',g:split(rounded[1],.55)},{food:'oil',g:split(rounded[2],.55)}]},{name:'وجبة خفيفة',rows:[{food:'banana',g:60},base[2]]},{name:'العشاء',rows:[{food:source,g:Math.round((rounded[0]-split(rounded[0],.55))*10)/10},{food:'rice',g:Math.round((rounded[1]-split(rounded[1],.55))*10)/10},{food:'oil',g:Math.round((rounded[2]-split(rounded[2],.55))*10)/10}]}];return{cal,protein,meals,total:totals(meals.flatMap(m=>m.rows)),targetFat,vegan};}
const api={foods,totals,plan};if(typeof module!=='undefined')module.exports=api;else root.CoachNutrition=api;
})(typeof window!=='undefined'?window:globalThis);
