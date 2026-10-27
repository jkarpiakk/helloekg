const { chromium, devices } = require("playwright");
const { execSync } = require("child_process");
const B="http://localhost:5055"; const wyn=[]; const ok=(n,w,d='')=>wyn.push(`${w?'OK  ':'FAIL'} ${n} ${d}`);
const S1_00="9379701d-3afe-4dd6-91f8-cb95d6eba531", S2_02="a94a2de2-e338-4187-a880-52051beaa26c", QINT="5ada2828-acdf-4f7d-9a2d-af609180a585";
(async()=>{
  const br=await chromium.launch();
  for (const [nazwa,opt] of [["telefon",{...devices['iPhone 13']}],["komputer",{viewport:{width:1280,height:900}}]]) {
    const pg=await (await br.newContext(opt)).newPage(); const err=[]; pg.on('pageerror',e=>err.push(e.message));
    await pg.goto(B+"/"); const me=await pg.evaluate(async()=>{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'podglad@helloekg.test',password:'Podglad-2026-lokalnie'})});const j=await r.json();localStorage.setItem('hk:feedback-hint-seen','1');localStorage.setItem('hk-tour-v1:'+j.user.id,'done');return j.user.id});
    execSync(`ssh helloekg-studio "sudo -u postgres psql -d helloekg_kurs_dev -Atq -c \\"INSERT INTO attempts (id,user_id,question_id,selected_index,is_correct,time_ms,mode,created_at) SELECT gen_random_uuid(),'${me}','${QINT}',0,false,1000,'learn',now() WHERE NOT EXISTS (SELECT 1 FROM attempts WHERE user_id='${me}' AND question_id='${QINT}')\\""`);
    // wykład S1_00 pl.8: droga impulsu zamiast orkiestry
    await pg.goto(`${B}/lecture/${S1_00}#rozdzial-8`,{waitUntil:"networkidle"}); await pg.waitForTimeout(1500);
    const w=pg.locator('[data-testid="wstawka-otwarta"]'); await w.first().scrollIntoViewIfNeeded().catch(()=>{}); await pg.waitForTimeout(2500);
    ok(`${nazwa}: S1_00 pl.8 droga impulsu zamontowana`, await pg.locator('[data-wstawka="droga-impulsu"] .hw').count()>0);
    ok(`${nazwa}: S1_00 pl.8 bez drugiej ruchomej rzeczy (orkiestra ustąpiła)`, !(await pg.evaluate(()=>/Serce to orkiestra/i.test(document.querySelector('main')?.innerText||''))));
    await pg.screenshot({path:`5a-${nazwa}-s1_00.png`});
    // wykład S2_02 pl.1 i pl.3
    for (const r of [1,3]) {
      await pg.goto(`${B}/lecture/${S2_02}#rozdzial-${r}`,{waitUntil:"networkidle"}); await pg.waitForTimeout(1200);
      await pg.locator('[data-testid="wstawka-otwarta"]').first().scrollIntoViewIfNeeded().catch(()=>{}); await pg.waitForTimeout(2500);
      const ids=await pg.locator('[data-testid="wstawka-otwarta"]').evaluateAll(es=>es.map(e=>e.dataset.wstawka));
      const ocz= r===1 ? 'pomiary' : 'kardiomonitor';
      ok(`${nazwa}: S2_02 pl.${r} jedna wstawka ${ocz}`, ids.length===1 && ids[0]===ocz && await pg.locator('[data-testid="wstawka-otwarta"] .hw').count()>0, JSON.stringify(ids));
    }
    await pg.screenshot({path:`5a-${nazwa}-s2_02.png`});
    // pytanie Q-INT z monitorem w treści
    await pg.goto(`${B}/quiz?mode=review&ids=${QINT}`,{waitUntil:"networkidle"}); await pg.waitForTimeout(3000);
    const body=await pg.locator('[data-testid="question-body"]').innerText().catch(()=>'' );
    ok(`${nazwa}: Q-INT treść bez surowej linii`, body && !/::wstawka/.test(body), body.slice(0,60));
    ok(`${nazwa}: Q-INT monitor w treści zamontowany`, await pg.locator('[data-wstawka="kardiomonitor"] .hw').count()>0);
    const mon=await pg.locator('[data-wstawka="kardiomonitor"]').innerText().catch(()=>'');
    ok(`${nazwa}: monitor nie zdradza rozpoznania`, !/migotanie|AF\b|af-szybka/i.test(mon), mon.replace(/\n/g,' ').slice(0,80));
    await pg.locator('[data-wstawka="kardiomonitor"]').scrollIntoViewIfNeeded().catch(()=>{}); await pg.screenshot({path:`5c-${nazwa}.png`});
    ok(`${nazwa}: brak przewijania w bok`, !(await pg.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)));
    ok(`${nazwa}: bez błędów JS`, err.length===0, err.slice(0,2).join(' | '));
  }
  console.log(wyn.join('\n')); await br.close();
})();
