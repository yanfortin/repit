/* Agendo Live : tape ou dicte une journée chaotique, Agendo bâtit un plan complet à approuver.
   Analyse 100 % locale, par règles (aucune IA, aucun réseau). Rien n'est modifié avant l'approbation. */
(()=>{"use strict";
const A=window.AG;if(!A){console.error("Agendo Live : pont AG introuvable");return}
const {$,$$,esc,toast,confetti,V,INIT,ACT,CHG,TABS,flat,cap,clamp}=A;
const NB="\u00a0",MAXC=1500,MAXI=30;
const WD=["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
const EXS=[
 ["Journée chargée","Demain j'ai le dentiste à 9 h, un lancement jeudi à 14 h, je dois magasiner un cadeau pour Marie et écrire à Samuel pour la soumission. Il faut aussi finir le rapport avant vendredi, 2 h minimum. Appeler le comptable."],
 ["Semaine de lancement","Lundi présentation client à 10 h, mardi de 13 h à 15 h atelier avec Inès, préparer la démo pendant 90 min, relancer Marie par courriel, payer la facture d'électricité, épicerie ce soir."],
 ["Pagaille totale","Ce soir souper chez mes parents à 18 h, demain matin pharmacie, rédiger la proposition pour Atelier Lune, réviser le contrat, écrire à Samuel, physio jeudi à 8 h 30."]];
/* ---------- état ---------- */
const todayStr=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
function L(){const s=A.S;if(!s.ep||typeof s.ep!=="object")s.ep={};let l=s.ep.live;if(!l||typeof l!=="object"||Array.isArray(l))l=s.ep.live={};
 if(typeof l.text!=="string")l.text="";l.text=l.text.slice(0,MAXC);
 if(!Array.isArray(l.plan)||l.day!==todayStr()){l.plan=null;l.ins=[];l.applied=null;l.fresh=false}
 if(!Array.isArray(l.ins))l.ins=[];
 if(l.plan&&!l.plan.every(i=>i&&typeof i==="object"&&typeof i.title==="string"&&typeof i.type==="string"&&Number.isFinite(i.o)))l.plan=null;
 if(!l.applied||typeof l.applied!=="object"||!l.applied.ids)l.applied=null;
 if(!l.hist||typeof l.hist!=="object"||!l.hist.ids)l.hist=null;
 const S=s,ex=a=>!!a&&["cal","tasks","todo","drafts","rem"].some(k=>Array.isArray(a.ids[k])&&Array.isArray(S[k])&&a.ids[k].some(i=>S[k].some(x=>x&&x.id===i)));
 if(l.applied&&!ex(l.applied))l.applied=null;
 else if(!l.applied&&l.plan&&l.hist&&ex(l.hist))l.applied=l.hist;
 return l}
const H=m=>A.H(m),DUR=m=>A.DUR(m);
/* ---------- analyse du texte ---------- */
const mkSt=o=>({o:o,f:flat(o)});
function take(st,re){const g=new RegExp(re.source,re.flags.includes("g")?re.flags:re.flags+"g");let m,out=null;const spans=[];while((m=g.exec(st.f))){if(!m[0].length){g.lastIndex++;continue}spans.push([m.index,m.index+m[0].length]);if(!out)out=m}
 if(!spans.length)return null;let o="",p=0;spans.forEach(([a,b])=>{o+=st.o.slice(p,a)+" ";p=b});o+=st.o.slice(p);st.o=o.replace(/\s+/g," ");st.f=flat(st.o);return out}
function hintOf(f){return /apres-midi|tantot/.test(f)?"apres-midi":/\bmatin\b/.test(f)?"matin":/\bsoir\b|souper/.test(f)?"soir":null}
function parseDay(f){let m;
 if(/\bapres-demain\b/.test(f))return{o:2,hint:hintOf(f)};
 if(/\bdemain\b/.test(f))return{o:1,hint:hintOf(f)};
 if(/aujourd'?hui|\bce soir\b|\bce matin\b|\bcet apres-midi\b|\btantot\b/.test(f))return{o:0,hint:hintOf(f)};
 const now=new Date().getDay();
 if(/fin de semaine|week-?end/.test(f))return{o:(6-now+7)%7||7,hint:hintOf(f),we:true};
 const w=WD.findIndex(d=>new RegExp("\\b"+d+"\\b").test(f));
 if(w>=0){let o=(w-now+7)%7;if(o===0)o=7;return{o,hint:hintOf(f),wd:WD[w]}}
 return null}
function splitClauses(text){const out=[];
 text.split(/[.;!?\n]+/).forEach(sent=>{sent=sent.trim();if(!sent)return;
  const parts=sent.split(/(?<!\d),(?!\d)|\s+(?:puis|ensuite|apr[eè]s [cç]a|et aussi)\s+|\s+et\s+(?=(?:je|j'|il|faut|n'oublie|rappelle|jeudi|lundi|mardi|mercredi|vendredi|samedi|dimanche|demain|apr[eè]s-demain|ce|cet|aujourd|un|une|le|la|les|l'|mon|ma|mes|finir|appeler|[ée]crire|envoyer|pr[ée]parer|payer|acheter|r[ée]pondre|relancer)\b)/i);
  parts.forEach(p=>{p=(p||"").trim();if(p.length>1)out.push(p)})});return out}
const DURV=/(?:bloque|bloquer|reserve|reserver|prevois|prevoir|garde|compte|mets|prends|minimum|environ)\s*(?:de\s+)?$/;
function parseTimes(st){const re=/(?:\b(avant|apres|vers|a|de|des|pendant|durant|pour|environ)\s+)?\b(\d{1,2})\s?(?::|h(?:eures?)?)\s?(\d{2})?(?![a-z0-9])/g;const ms=[];let m;
 while((m=re.exec(st.f))){const h=+m[2],mi=m[3]?+m[3]:0;if(h>23||mi>59)continue;ms.push({cue:m[1]||"",h,mi,a:m.index,b:m.index+m[0].length,pre:st.f.slice(0,m.index+(m[1]?0:0)),post:st.f.slice(m.index+m[0].length)})}
 const r={start:null,dur:null,before:null,after:null,pmGuess:false};const dropSpans=[];let rangeStartIdx=-1;
 ms.forEach((x,i)=>{const mins=x.h*60+x.mi;
  const durCue=/^(pendant|durant|pour|environ)$/.test(x.cue)||/^\s*(?:minimum|au moins|max|maximum|environ|de travail|de concentration)/.test(x.post)||/(?:au moins|environ|maximum|a peu pres)\s*$/.test(x.pre.trimEnd())||DURV.test(x.pre.trimEnd().replace(/\s+/g," ")+" ")||(/^\s+de\s/.test(x.post)&&!/^(a|vers|des|avant|apres)$/.test(x.cue)&&x.h<=12&&!x.mi&&/heures?/.test(st.f.slice(x.a,x.b)));
  if(durCue&&!/^(a|vers|des|avant|apres)$/.test(x.cue)){if(mins>0&&mins<=720&&r.dur==null)r.dur=mins;dropSpans.push([x.a,x.b]);return}
  if(x.cue==="avant"){r.before=mins;dropSpans.push([x.a,x.b]);return}
  if(x.cue==="apres"){r.after=mins;dropSpans.push([x.a,x.b]);return}
  if(x.cue==="a"&&rangeStartIdx>=0&&ms[rangeStartIdx]){const s0=ms[rangeStartIdx].h*60+ms[rangeStartIdx].mi,d=mins-s0;if(d>0&&d<=720)r.dur=d;dropSpans.push([x.a,x.b]);rangeStartIdx=-1;return}
  if(r.start==null){r.start={h:x.h,mi:x.mi};if(x.cue==="de")rangeStartIdx=i}
  dropSpans.push([x.a,x.b])});
 const md=/(\d+(?:[.,]\d+)?)\s*(?:min(?:utes?)?\b)/.exec(st.f);if(md&&r.dur==null){const v=Math.round(parseFloat(md[1].replace(",",".")));if(v>0&&v<=720)r.dur=v;dropSpans.push([md.index,md.index+md[0].length])}
 const hd=/(\d+(?:[.,]\d+)?)\s*(?:heures?|hrs?)\b(?!\s*\d)/.exec(st.f);if(hd&&r.dur==null&&!ms.some(x=>x.a<=hd.index&&x.b>=hd.index)){const v=Math.round(parseFloat(hd[1].replace(",","."))*60);if(v>0&&v<=720)r.dur=v;dropSpans.push([hd.index,hd.index+hd[0].length])}
 if(/\bmidi\b/.test(st.f)&&!r.start){r.start={h:12,mi:0};r.noon=true}
 if(r.dur==null){if(/demi-heure|1\/2 heure/.test(st.f))r.dur=30;else if(/une heure|1 heure/.test(st.f))r.dur=60}
 // retirer les spans de st
 dropSpans.sort((a,b)=>b[0]-a[0]);let o=st.o;dropSpans.forEach(([a,b])=>{o=o.slice(0,a)+" "+o.slice(b)});st.o=o.replace(/\s+/g," ");st.f=flat(st.o);
 return r}
function pmFix(h,mi,f,kindSoir){let pm=false;if(h<=6&&h>=1){h+=12;pm=true}else if(h>=7&&h<=11&&(/apres-midi|\bsoir\b|souper/.test(f)||kindSoir)){h+=12;pm=true}return{m:clamp(h*60+mi,0,1439),pm}}
const FIL=/^(?:[\s,:;\-–]+|(?:et|puis|ensuite|aussi|alors|donc|mais)\b|sans oublier(?: de| d')?|n'oublie pas(?: de| d')?|rappelle-moi(?: de| d')?|il faut(?: absolument)?(?: que (?:je|j'))?|faut(?: que (?:je|j'))?|je dois|je veux|je vais|je voudrais|j'ai besoin d[e']|j'ai|je|il y a|c'est|ce|cet|cette|mon|ma|mes|le|la|l'|les|un|une|des|du|de la|de l'|de|d'|a|au|aux|avec|pour|en|chez|ca)(?=\b|\s|$)\s*/i;
const TAIL=/(?:\s+|^)(?:a|au|vers|pour|de|du|avec|et|le|la|l'|d'|avant|apres|en|chez|dans|ce|cet|cette|mon|ma|puis|de|minimum|environ|encore|pendant|durant|minimum)\s*$|[,:;\s\-–]+$/i;
function cleanTitle(st,fallback){let o=st.o,f=flat(o);
 for(let i=0;i<14;i++){const m=FIL.exec(f);if(m&&m[0].length){o=o.slice(m[0].length);f=flat(o)}else break}
 for(let i=0;i<14;i++){const m=TAIL.exec(f);if(m&&m[0].length){o=o.slice(0,m.index);f=flat(o)}else break}
 o=o.replace(/\s+/g," ").trim();o=o.slice(0,80);return o?cap(o):(fallback||"")}
const NOTN=new Set(["Demain","Aujourd","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche","Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre","Je","Il","Elle","On","Ce","Cet","Cette","Le","La","Les","Un","Une","Mon","Ma","Mes","Et","Puis","Ensuite","Aussi","Si","Pour","Avec","Chez","Après","Avant","Midi","Matin","Soir","Dentiste","Lancement","Atelier"]);
function findWho(orig){const re=/(?:\bavec|\bà|\ba|\bchez|\bpour|\bde|\bd'|\bau|\baux)\s+(?:mon |ma |ses |son |sa )?([A-ZÉÈÀÂÎÔÙÇ][\p{L}'’-]+)(?:\s+([A-ZÉÈÀÂÎÔÙÇ][\p{L}'’-]+))?/gu;let m;
 while((m=re.exec(orig))){const a=m[1];if(NOTN.has(a))continue;let name=a;if(m[2]&&!NOTN.has(m[2]))name=a+" "+m[2];
  const cs=Array.isArray(A.S.contacts)?A.S.contacts:[];const c=cs.find(c=>c&&typeof c.n==="string"&&flat(c.n)===flat(name))||cs.find(c=>c&&typeof c.n==="string"&&flat(c.n).split(" ")[0]===flat(a));
  if(c)return{n:c.n,e:c.e||"",known:true};return{n:name,e:"",known:false}}
 return null}
const R={
 mail:/\b(?:courriels?|e-?mails?|courrier|repondre|reponds|relancer|relance|texter|envoyer (?:un |le |la |une )?(?:message|courriel|email|offre|soumission|facture)|ecrire a|ecris a|ecrire un (?:message|courriel)|ecrire au|message a)\b/,
 call:/\b(?:appeler|appelle|telephoner|telephone)\b/,
 event:/dentiste|medecin|docteur|\brdv\b|rendez-vous|reunion|rencontre|\bappel\b|\bcall\b|\bdemo\b|lancement|entrevue|entretien|souper|diner|dejeuner|\bcafe\b|visio|coiffeur|massage|physio|garderie|\bcours\b|spectacle|\bmatch\b|concert|\bvol\b|avion|anniversaire|\bfete\b|party|cinq a sept|\b5 a 7\b|presentation|webinaire|atelier|mariage|conference|examen|vaccin|optometriste|veterinaire|\bveto\b|osteo|chiro/,
 errand:/magasiner|acheter|achat|cadeau|epicerie|pharmacie|saaq|bureau de poste|recuperer|ramasser|deposer|retourner|banque|garage|pneus|quincaillerie|\bcourses\b|faire le plein|essence|lave-auto|nettoyeur|\bposte\b/,
 focus:/rediger|finir|terminer|preparer|travailler|reviser|coder|maquette|rapport|etudier|planifier|budget|proposition|soumission|ecrire le|ecrire la|ecrire l'|analyser|concevoir|reflechir|developper|programmer/,
 remote:/visio|zoom|teams|en ligne|telephone|\bappel\b|\bcall\b|webinaire|virtuel/,
 offsite:/dentiste|medecin|docteur|\brdv\b|rendez-vous|coiffeur|massage|physio|garderie|\bcours\b|spectacle|\bmatch\b|concert|souper chez|osteo|chiro|optometriste|veterinaire|vaccin|entrevue|examen|mariage|anniversaire|cafe|5 a 7|cinq a sept|diner avec|souper avec|dejeuner avec|atelier|presentation|reunion chez|chez /,
 prep:/lancement|presentation|\bdemo\b|entrevue|entretien|webinaire|atelier|conference|examen|soumission a presenter|pitch/,
 soir:/souper|\bsoir\b|cinq a sept|\b5 a 7\b|spectacle|concert|cinema|anniversaire/
};
const KIND={m:"m",f:"f",a:"a",p:"p"};
function analyse(text){
 const clauses=splitClauses(text.replace(/[<>]/g," ").slice(0,MAXC)),items=[],ins=[];let nid=0;let trunc=false;
 const parsed=[];
 clauses.forEach(c=>{
  const st=mkSt(c),orig=c;
  let dlD=null;
  const bm=/\bavant\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|demain|apres-demain)\b/.exec(st.f);
  if(bm){dlD=parseDay(bm[1]);take(st,/\bavant\s+(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|demain|apres-demain)\b/)}
  const dayI=parseDay(st.f);
  if(dayI){take(st,/\b(?:apres-demain|demain|aujourd'?hui|ce soir|ce matin|cet apres-midi|tantot|fin de semaine|week-?end|prochain(?:e)?|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/)}
  const hint=(dayI&&dayI.hint)||hintOf(st.f);const tm=parseTimes(st);
  take(st,/\b(?:ce|cet|cette|en)?\s*(?:matin|apres-midi|soir)\b/);take(st,/\b(?:pendant|durant|au moins|minimum|a peu pres)\b/);
  const who=findWho(orig);
  const f0=flat(orig);
  const FV=/\b(?:rediger|finir|terminer|preparer|reviser|travailler|etudier|analyser|concevoir|developper|programmer|coder|planifier|ecrire le|ecrire la|ecrire l')/;
  let type="task";
  if(R.mail.test(f0)&&!R.event.test(f0))type="mail";
  else if(R.call.test(f0))type="call";
  else if(FV.test(f0)&&!tm.start)type="focus";
  else if(R.event.test(f0))type="event";
  else if(R.errand.test(f0))type="errand";
  else if(R.focus.test(f0)||(tm.dur&&tm.dur>=45&&!tm.start))type="focus";
  if(type==="task"&&tm.start&&!R.focus.test(f0))type="event";
  const title=cleanTitle(st,"");
  if(!title){const prev=parsed[parsed.length-1];
   if(prev&&(tm.dur||tm.start||tm.before!=null||dayI)){if(tm.dur&&!prev.tm.dur)prev.tm.dur=tm.dur;if(tm.start&&!prev.tm.start)prev.tm.start=tm.start;if(tm.before!=null&&prev.tm.before==null)prev.tm.before=tm.before;if(dayI&&!prev.dayI)prev.dayI=dayI;if(dlD&&!prev.dlD)prev.dlD=dlD}
   return}
  parsed.push({orig,dayI,hint,tm,who,type,title,f0,dlD})});
 if(parsed.length>MAXI){trunc=true;parsed.length=MAXI;ins.push("Ton texte contient plus de "+MAXI+" éléments : seuls les "+MAXI+" premiers sont analysés.")}
 const evOf=o=>(Array.isArray(A.S.cal)?A.S.cal:[]).filter(e=>e&&e.o===o&&Number.isFinite(e.s)&&Number.isFinite(e.d));
 const staged=[];const calDay=o=>evOf(o).concat(staged.filter(i=>i.o===o&&i.cal));
 const free=o=>{const placed=calDay(o);let u=0;for(let s=480;s<1050;s+=15)if(placed.some(p=>s<p.s+p.d&&s+15>p.s))u+=15;return 570-u};
 const nowMin=(()=>{const d=new Date();return d.getHours()*60+d.getMinutes()})();
 const add=(it)=>{it.id=++nid;it.on=true;items.push(it);if(it.cal)staged.push(it);return it};
 const overlaps=(o,s,d,skip)=>calDay(o).filter(p=>p!==skip&&s<p.s+p.d&&s+d>p.s);
 const conflictTitle=x=>x.t||x.title||"un autre élément";
 const spec={event:{k:"m",e:2,d:45},call:{k:"m",e:2,d:20},errand:{k:"a",e:1,d:60},focus:{k:"f",e:3,d:90}};
 // 1) éléments à heure fixe
 parsed.forEach(p=>{p.fixed=false;const sp=spec[p.type];
  if(sp&&p.tm.start){const pm=pmFix(p.tm.start.h,p.tm.start.mi,p.f0,R.soir.test(p.f0));p.start=pm.m;p.pm=pm.pm;p.fixed=true}
  if(p.dayI)p.o=p.dayI.o});
 let lastDay=null;parsed.forEach(p=>{if(p.dayI){lastDay=p.dayI;return}if(p.fixed){if(lastDay){p.o=lastDay.o;p.inh=true}else{p.o=(p.start>nowMin+5)?0:1;p.inh2=true}}});
 const placeItem=(p,o,s,d,why,fx)=>{const sp=spec[p.type];s=clamp(s,0,1380-d);const cf=overlaps(o,s,d);
  const it=add({type:p.type,cal:true,o,s,d,k:sp.k,e:sp.e,fx:!!fx,title:p.title,who:p.who?[p.who.n]:[],why,conflict:cf.length?conflictTitle(cf[0]):""});
  if(cf.length)ins.push("⚠ « "+p.title+" » ("+A.dlabel(o)+", "+H(s)+") chevauche « "+conflictTitle(cf[0])+" ». Rien n'a été déplacé : décoche l'un des deux ou ajuste ensuite dans l'agenda.");return it};
 const addTrip=(p,it)=>{if(it.o===undefined||!R.offsite.test(p.f0)||R.remote.test(p.f0))return;
  const d=25,s=it.s-d;if(s<0)return;const cf=overlaps(it.o,s,d,it);
  if(cf.length){ins.push("Pas de plage libre de 25"+NB+"min avant « "+p.title+" » ("+A.dlabel(it.o)+") : trajet non ajouté.");return}
  const tr=add({type:"trip",cal:true,o:it.o,s,d,k:"a",e:1,fx:false,title:"Trajet : "+p.title,who:[],why:"Déplacement estimé à 25"+NB+"min (hypothèse à ajuster) pour arriver à "+H(it.s)+". Placé juste avant le rendez-vous.",conflict:""});
  const rs=Math.max(0,s-10);add({type:"rem",o:it.o,s:rs,title:"Partir pour « "+p.title+" » ("+H(s)+")",why:"Rappel 10"+NB+"min avant le départ, "+A.dlabel(it.o)+" à "+H(rs)+".",ty:"heure",v:H(rs),conflict:""});return tr};
 parsed.filter(p=>p.fixed&&p.o!==undefined).forEach(p=>{const sp=spec[p.type],d=p.tm.dur||sp.d;
  let why="Heure donnée dans ta phrase ("+H(p.start)+"), donc verrouillée.";if(p.pm)why+=" J'ai compris "+H(p.start)+" (après-midi ou soir) parce que « "+Math.floor(p.start/60-12)+NB+"h » seul est peu probable le matin : corrige si ce n'est pas ça.";
  if(p.dayI&&p.dayI.wd)why+=" « "+p.dayI.wd+" » = "+A.dlabel(p.o)+".";if(p.inh)why+=" Aucun jour donné : j'ai repris celui mentionné juste avant ("+A.dlabel(p.o)+").";if(p.inh2)why+=" Aucun jour donné : "+(p.o===0?"l'heure est encore à venir aujourd'hui":"l'heure est déjà passée aujourd'hui, donc demain")+".";
  const it=placeItem(p,p.o,p.start,d,why,true);p.done=true;p.it=it;addTrip(p,it);
  if(p.o===0&&p.start<nowMin)ins.push("L'heure de « "+p.title+" » ("+H(p.start)+") est déjà passée aujourd'hui.")});
 // 2) éléments flexibles
 const order={focus:0,errand:1,event:2,call:3};
 const flex=parsed.filter(p=>!p.done&&spec[p.type]).sort((a,b)=>(order[a.type]-order[b.type])||((b.tm.dur||0)-(a.tm.dur||0)));
 flex.forEach(p=>{const sp=spec[p.type],d=p.tm.dur||sp.d;let cands;let dayWhy="";
  if(p.o!==undefined){cands=[p.o];dayWhy="Jour donné dans ta phrase ("+A.dlabel(p.o)+").";if(p.dayI&&p.dayI.wd)dayWhy="« "+p.dayI.wd+" » = "+A.dlabel(p.o)+"."}
  else{const first=nowMin>16*60?1:0;let last=3;
   if(p.dlD){last=Math.max(first,p.dlD.o-(p.dlD.o<=1?0:1));p.deadline=A.dlabel(p.dlD.o)}
   cands=[];for(let o=first;o<=Math.min(last,first+6);o++)cands.push(o);if(!cands.length)cands=[first];const wk=cands.filter(o=>![0,6].includes(A.dateOf(o).getDay()));if(wk.length)cands=wk;
   cands.sort((a,b)=>(free(b)-free(a))||(a-b));dayWhy="Aucun jour précisé : j'ai choisi la journée la moins chargée"+(p.deadline?" avant l'échéance ("+p.deadline+")":" des prochains jours")+" ("+DUR(free(cands[0]))+" de plage libre ce jour-là)."}
  const hint=p.hint,win=hint==="matin"?{s:480,e:720}:hint==="apres-midi"?{s:780,e:1050}:hint==="soir"?{s:1020,e:1200}:(p.type==="focus"?{s:480,e:1050}:{s:480,e:1050});
  let placed=null;
  for(const o of cands){let s=A.findFree(calDay(o).map(x=>({s:x.s,d:x.d,k:x.k})),d,{e:sp.e,win,from:o===0?Math.max(win.s,Math.ceil((nowMin+10)/15)*15):undefined});
   if(s<0)s=A.findFree(calDay(o).map(x=>({s:x.s,d:x.d,k:x.k})),d,{e:sp.e,win:{s:420,e:1260},from:o===0?Math.max(420,Math.ceil((nowMin+10)/15)*15):undefined});
   if(s>=0){placed={o,s};break}}
  if(!placed){const it=add({type:"task",o:p.o||0,title:p.title,why:"Aucune plage libre de "+DUR(d)+" dans les prochains jours : ajouté comme tâche seulement.",conflict:""});p.it=it;ins.push("« "+p.title+" » n'a pas trouvé de plage libre : ajouté comme tâche sans bloc d'agenda.");return}
  let why=dayWhy+" Plage "+H(placed.s)+" à "+H(placed.s+d)+" : elle respecte les marges autour des réunions et l'énergie que demande ce type de tâche"+(p.type==="focus"?" (travail exigeant, donc plutôt tôt)":"")+".";
  if(hint)why+=" Moment demandé : "+hint.replace("apres-midi","après-midi")+".";
  if(!p.tm.dur)why+=" Durée par défaut : "+DUR(d)+" (hypothèse).";
  const it=placeItem(p,placed.o,placed.s,d,why,false);p.it=it;
  if(p.type==="errand"){const dt=20,ts=placed.s-dt;if(ts>=0&&!overlaps(placed.o,ts,dt,it).length)add({type:"trip",cal:true,o:placed.o,s:ts,d:dt,k:"a",e:1,fx:false,title:"Trajet : "+p.title,who:[],why:"Déplacement estimé à 20"+NB+"min (hypothèse à ajuster) avant la course.",conflict:""})}
  if(p.type==="event"&&R.offsite.test(p.f0)&&!R.remote.test(p.f0))addTrip(p,it);
  if(p.deadline&&placed.o>0)0});
 // 3) préparation des gros événements
 parsed.filter(p=>p.it&&p.it.cal&&(p.type==="event")&&R.prep.test(p.f0)).forEach(p=>{let o=p.it.o-1;while(o>0&&[0,6].includes(A.dateOf(o).getDay()))o--;if(o<0){ins.push("« "+p.title+" » est trop proche pour prévoir une préparation la veille.");return}
  const d=60;const s=A.findFree(calDay(o).map(x=>({s:x.s,d:x.d,k:x.k})),d,{e:3,win:{s:480,e:1050}});
  if(s>=0){const pt={...p,type:"focus",title:"Préparer : "+p.title};const it=add({type:"focus",cal:true,o,s,d,k:"f",e:3,fx:false,title:pt.title,who:[],why:"Événement important ("+A.dlabel(p.it.o)+") : j'ai réservé 1"+NB+"h de préparation la veille, "+H(s)+" à "+H(s+d)+".",conflict:""});
   add({type:"rem",o,s:Math.min(1020,s),title:"Préparer « "+p.title+" » ("+A.dlabel(p.it.o)+")",why:"Rappel au début du bloc de préparation.",ty:"heure",v:H(Math.min(1020,s)),conflict:""})}
  else ins.push("Aucune plage libre pour préparer « "+p.title+" » la veille.");
  if(p.who){add({type:"mail",o:p.it.o,title:"Confirmation : "+p.title,to:p.who.n,email:p.who.e,why:"Un message de confirmation à "+p.who.n+" avant l'événement évite les malentendus. Brouillon seulement, rien ne part.",body:"",conflict:""})}});
 // 4) courriels, appels sans bloc, tâches
 parsed.filter(p=>p.type==="mail").forEach(p=>{const to=p.who?p.who.n:"Destinataire à préciser";const subj=cap(p.title.replace(/^(?:ecrire|écrire|repondre|répondre|relancer|envoyer)\s+(?:a|à|au)?\s*/i,"").trim()||p.title);
  const o=p.o!==undefined?p.o:0;
  add({type:"mail",o,title:p.title,to,email:p.who?p.who.e:"",why:(p.who?(p.who.known?"Contact reconnu dans ton carnet : "+p.who.n+".":"Destinataire repéré : "+p.who.n+" (pas dans tes contacts)."):"Je n'ai pas trouvé de nom : à préciser avant l'envoi.")+" Brouillon préparé, tu relis et tu envoies toi-même (simulé).",body:"",conflict:""});
  add({type:"task",o,title:"Envoyer : "+p.title,why:"Pour ne pas oublier d'envoyer le courriel après l'avoir relu.",conflict:""})});
 parsed.filter(p=>p.type==="task"||(p.type==="focus"&&p.it&&p.it.cal)||(p.type==="errand"&&p.it&&p.it.cal)).forEach(p=>{
  const o=p.o!==undefined?p.o:(p.it&&p.it.o!==undefined?p.it.o:0);
  const why=p.type==="task"?"Ni heure ni lieu : une tâche simple, ajoutée à ta liste du jour et au tableau Kanban (À faire).":"Le bloc d'agenda est réservé ci-dessus ; la tâche correspondante va au tableau Kanban pour suivre l'avancement.";
  add({type:"task",o,title:p.type==="task"?p.title:p.title,why,conflict:"",link:p.type!=="task"});
  if(p.tm.before!=null){const bm=p.tm.before;add({type:"rem",o,s:Math.max(0,bm-60),title:"Échéance : « "+p.title+" » avant "+H(bm),why:"Tu as dit « avant "+H(bm)+" » : rappel 1"+NB+"h plus tôt.",ty:"heure",v:H(Math.max(0,bm-60)),conflict:""})}
  else if(p.deadline){add({type:"rem",o:Math.max(0,(p.it&&p.it.o)||0),s:600,title:"Échéance : « "+p.title+" » avant "+p.deadline,why:"Tu as dit « avant "+p.deadline+" » : rappel à 10"+NB+"h.",ty:"heure",v:H(600),conflict:""})}});
 parsed.filter(p=>p.type==="call"&&!(p.it&&p.it.cal)).forEach(p=>add({type:"task",o:p.o||0,title:p.title,why:"Appel sans plage libre : ajouté comme tâche.",conflict:""}));
 if(!items.length)ins.push("Je n'ai rien reconnu : essaie une phrase avec un jour, une heure ou une action (ex. « demain dentiste à 9 h »).");
 const un=parsed.filter(p=>!p.dayI&&!p.tm.start&&p.type==="task").length;
 if(un)ins.push(un+" élément(s) sans date : ajouté(s) comme tâches sans jour précis.");
 // jours chargés
 const byDay={};items.filter(i=>i.cal).forEach(i=>{byDay[i.o]=1});Object.keys(byDay).forEach(o=>{o=+o;const tot=calDay(o).filter(x=>x.k!=="b"&&x.k!=="l").reduce((a,x)=>a+x.d,0);if(tot>6*60)ins.push("Journée chargée : "+A.dlabel(o)+" atteindrait "+DUR(tot)+" de rendez-vous et de travail. Pense à déplacer quelque chose.")});
 return{items,ins:[...new Set(ins)],clauses:parsed.map(p=>({t:p.orig,type:p.type})),trunc}}
/* ---------- application / annulation ---------- */
const TYL={event:["📅","Agenda"],call:["📞","Agenda"],focus:["🎯","Agenda"],errand:["🛍️","Agenda"],trip:["🚗","Trajet"],task:["✅","Tâche"],mail:["✉️","Brouillon"],rem:["⏰","Rappel"]};
const COL={event:"var(--ac)",call:"var(--ac)",focus:"var(--ac2)",errand:"var(--ok)",trip:"var(--warn)"};
const chosen=()=>{const l=L();return(l.plan||[]).filter(i=>i.on!==false)};
function applyPlan(){const l=L();if(!l.plan||l.applied)return;const it=chosen();if(!it.length){toast("Rien à approuver : coche au moins un élément");return}
 const S=A.S;A.snap("Agendo Live");const ids={cal:[],tasks:[],todo:[],drafts:[],rem:[]};
 ["cal","tasks","todo","drafts","rem"].forEach(k=>{if(!Array.isArray(S[k]))S[k]=[]});
 it.forEach(i=>{const id=()=>A.id();
  if(i.cal){const e={id:id(),o:i.o,s:i.s,d:i.d,t:i.title,k:i.k,fx:!!i.fx,e:i.e};if(i.who&&i.who.length)e.who=i.who.slice();S.cal.push(e);ids.cal.push(e.id)}
  else if(i.type==="task"){const t={id:id(),t:i.title,s:"todo",p:"Agendo Live"};S.tasks.push(t);ids.tasks.push(t.id);if(!i.link){const td={id:id(),t:i.title,d:false,due:i.o};S.todo.push(td);ids.todo.push(td.id)}}
  else if(i.type==="mail"){const d={id:id(),to:i.to,s:i.title,b:mailBody(i)};S.drafts.push(d);ids.drafts.push(d.id)}
  else if(i.type==="rem"){const r={id:id(),t:i.title,ty:"heure",v:i.v,on:true,n:0};S.rem.push(r);ids.rem.push(r.id)}});
 l.applied={ids,n:it.length,ts:Date.now()};l.hist=l.applied;
 /* les éléments non cochés restent visibles mais ne sont plus modifiables */
 A.save();A.gain(Math.min(40,5+it.length*3),"Agendo Live");confetti(80);toast("✅ Plan approuvé : "+it.length+" élément"+(it.length>1?"s":"")+" ajouté"+(it.length>1?"s":"")+" (rien n'a été envoyé)");render()}
function undoPlan(){const l=L(),a=l.applied;if(!a)return;const S=A.S;
 const rm=(k,ids)=>{if(Array.isArray(S[k]))S[k]=S[k].filter(x=>!ids.includes(x.id))};
 rm("cal",a.ids.cal);rm("tasks",a.ids.tasks);rm("todo",a.ids.todo);rm("drafts",a.ids.drafts);rm("rem",a.ids.rem);
 l.applied=null;l.hist=null;A.save();toast("↶ Plan retiré de ton agenda, de tes tâches et de tes rappels");render()}
function mailBody(i){const fn=(i.to||"").split(" ")[0];return "Bonjour"+(fn&&!/^Destinataire/.test(fn)?" "+fn:"")+",\n\nJe vous écris au sujet de « "+i.title.replace(/^(?:Confirmation|Envoyer)\s*:\s*/,"")+" ». [Précisez ici le message.]\n\nMerci et bonne journée.\n\n(Brouillon généré par Agendo Live, simulé : à relire avant tout envoi.)"}
/* ---------- affichage ---------- */
const reduce=()=>A.S.reduce||matchMedia("(prefers-reduced-motion: reduce)").matches;
function tlHtml(l,anim){const days=[...new Set(l.plan.filter(i=>i.cal).map(i=>i.o))].sort((a,b)=>a-b).slice(0,14);if(!days.length)return"";
 const T0=420,T1=1260,sc=v=>((v-T0)/(T1-T0)*100).toFixed(2);let n=0;
 return `<div class="scroll"><div class="lv-days">${days.map(o=>{const ex=(A.S.cal||[]).filter(e=>e&&e.o===o&&Number.isFinite(e.s)&&Number.isFinite(e.d)&&e.s<T1&&e.s+e.d>T0);
  return `<div class="lv-day"><b>${esc(cap(A.dlabel(o)))}</b><div class="lv-col" role="img" aria-label="Aperçu de ${esc(A.dlabel(o))} : ${ex.length} élément(s) existant(s), ${l.plan.filter(i=>i.cal&&i.o===o&&i.on!==false).length} nouveau(x)">
  ${[8,10,12,14,16,18,20].map(h=>`<i class="lv-h" style="top:${sc(h*60)}%"><span>${h}${NB}h</span></i>`).join("")}
  ${ex.map(e=>`<div class="lv-b ex" style="top:${sc(Math.max(T0,e.s))}%;height:${Math.max(2.5,(Math.min(T1,e.s+e.d)-Math.max(T0,e.s))/(T1-T0)*100).toFixed(2)}%" title="${esc(e.t)}"><span>${esc(e.t)}</span></div>`).join("")}
  ${l.plan.filter(i=>i.cal&&i.o===o).map(i=>`<div class="lv-b new ${i.type}${i.on===false?" off":""}${i.conflict?" cf":""}" data-lvb="${i.id}" style="top:${sc(Math.max(T0,i.s))}%;height:${Math.max(2.5,(Math.min(T1,i.s+i.d)-Math.max(T0,i.s))/(T1-T0)*100).toFixed(2)}%;${anim?`animation-delay:${Math.min(2600,300+(n++)*160)}ms;`:""}" title="${esc(i.title)}"><span>${esc(i.title)}</span></div>`).join("")}</div></div>`}).join("")}</div></div>`}
function cardHtml(i,l,anim,idx){const ty=TYL[i.type]||["•",""];const ap=!!l.applied;const when=i.cal?`${esc(cap(A.dlabel(i.o)))}, ${H(i.s)} à ${H(i.s+i.d)}`:i.type==="rem"?`${esc(cap(A.dlabel(i.o)))} à ${esc(String(i.v||H(i.s||0)))}`:i.type==="mail"?`À : ${esc(i.to||"")}`:`${esc(cap(A.dlabel(i.o)))}`;
 return `<li class="lv-card t-${i.type}${i.conflict?" cf":""}${i.on===false?" off":""}" data-lvi="${i.id}" ${anim?`style="animation-delay:${Math.min(3200,500+idx*130)}ms"`:""}>
 <label class="lv-ck"><input type="checkbox" data-chg="lvOn" data-i="${i.id}" ${i.on!==false?"checked":""} ${ap?"disabled":""} aria-label="Inclure : ${esc(i.title)}"><span aria-hidden="true">${ty[0]}</span></label>
 <div class="lv-bd"><div class="lv-t"><b>${esc(i.title)}</b> <span class="tag">${ty[1]}</span>${i.conflict?` <span class="tag w">Conflit</span>`:""}</div><div class="sub lv-w">${when}</div><details class="lv-why"><summary>Pourquoi?</summary><p>${esc(i.why||"")}</p></details></div></li>`}
function statsHtml(l){const it=chosen();const c=t=>it.filter(i=>t.includes(i.type)).length;const trip=it.filter(i=>i.type==="trip").reduce((a,i)=>a+i.d,0);
 return `<div class="lv-stats" aria-live="polite"><div><b>${c(["event","call","focus","errand"])}</b><span>à l'agenda</span></div><div><b>${c(["task"])}</b><span>tâche${c(["task"])>1?"s":""} Kanban</span></div><div><b>${c(["mail"])}</b><span>brouillon${c(["mail"])>1?"s":""}</span></div><div><b>${c(["rem"])}</b><span>rappel${c(["rem"])>1?"s":""}</span></div><div><b>${trip?DUR(trip):"0"+NB+"min"}</b><span>de trajet</span></div></div>`}
function planHtml(){const l=L();if(!l.plan)return"";const anim=!!l.fresh&&!reduce();const ap=l.applied;
 const order=["event","call","focus","errand","trip","task","mail","rem"];const items=[...l.plan].sort((a,b)=>(a.o-b.o)||((a.s??1e4)-(b.s??1e4))||(order.indexOf(a.type)-order.indexOf(b.type)));
 return `<section class="lv-out${anim?" lv-anim":""}" aria-label="Plan proposé">
 <div class="row b" style="margin-bottom:6px"><h3 style="margin:0">Voici ton plan <span class="tag s">Aperçu : rien n'est modifié</span></h3></div>
 <div id="lvStats">${statsHtml(l)}</div>
 <h4 class="lv-h4">Ta ligne du temps</h4>${tlHtml(l,anim)||`<p class="sub">Aucun bloc d'agenda dans ce plan.</p>`}
 ${l.ins.length?`<h4 class="lv-h4">Ce que j'ai remarqué</h4><ul class="lv-ins">${l.ins.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}
 <h4 class="lv-h4">Chaque décision, expliquée</h4><ul class="lv-list">${items.map((i,x)=>cardHtml(i,l,anim,x)).join("")}</ul>
 <div class="lv-act row">${ap?`<button class="btn" disabled>Plan approuvé ✓ (${ap.n})</button><button class="btn d" data-act="lvUndo">↶ Annuler ce plan</button><button class="btn" data-act="lvGo" data-i="agenda">Voir l'agenda</button><button class="btn" data-act="lvGo" data-i="projects">Voir le Kanban</button>`:`<button class="btn p" id="lvOk" data-act="lvApply">✅ Approuver le plan (${chosen().length})</button><button class="btn" data-act="lvCopy">Copier le plan</button><button class="btn" data-act="lvClear">Recommencer</button>`}</div>
 <p class="sub">Les brouillons ne sont jamais envoyés. Après l'approbation, « Annuler ce plan » retire tout ce qui a été ajouté.</p></section>`}
V.live=()=>{const l=L();return `<div class="ep-hd"><h2><span class="ep-ico">⚡</span> Agendo Live</h2><p class="sub">Raconte ta journée en vrac, comme tu la dirais à voix haute. Agendo bâtit un plan complet : agenda, tâches, courriels, trajets et rappels. <span class="tag s">Analyse locale par règles</span> <span class="tag">Rien n'est modifié avant ton approbation</span></p></div>
 <div class="card lv-in"><label class="l" for="lvIn">Ta journée (ou ta semaine) en vrac</label>
 <textarea id="lvIn" rows="5" maxlength="${MAXC}" placeholder="Ex. : Demain j'ai le dentiste à 9 h, un lancement jeudi à 14 h, je dois magasiner un cadeau pour Marie…" aria-describedby="lvHelp">${esc(l.text)}</textarea>
 <div class="row b"><span id="lvHelp" class="sub" style="margin:0">Ctrl+Entrée pour construire · <span id="lvCnt">${l.text.length}</span>/${MAXC}</span><span class="row"><button class="btn" data-act="lvMic" id="lvMic" aria-pressed="false">🎙️ Dicter</button><button class="btn" data-act="lvClear">Effacer</button><button class="btn p" data-act="lvBuild" id="lvBuild">⚡ Construire mon plan</button></span></div>
 <div class="chips" style="margin-top:8px" role="group" aria-label="Exemples">${EXS.map((e,i)=>`<button class="chip lv-ex" data-act="lvEx" data-i="${i}">${esc(e[0])}</button>`).join("")}</div>
 <p id="lvErr" class="sub" role="alert" style="color:var(--warn);margin:6px 0 0" hidden></p></div>
 <div id="lvRes">${planHtml()}</div>`};
function render(){const r=$("#lvRes");if(r&&A.S.tab==="live"){r.innerHTML=planHtml();const l=L();l.fresh=false}else if(A.S.tab==="live")A.render()}
function build(){const ta=$("#lvIn");if(!ta)return;const txt=ta.value.slice(0,MAXC);const l=L();l.text=txt;const er=$("#lvErr");
 if(txt.trim().length<3){if(er){er.hidden=false;er.textContent="Écris au moins une phrase : par exemple « demain dentiste à 9 h »."}ta.focus();return}
 if(er)er.hidden=true;let res;try{res=analyse(txt)}catch(e){console.error(e);if(er){er.hidden=false;er.textContent="Désolé, je n'ai pas réussi à analyser ce texte. Essaie de le reformuler en phrases plus courtes."}return}
 l.plan=res.items;l.ins=res.ins;l.applied=null;l.day=todayStr();l.fresh=true;A.save();
 const r=$("#lvRes");r.innerHTML=planHtml();l.fresh=false;A.save();
 const o=$("#lvRes .lv-out");if(o){o.setAttribute("tabindex","-1");o.scrollIntoView({behavior:reduce()?"auto":"smooth",block:"start"});o.focus({preventScroll:true})}
 toast(res.items.length?"⚡ "+res.items.length+" élément"+(res.items.length>1?"s":"")+" repéré"+(res.items.length>1?"s":"")+" : relis le plan avant d'approuver":"Rien de reconnu dans ce texte")}
let rec=null;
function stopMic(){if(rec){try{rec.onend=null;rec.stop()}catch(e){}rec=null}const b=$("#lvMic");if(b)b.setAttribute("aria-pressed","false")}
Object.assign(ACT,{lvBuild:build,
 lvEx:x=>{const e=EXS[+x.dataset.i];if(!e)return;const ta=$("#lvIn");ta.value=e[1];L().text=e[1];$("#lvCnt").textContent=e[1].length;build()},
 lvClear:()=>{stopMic();const l=L();l.text="";l.plan=null;l.ins=[];l.applied=null;A.save();A.render();const ta=$("#lvIn");ta&&ta.focus()},
 lvApply:applyPlan,lvUndo:undoPlan,
 lvGo:x=>A.go(x.dataset.i),
 lvCopy:()=>{const l=L();const t=chosen().map(i=>"• "+(TYL[i.type]||["",""])[1]+" — "+i.title+(i.cal?" ("+A.dlabel(i.o)+", "+H(i.s)+")":"")).join("\n");A.clip("Plan Agendo Live\n"+t,"Plan copié dans le presse-papiers")},
 lvMic:x=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){toast("La dictée n'est pas disponible dans ce navigateur : tape ton texte ou utilise la dictée du clavier");return}
  if(rec){stopMic();return}
  try{rec=new SR();rec.lang="fr-CA";rec.interimResults=false;rec.continuous=true;
   rec.onresult=e=>{const ta=$("#lvIn");if(!ta)return;let t="";for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)t+=e.results[i][0].transcript;if(t){ta.value=(ta.value.trim()+" "+t.trim()).trim().slice(0,MAXC);L().text=ta.value;$("#lvCnt").textContent=ta.value.length}};
   rec.onerror=e=>{toast(e&&e.error==="not-allowed"?"Micro refusé : autorise-le dans ton navigateur":"Dictée interrompue");stopMic()};
   rec.onend=()=>{rec=null;const b=$("#lvMic");if(b)b.setAttribute("aria-pressed","false")};
   rec.start();x.setAttribute("aria-pressed","true");toast("🎙️ Je t'écoute : parle, puis reclique pour arrêter")}catch(e){rec=null;toast("Impossible de démarrer la dictée")}}});
Object.assign(CHG,{lvOn:t=>{const l=L();if(l.applied||!l.plan)return;const i=l.plan.find(x=>String(x.id)===String(t.dataset.i));if(!i)return;i.on=t.checked;A.save();
 const c=t.closest(".lv-card");c&&c.classList.toggle("off",!t.checked);const b=$('[data-lvb="'+i.id+'"]');b&&b.classList.toggle("off",!t.checked);
 const s=$("#lvStats");if(s)s.innerHTML=statsHtml(l);const ok=$("#lvOk");if(ok)ok.textContent="✅ Approuver le plan ("+chosen().length+")"}});
INIT.live=()=>{const ta=$("#lvIn");if(!ta)return;ta.addEventListener("input",()=>{L().text=ta.value.slice(0,MAXC);const c=$("#lvCnt");if(c)c.textContent=ta.value.length;A.save()});
 ta.addEventListener("keydown",e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();build()}})};
TABS.splice(1,0,["live","⚡","Agendo Live","Live ✨"]);A.buildTabs();
A.CMDS.push(["⚡ Ouvrir Agendo Live (journée en vrac → plan)",()=>A.go("live")]);
A.FEAT.unshift(["live","⚡","Agendo Live","Raconte ta journée en vrac : plan complet à approuver en un clic."]);

/* ---------- typographie fr-CA : espaces insécables (heures, %, $, « », ponctuation double) ---------- */
(()=>{const NBS="\u00a0";const fix=t=>t.replace(/(\d) (?=(?:h|min|%|\$|km|kg|°C|pts?|pièces?|XP|Hz)(?![\p{L}]))/gu,"$1"+NBS).replace(/(\d)h (?=\d{2}\b)/g,"$1h"+NBS).replace(/(\d) h (?=\d{2}\b)/g,"$1"+NBS+"h"+NBS).replace(/(\d) (?=\d{3}\b)/g,"$1"+NBS).replace(/« /g,"«"+NBS).replace(/ »/g,NBS+"»").replace(/(\S) (?=[:;!?](?:\s|$))/g,"$1"+NBS);
 const skip=n=>{for(let e=n.parentElement;e;e=e.parentElement){const t=e.tagName;if(t==="SCRIPT"||t==="STYLE"||t==="TEXTAREA"||t==="CODE"||t==="PRE"||t==="CANVAS"||t==="INPUT")return true}return false};
 function walk(root){const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const ns=[];let n;while((n=w.nextNode()))ns.push(n);ns.forEach(n=>{if(skip(n))return;const v=n.nodeValue;if(v.length<3||v.indexOf(" ")<0)return;const f=fix(v);if(f!==v)n.nodeValue=f})}
 let q=null;const roots=["#main","#planCards","#cmp","#faqList","#lifeBox","#toast"];
 const run=()=>{q=null;roots.forEach(r=>{const e=document.querySelector(r);if(e)walk(e)})};
 const sched=()=>{if(q)return;q=requestAnimationFrame(run)};
 const mo=new MutationObserver(sched);roots.forEach(r=>{const e=document.querySelector(r);if(e)mo.observe(e,{childList:true,subtree:true,characterData:true})});
 run();window.__typo={fix,run}})();
window.__live={analyse,L,applyPlan,undoPlan};
const pt=window.__pendTab||location.hash.slice(1);if(pt==="live"){A.S.tab="live";A.render()}
if(A.S.tab==="live")A.render();
})();
