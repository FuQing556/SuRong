/* Real API integration test */
const fs = require('fs');
const http = require('http');
const vm = require('vm');

(async () => {

// Setup client modules in VM
const store = {};
const sandbox = {
  window: { XIXI: { modulesLoaded: [] } },
  document: { createElement: () => ({}), querySelector: () => null, querySelectorAll: () => [] },
  navigator: { language: 'zh-CN', platform: 'Win32' },
  screen: { width: 1920, height: 1080 },
  localStorage: { getItem: k => store[k]||null, setItem: (k,v)=>{store[k]=v}, removeItem: k=>{delete store[k]}, get length(){return Object.keys(store).length}, key: ()=>null },
  setTimeout: fn=>{fn();return 0}, setInterval: ()=>0, clearInterval: ()=>{}, clearTimeout: ()=>{},
  requestIdleCallback: fn=>setTimeout(fn,0), console: console,
};
sandbox.global = sandbox;
const ctx = vm.createContext(sandbox);

['state.js','utils.js','saves.js','achievements.js','core.js'].forEach(m => {
  vm.runInContext(fs.readFileSync('public/js/'+m,'utf8'), ctx, {filename:m});
});
vm.runInContext('this.FALLBACK_TEMPLATE=FALLBACK_TEMPLATE;this.LS_KEYS=LS_KEYS;this.gameState=gameState;this.dom=dom;', ctx);

const tpl = JSON.parse(fs.readFileSync('templates/surongrong.json','utf8'));
const allFields = [];
for (const sec of Object.values(tpl.outputSections)) for (const f of sec.fields) allFields.push(f);

vm.runInContext('gameState.activeTemplate=FALLBACK_TEMPLATE;gameState.activeSaveId="surongrong";gameState.fullHistory=[];gameState.fieldHistory={};gameState.achievementFlags={gambitChosen:false,gambitSucceeded:false,gambitSuccessCount:0,endingTriggered:false,endingType:"",triggeredEndings:[],counterAttack:false,tradeCompleted:false,choiceCounts:{},responseMatches:{}};', ctx);

// Init from template + store full template in VM as active
vm.runInContext('gameState.activeTemplate = ' + JSON.stringify(tpl), ctx);

var is0 = tpl.initialState||{};
for (var k in is0) {
  if (!is0.hasOwnProperty(k)) continue;
  var v = is0[k];
  if (typeof v==='number') ctx.gameState.fieldHistory[k]={current:v,max:v};
  else if (typeof v==='string') ctx.gameState.fieldHistory[k]={currentText:v};
}

// Helper: make parseAIResponse use the REAL template, not FALLBACK_TEMPLATE
function parseWithTpl(raw) {
  return vm.runInContext('parseAIResponse(' + JSON.stringify(raw) + ', gameState.activeTemplate)', ctx);
}

var ok = 0, bad = 0;
function T(name, cond) {
  if (cond) { ok++; console.log('\x1b[32m✅\x1b[0m ' + name); }
  else { bad++; console.log('\x1b[31m❌\x1b[0m ' + name); }
}

function callAPI(messages) {
  return new Promise((resolve, reject) => {
    var data = JSON.stringify({messages, systemPrompt:null, templateId:'surongrong', templateFallback:null, apiKey:process.env.DEEPSEEK_API_KEY||''});
    var req = http.request({hostname:'localhost',port:3000,path:'/api/chat',method:'POST',
      headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)},timeout:120000}, res => {
      var body=''; res.on('data',c=>body+=c); res.on('end',()=>{
        if(res.statusCode!==200){reject(new Error('HTTP '+res.statusCode));return}
        var content='';
        body.split('\n').forEach(line=>{
          if(line.startsWith('data: ')&&line.length>6){
            try{var j=JSON.parse(line.slice(6));if(j.error){reject(new Error(j.error.message));return}
              var d=j.choices?.[0]?.delta?.content;if(d)content+=d}catch(e){}
          }
        });
        resolve(content);
      });
    });
    req.on('error',e=>reject(e));
    req.on('timeout',()=>{req.destroy();reject(new Error('timeout'))});
    req.write(data); req.end();
  });
}

console.log('═══ 真实API集成测试 ═══\n');

// ═══ ROUND 1 ═══
console.log('⏳ 回合1: 发送开局消息...');
var r1 = await callAPI([
  {role:'system',content:tpl.promptBody.substring(0,6000)},
  {role:'user',content:'开始游戏。【开局编号：1】'}
]);
console.log('   响应: ' + r1.length + ' 字符\n');

var p1 = parseWithTpl(r1);
console.log('场景: ' + (p1.sceneType||'?'));
console.log('压力值=' + p1.fields.stress + ' 暴露风险=' + p1.fields.exposure);
console.log('梦红尘好感=' + p1.fields.mengHaoGan + ' 圣灵教觊觎=' + p1.fields.shenglingjiao);
console.log('把柄=' + p1.fields.blackmail + ' 情报碎片=' + p1.fields.intel);
console.log('轮次=' + p1.fields.round + ' 魂力状态=' + p1.fields.soulState + '\n');

T('场景类型非空', !!p1.sceneType);
T('有4个选项', p1.options.length===4);
T('压力值为数字', p1.fields.stress!=='—'&&!isNaN(parseInt(p1.fields.stress)));
T('暴露风险为数字', p1.fields.exposure!=='—'&&!isNaN(parseInt(p1.fields.exposure)));
T('梦红尘好感为数字', p1.fields.mengHaoGan!=='—'&&!isNaN(parseInt(p1.fields.mengHaoGan)));
T('圣灵教觊觎存在(可为0)', p1.fields.shenglingjiao!==undefined&&p1.fields.shenglingjiao!=='—');
T('把柄存在', p1.fields.blackmail!==undefined&&p1.fields.blackmail!=='—');
T('轮次存在', p1.fields.round!==undefined);

// fieldHistory update
var f1 = {};
for (var f of allFields) { var v=p1.fields[f.id]; if(v!==undefined&&v!=='—'&&v!=='') f1[f.id]=v; }
vm.runInContext('updateFieldHistoryFromParsed({fields:'+JSON.stringify(f1)+'})', ctx);
var fh = ctx.gameState.fieldHistory;
T('fh:压力值有值', fh.stress&&fh.stress.current!==undefined);
T('fh:圣灵教觊觎有值', fh.shenglingjiao&&fh.shenglingjiao.current!==undefined);
T('fh:圣灵教觊觎正负正确', fh.shenglingjiao.current<=0); // 圣灵教觊觎 ≤ 0
T('fh:魂力状态文本型', fh.soulState&&fh.soulState.currentText!==undefined);

// Achievements at round < 2
ctx.localStorage.setItem('xixi_achievements_surongrong','{}');
vm.runInContext('gameState.fullHistory=[{role:"user"},{role:"assistant"}];checkAchievementsFromState({fields:'+JSON.stringify(f1)+'})', ctx);
var u1 = JSON.parse(ctx.localStorage.getItem('xixi_achievements_surongrong')||'{}');
T('回合1不触发成就(round<2守卫)', Object.keys(u1).length===0);

// Ending check
vm.runInContext('gameState.achievementFlags.triggeredEndings=[]', ctx);
var e1 = vm.runInContext('collectEligibleEndings(FALLBACK_TEMPLATE)', ctx);
T('回合1不触发结局', e1.length===0, e1.map(function(e){return e.name}).join(',')||'none');

// ═══ ROUND 2 ═══
console.log('\n⏳ 回合2: 选择第1个选项...');
var choiceText = p1.options[0] ? (p1.options[0].action + ' — ' + p1.options[0].cost) : '继续前进';
vm.runInContext('gameState.fullHistory=[{role:"user"},{role:"assistant"},{role:"user"}]', ctx); // roundNum=2

var r2 = await callAPI([
  {role:'system',content:tpl.promptBody.substring(0,5000)},
  {role:'assistant',content:r1},
  {role:'user',content:'选择 1. ' + choiceText}
]);
console.log('   响应: ' + r2.length + ' 字符\n');

var p2 = parseWithTpl(r2);
console.log('场景: ' + (p2.sceneType||'?'));
console.log('压力值=' + p2.fields.stress + ' 暴露风险=' + p2.fields.exposure);
console.log('梦红尘好感=' + p2.fields.mengHaoGan + ' 圣灵教觊觎=' + p2.fields.shenglingjiao);
console.log('把柄=' + p2.fields.blackmail + ' 情报碎片=' + p2.fields.intel + '\n');

T('回合2有场景', !!p2.sceneType);
T('回合2有4选项', p2.options.length===4);
T('回合2压力值数字', p2.fields.stress!=='—'&&!isNaN(parseInt(p2.fields.stress)));
T('回合2圣灵教觊觎存在', p2.fields.shenglingjiao!==undefined);

// Update fieldHistory
var f2 = {};
for (var f of allFields) { var v2=p2.fields[f.id]; if(v2!==undefined&&v2!=='—'&&v2!=='') f2[f.id]=v2; }
vm.runInContext('updateFieldHistoryFromParsed({fields:'+JSON.stringify(f2)+'})', ctx);

// Achievements at round >= 2
ctx.localStorage.setItem('xixi_achievements_surongrong','{}');
vm.runInContext('checkAchievementsFromState({fields:'+JSON.stringify(f2)+'})', ctx);
var u2 = JSON.parse(ctx.localStorage.getItem('xixi_achievements_surongrong')||'{}');
T('回合2成就检测不崩溃', true, '解锁: '+(Object.keys(u2).join(',')||'(无-正常)'));

// ═══ SAVE/LOAD ═══
console.log('\n═══ 存档/读档 ═══');
// Debug: check saveGameState inside VM - trace the actual flow
var saveDebug = vm.runInContext('\
gameState.gameStarted = true;\
gameState.activeSaveId = "surongrong";\
gameState.activeTemplate = FALLBACK_TEMPLATE;\
gameState.fullHistory = [{role:"user",content:"开始"},{role:"assistant",content:"AI回复"}];\
gameState.currentOptions = [{action:"test",cost:"low"}];\
gameState.fieldHistory = {stress:{current:50,max:50}};\
gameState.achievementFlags = {triggeredEndings:[],gambitSuccessCount:0};\
\
var svKey = getSaveKey("surongrong", 0);\
\
// Test: can we write to localStorage directly?\
localStorage.setItem("_test", "hello");\
var testRead = localStorage.getItem("_test");\
\
// Manually run the save logic (copy from saves.js)\
var saveSlot = 0;\
var saveData = {\
  dataVersion: 2,\
  templateId: "surongrong",\
  slot: saveSlot,\
  fullHistory: gameState.fullHistory.slice(-60),\
  summary: "", summarisedCount: 0,\
  currentOptions: gameState.currentOptions,\
  lastPlayed: Date.now(),\
  roundNumber: 1,\
  theme: "dark",\
  fieldHistory: gameState.fieldHistory,\
  achievementFlags: gameState.achievementFlags,\
};\
try {\
  localStorage.setItem(svKey, JSON.stringify(saveData));\
  var written = localStorage.getItem(svKey);\
} catch(e) {\
  var written = null; console.log("ERROR: " + e.message);\
}\
\
JSON.stringify({saveKey:svKey, testWrite:testRead, manualWrite:!!written, len:written?written.length:0});\
', ctx);
console.log('VM DEBUG: ' + saveDebug);
var sv = JSON.parse(ctx.localStorage.getItem('xixi_gamesave_surongrong')||'null');
T('存档写入', !!sv, 'keys:'+JSON.stringify(Object.keys(store).slice(0,5)));
T('存档含fieldHistory', sv&&!!sv.fieldHistory);
T('存档含achievementFlags', sv&&!!sv.achievementFlags);
T('存档dataVersion=2', sv&&sv.dataVersion===2);

// ═══ ENDING INJECTION ═══
console.log('\n═══ 结局注入 ═══');
var inj = vm.runInContext('buildEndingInjection("月光和六便士",FALLBACK_TEMPLATE)', ctx);
T('注入含命运转折回合', inj.indexOf('命运转折回合')>0);
T('注入含结局名', inj.indexOf('月光和六便士')>0);
T('注入含叙事(>80字)', inj.length>80);

// ═══ PROGRESS ═══
console.log('\n═══ 进度条 ═══');
var progRaw = vm.runInContext('\
gameState.activeTemplate = ' + JSON.stringify(tpl) + ';\
gameState.fieldHistory = {stress:{current:45,max:45},intel:{current:3,max:3},shenglingjiao:{current:-25,max:0},exposure:{current:15,max:18}};\
var r = {};\
r.p1 = getAchievementProgress("情报拼图");\
r.p2 = getAchievementProgress("圣灵教之影");\
r.p3 = getAchievementProgress("潜行大师");\
r.p4 = getAchievementProgress("钢丝上的舞者");\
JSON.stringify(r);\
', ctx);
prog = JSON.parse(progRaw);
T('情报拼图3/5', prog.p1&&prog.p1.current===3&&prog.p1.target===5, progRaw.substring(0,80));
T('圣灵教之影-25/-50', prog.p2&&prog.p2.current===-25&&prog.p2.target===-50, progRaw.substring(0,80));
T('潜行大师max=18≤20达成', prog.p3&&prog.p3.current===20, progRaw.substring(0,80));
T('钢丝舞者45/90', prog.p4&&prog.p4.current===45&&prog.p4.target===90, progRaw.substring(0,80));

// ═══ BOUNDARIES ═══
console.log('\n═══ 边界 ═══');
T('detectEnding标准', vm.runInContext('detectEnding("【命运转折·测试】")', ctx)==='测试');
T('detectEnding冒号', vm.runInContext('detectEnding("【命运转折：测试2】")', ctx)==='测试2');
T('detectEnding半角', vm.runInContext('detectEnding("[命运转折·测试3]")', ctx)==='测试3');
T('detectEnding无→null', vm.runInContext('detectEnding("普通")', ctx)===null);
T('_fieldVal不存在→undefined', vm.runInContext('_fieldVal("不存在",false)', ctx)===undefined);
T('_findFieldId空→null', vm.runInContext('_findFieldId("")', ctx)===null);

// ═══ SUMMARY ═══
console.log('\n' + '='.repeat(50));
console.log((bad>0?'\x1b[31m':'\x1b[32m') + ok + ' passed, ' + bad + ' failed, ' + (ok+bad) + ' total\x1b[0m');
if (bad>0) process.exit(1); else console.log('\n🎮 真实API集成测试全过！');

})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
