const {test}=require('node:test'),assert=require('node:assert/strict');
const {resolve,translate,rows}=require('../dist/i18n.js');
test('Language auto detection uses ordered browser preferences, region aliases and English fallback',()=>{
 for(const [input,expected] of [['zh-TW','zh-CN'],['ja-JP','ja'],['en-US','en'],['es-MX','es-MX'],['es-ES','es-MX'],['ko-KR','ko']])assert.equal(resolve('auto',[input]),expected);
 assert.equal(resolve('auto',['fr-FR','ko-KR']),'ko');assert.equal(resolve('auto',['de']),'en');assert.equal(resolve('ja',['en-US']),'ja');assert.equal(resolve('invalid',['es-MX']),'es-MX');
});
test('Every phrase has all five locales, no duplicate keys, and numeric templates interpolate',()=>{
 assert.equal(new Set(rows.map(r=>r[0].trim())).size,rows.length);
 for(const row of rows){assert.equal(row.length,5);assert.ok(row.every(x=>x.trim().length));for(const lang of ['en','ja','es-MX','ko'])assert.notEqual(translate(row[0],lang),undefined);}
 assert.equal(translate('本机还剩 5 枚游客币，直接选游戏就能玩。','en'),'5 welcome coins left in this browser. Pick a game and play.');
 assert.equal(translate('长度 3 · 速度 2','ko'),'길이 3 · 속도 2');
 assert.equal(translate('本局 120 分 · 长度 15。再挑战一次？','es-MX'),'Puntos: 120 · Longitud: 15. ¿Otra vez?');
 assert.equal(translate('音效：开','zh-CN'),'音效：开');assert.equal(translate('2048','ja'),'2048');
});
test('Dynamic coin, match and profile messages translate without losing data',()=>{
 for(const lang of ['en','es-MX','ko'])for(const text of ['已投 1 枚模拟币，本场可玩到 15 分。重开另扣 1 币。','ab***@example.com · 演示身份','皮卡丘打排球开赛','P1 扣杀'])assert.ok(!/[\u4e00-\u9fff]/.test(translate(text,lang)),text+' '+lang);
 assert.ok(translate('ab***@example.com · 演示身份','ja').includes('ab***@example.com'));
});
