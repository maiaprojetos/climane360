const AWC = 'https://aviationweather.gov/api/data';
const SIROS = 'https://sas.anac.gov.br/sas/siros_api/api/voos';

function json(res, body, status=200){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');
  res.end(JSON.stringify(body));
}
function pick(o, names){
  const keys=Object.keys(o||{});
  const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  for(const n of names){ const k=keys.find(x=>norm(x)===norm(n)); if(k!=null && o[k]!=null && o[k]!=='') return o[k]; }
  return null;
}
function parseDate(v){
  if(v==null)return null;
  if(v instanceof Date)return isNaN(v)?null:v;
  const s=String(v).trim();
  if(!s)return null;
  let d=new Date(s);
  if(!isNaN(d))return d;
  const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if(m)return new Date(Date.UTC(+m[3],+m[2]-1,+m[1],+m[4],+m[5],+(m[6]||0)));
  return null;
}
function isoDateBR(d){
  const dd=String(d.getUTCDate()).padStart(2,'0'), mm=String(d.getUTCMonth()+1).padStart(2,'0'), yy=d.getUTCFullYear();
  return `${dd}${mm}${yy}`;
}
function arrayify(x){
  if(Array.isArray(x))return x;
  if(x && Array.isArray(x.data))return x.data;
  if(x && Array.isArray(x.voos))return x.voos;
  if(x && Array.isArray(x.registros))return x.registros;
  return [];
}
function normFlight(r){
  const airline=pick(r,['Código ICAO Empresa','Codigo ICAO Empresa','empresa','icaoEmpresa','codEmpresa']);
  const flight=pick(r,['Número Voo','Numero Voo','numeroVoo','voo','flight']);
  const origin=pick(r,['Código ICAO Aeroporto Origem','Codigo ICAO Aeroporto Origem','origem','aeroportoOrigem']);
  const destination=pick(r,['Código ICAO Aeroporto Destino','Codigo ICAO Aeroporto Destino','destino','aeroportoDestino']);
  const dep=pick(r,['Data e Horário Partida Prevista','Data e Horario Partida Prevista','partidaPrevista','dataHorarioPartidaPrevista']);
  const arr=pick(r,['Data e Horário Chegada Prevista','Data e Horario Chegada Prevista','chegadaPrevista','dataHorarioChegadaPrevista']);
  const equipment=pick(r,['Código ICAO Equipamento','Codigo ICAO Equipamento']);
  return {airline:airline||'—',flight:flight||'—',origin:origin||'—',destination:destination||'—',dep:parseDate(dep),arr:parseDate(arr),equipment:equipment||null,raw:r};
}
async function getScheduled(date){
  const u=`${SIROS}?dataReferencia=${isoDateBR(date)}`;
  const r=await fetch(u,{headers:{'User-Agent':'Painel-Meteorologico-NE/9.0'}});
  if(!r.ok) throw new Error(`SIROS ${r.status}`);
  return arrayify(await r.json()).map(normFlight);
}
function within(d,a,b){return d && d>=a && d<=b}
function makeFlight(f,time,actual=false){return {airline:f.airline,flight:f.flight,origin:f.origin,destination:f.destination,time:time.toISOString(),actual,source:'ANAC/SIROS',equipment:f.equipment};}

function normalizeWind(m){
  if(!m)return null;
  const w=m.wind||{};
  const speedKt=w.speedKt ?? w.speed_kt ?? m.wspd ?? m.windSpeed ?? null;
  const directionDeg=w.directionDeg ?? w.direction ?? w.dir ?? m.wdir ?? m.windDirection ?? null;
  const gustKt=w.gustKt ?? w.gust_kt ?? m.wgst ?? null;
  const out={};
  if(Number.isFinite(Number(speedKt)))out.speedKt=Number(speedKt);
  if(Number.isFinite(Number(directionDeg)))out.directionDeg=Number(directionDeg);
  if(Number.isFinite(Number(gustKt)))out.gustKt=Number(gustKt);
  return Object.keys(out).length?out:null;
}

function ceilingFromMetar(m){
  const layers=Array.isArray(m?.clouds)?m.clouds:[];
  const c=layers.filter(x=>['BKN','OVC','VV'].includes(String(x.cover||'').toUpperCase()) && Number.isFinite(Number(x.base))).map(x=>Number(x.base));
  return c.length?Math.min(...c):null;
}
async function getMetar(icao){
  const u=`${AWC}/metar?ids=${encodeURIComponent(icao)}&hours=10&format=json`;
  const r=await fetch(u,{headers:{'User-Agent':'Painel-Meteorologico-NE/9.0'}});
  if(!r.ok)return {history:[],latest:null};
  const a=await r.json();
  const history=Array.isArray(a)?a.sort((x,y)=>new Date(y.obsTime||y.reportTime)-new Date(x.obsTime||x.reportTime)):[];
  return {history,latest:history[0]||null};
}
async function getTaf(icao){
  const u=`${AWC}/taf?ids=${encodeURIComponent(icao)}&format=json`;
  const r=await fetch(u,{headers:{'User-Agent':'Painel-Meteorologico-NE/9.0'}});
  if(!r.ok)return null;
  const a=await r.json();
  return Array.isArray(a)?a[0]||null:null;
}
module.exports=async (req,res)=>{
  try{
    const icao=String(req.query?.icao||'').toUpperCase().trim();
    if(!icao)return json(res,{error:'Informe o ICAO do aeroporto.'},400);
    const now=new Date();
    const past=new Date(now.getTime()-10*3600e3), future=new Date(now.getTime()+10*3600e3);
    const dates=[new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())), new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-1))];
    const [today,yesterday,metar,taf]=await Promise.all([
      getScheduled(dates[0]).catch(()=>[]),getScheduled(dates[1]).catch(()=>[]),getMetar(icao).catch(()=>({history:[],latest:null})),getTaf(icao).catch(()=>null)
    ]);
    const flights=[...today,...yesterday];
    const arrivalsPast=[],departuresPast=[],arrivalsNext=[],departuresNext=[];
    for(const f of flights){
      if(f.destination===icao && within(f.arr,past,now)) arrivalsPast.push(makeFlight(f,f.arr));
      if(f.origin===icao && within(f.dep,past,now)) departuresPast.push(makeFlight(f,f.dep));
      if(f.destination===icao && within(f.arr,now,future)) arrivalsNext.push(makeFlight(f,f.arr));
      if(f.origin===icao && within(f.dep,now,future)) departuresNext.push(makeFlight(f,f.dep));
    }
    const sort=(a,b)=>new Date(a.time)-new Date(b.time);
    [arrivalsPast,departuresPast].forEach(a=>a.sort((x,y)=>new Date(y.time)-new Date(x.time)));
    [arrivalsNext,departuresNext].forEach(a=>a.sort(sort));
    const m=metar.latest;
    json(res,{
      icao,
      window:{from:past.toISOString(),to:future.toISOString()},
      arrivalsPast,departuresPast,arrivalsNext,departuresNext,
      metar:m?{obsTime:m.obsTime||m.reportTime,rawOb:m.rawOb||m.raw_text||'',clouds:m.clouds||[],visibility:m.visib||null,wind:normalizeWind(m)}:null,
      metarHistory:metar.history.slice(0,10).map(x=>({obsTime:x.obsTime||x.reportTime,rawOb:x.rawOb||x.raw_text||'',clouds:x.clouds||[],visibility:x.visib||null,wind:normalizeWind(x)})),
      ceilingFt:ceilingFromMetar(m),
      taf:taf?{issueTime:taf.issueTime||taf.bulletinTime,validTimeFrom:taf.validTimeFrom,validTimeTo:taf.validTimeTo,rawTAF:taf.rawTAF||taf.rawOb||''}:null,
      source:{flights:'ANAC/SIROS — voos programados; horários em UTC na API e convertidos pelo navegador para horário local.',weather:'Aviation Weather Center METAR/TAF'}
    });
  }catch(e){json(res,{error:e.message||'Erro ao consultar aeroporto.'},502)}
};
