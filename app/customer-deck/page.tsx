'use client';

import { useEffect, useState } from 'react';

type Kind = 'welcome' | 'safety' | 'find' | 'detected' | 'camera' | 'approved' | 'choice' | 'complete' | 'analyze' | 'eligible' | 'review' | 'ineligible' | 'retake';
type JourneyScreen = { label:string; section:string; eyebrow:string; title:string; body:string; action:string; kind:Kind; note:string; icon?:string; tip?:string; photo?:number; branch?:boolean; next?:number; secondary?:string };

const screens: JourneyScreen[] = [
  { label:'Welcome', section:'Start', eyebrow:'Home eligibility check', title:'Let’s check your electrical setup.', body:'We’ll guide you through a few exterior photos to see if your home may qualify for a Base battery.', action:'Start home check', kind:'welcome', icon:'⌂', note:'Sets scope and expected effort: exterior electrical photos only.' },
  { label:'Safety first', section:'Start', eyebrow:'Before you begin', title:'Stay outside and stay safe.', body:'Never remove a screwed-on panel cover or touch electrical wiring. We only need photos of equipment you can access safely.', action:'I understand', kind:'safety', icon:'!', note:'Safety acknowledgement before any capture instructions.' },
  { label:'Find meter', section:'Identify setup', eyebrow:'Find your equipment', title:'Start with your electric meter.', body:'Look for a gray box with a round glass meter on an exterior wall of your home.', action:'I found it', kind:'find', icon:'◎', tip:'Usually on the side or back of your home.', note:'Helps the customer identify the correct exterior equipment.' },
  { label:'Setup detected', section:'Identify setup', eyebrow:'Setup identified', title:'Meter with exterior breaker panel.', body:'We found your meter and main panel together outside. Your photo list has been adjusted for this setup.', action:'Begin photos', kind:'detected', icon:'✓', note:'The first image adapts the required shot list. This example needs seven photos.' },
  { label:'Meter close-up', section:'Guided photos', eyebrow:'Photo 1 of 7', title:'Electric meter', body:'Fit the full meter box inside the outline. Move close enough for the meter number to be readable.', action:'Take photo', kind:'camera', icon:'◎', tip:'Hold your phone upright and steady.', photo:1, note:'Consistent framing supports subject validation and meter identification.' },
  { label:'Quality passed', section:'Guided photos', eyebrow:'Photo checked', title:'Meter photo looks good.', body:'The image is sharp, bright, and shows the correct equipment. We can use it for the eligibility check.', action:'Next photo', kind:'approved', icon:'✓', note:'Immediate validation prevents a later customer retake.' },
  { label:'Meter wall', section:'Guided photos', eyebrow:'Photo 2 of 7', title:'Step back for the full wall.', body:'Take about 10 steps back. Include the meter, the ground below it, and as much of the wall as possible.', action:'Take photo', kind:'camera', icon:'⌗', tip:'Wide is better—we need to see available space.', photo:2, note:'Wide view establishes equipment placement and overall install space.' },
  { label:'Right side', section:'Guided photos', eyebrow:'Photo 3 of 7', title:'Area right of the meter', body:'Keep the meter in view and capture the wall and ground to its right.', action:'Take photo', kind:'camera', icon:'→', tip:'Include windows, gas meters, AC units, and fences.', photo:3, note:'Used to evaluate one potential battery location and nearby obstructions.' },
  { label:'Left side', section:'Guided photos', eyebrow:'Photo 4 of 7', title:'Area left of the meter', body:'Keep the meter in view and capture the wall and ground to its left.', action:'Take photo', kind:'camera', icon:'←', tip:'Include the closest corner of the house.', photo:4, note:'Checks the alternate installation area and closest corner.' },
  { label:'Around corner', section:'Guided photos', eyebrow:'Photo 5 of 7', title:'Wall around the corner', body:'Photograph the nearest adjacent wall from corner to corner, including the ground.', action:'Take photo', kind:'camera', icon:'⌞', tip:'Stand far enough back to show the full side.', photo:5, note:'Finds an alternate location when the meter wall has limited space.' },
  { label:'Behind fence', section:'Conditional', eyebrow:'One more exterior view', title:'Is there a fence near the meter?', body:'If yes, show the full area behind it. This helps us understand access and usable space around the corner.', action:'Yes, take photo', secondary:'No fence nearby', kind:'choice', icon:'╫', note:'Conditional step appears only when a nearby fence is detected or reported.' },
  { label:'Find panel', section:'Main panel', eyebrow:'Main breaker panel', title:'Where is your main breaker panel?', body:'Choose the location that best matches your home. We’ll adjust the remaining instructions.', action:'Outside near meter', secondary:'Inside garage', kind:'choice', icon:'▤', note:'Typical branches are exterior, garage, or another accessible location.' },
  { label:'Panel context', section:'Main panel', eyebrow:'Photo 6 of 7', title:'Main breaker panel', body:'Step back and capture the entire panel, the meter, and the wall around both.', action:'Take photo', kind:'camera', icon:'▤', tip:'Keep both boxes and the ground in frame.', photo:6, note:'Confirms panel location and whether it is compatible with the meter layout.' },
  { label:'Open panel lid', section:'Main panel', eyebrow:'Open the hinged door', title:'Show the breakers inside.', body:'Open only the normal hinged panel door. Do not remove any screws or the inner metal cover.', action:'The door is open', kind:'safety', icon:'▥', tip:'Stop if the door is locked, damaged, or unsafe.', note:'Plain safety language ensures the main switch can be read without exposing wiring.' },
  { label:'Main disconnect', section:'Main panel', eyebrow:'Photo 7 of 7', title:'Main switch number', body:'Take a clear close-up of the large main switch. Make sure the amp number is sharp and readable.', action:'Take photo', kind:'camera', icon:'200', tip:'Common numbers are 100, 125, 150, or 200.', photo:7, note:'The system extracts the amp number used by the qualification rules.' },
  { label:'Photos complete', section:'Determine eligibility', eyebrow:'7 of 7 photos ready', title:'That’s everything we need.', body:'Your photos passed the quality check. We’re checking the wiring, equipment location, and available battery space.', action:'Check my eligibility', kind:'complete', icon:'✓', note:'Confirms the minimum photo set before analysis begins.' },
  { label:'Checking home', section:'Determine eligibility', eyebrow:'Checking your setup', title:'Reviewing your exterior system…', body:'We’re reading the main switch, checking the equipment layout, and looking for a safe installation area.', action:'View result', kind:'analyze', icon:'◌', note:'Shows each eligibility stage instead of an unexplained loading screen.' },
  { label:'Eligible', section:'Outcomes', eyebrow:'Eligibility result', title:'Your home looks like a fit.', body:'Your 200A service, exterior equipment layout, and available wall space appear compatible with up to two Base batteries.', action:'Finish home check', kind:'eligible', icon:'✓', note:'High-confidence pass. Battery count remains subject to final Base confirmation.' },
  { label:'Needs review', section:'Outcomes', eyebrow:'Eligibility result', title:'We need a closer look.', body:'Your electrical setup may qualify, but the available clearance is close to the requirement. A Base specialist will review it.', action:'Finish home check', kind:'review', icon:'?', branch:true, note:'Uncertain measurements never become a guessed pass or failure.' },
  { label:'Not eligible', section:'Outcomes', eyebrow:'Eligibility result', title:'This setup isn’t currently eligible.', body:'The main electrical service appears below the capacity required for this installation. Base will confirm before closing the review.', action:'Finish home check', kind:'ineligible', icon:'×', branch:true, note:'Clear failure includes a plain reason without exposing internal rule complexity.' },
  { label:'Retake request', section:'Exceptions', eyebrow:'Let’s try that photo again', title:'The panel lid is closed.', body:'Open the normal hinged door so the large main switch is visible, then take the same photo again.', action:'Retake photo', kind:'retake', icon:'!', branch:true, next:13, note:'Specific correction replaces a generic photo rejection.' },
];

export default function CustomerDeck() {
  const [current, setCurrent] = useState(0);
  const screen = screens[current];
  const advance = () => setCurrent(screen.next ?? Math.min(current + 1, 17));
  useEffect(() => {
    const onKey = (event:KeyboardEvent) => {
      if (event.key === 'ArrowRight') advance();
      if (event.key === 'ArrowLeft') setCurrent((value) => Math.max(0, value - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  let lastSection = '';
  return (
    <main className="deck-shell">
      <header className="deck-header"><div className="brand"><span className="base-wordmark">BASE</span><span className="deck-product-name">Home eligibility</span></div><div><span>Customer eligibility journey</span><b>{current + 1} / {screens.length}</b></div></header>
      <div className="deck-body">
        <aside className="deck-nav">{screens.map((item, index) => { const showSection = item.section !== lastSection; lastSection = item.section; return <div className="deck-nav-item" key={`${item.label}-${index}`}>{showSection && <span className="deck-label">{item.section}</span>}<button className={current === index ? 'active' : ''} onClick={() => setCurrent(index)}><i>{index + 1}</i><span>{item.label}{item.branch && <small>Branch</small>}</span></button></div>; })}</aside>
        <section className="deck-stage">
          <div className={`phone-frame phone-${screen.kind}`}>
            <div className="phone-top"><span className="base-wordmark phone-wordmark">BASE</span><small>{screen.photo ? `Photo ${screen.photo} of 7` : 'Home eligibility'}</small><button aria-label="Help">?</button></div>
            <div className="phone-progress"><i style={{ width: `${Math.min(((current + 1) / 18) * 100, 100)}%` }} /></div>
            {screen.kind === 'camera' ? <CameraScreen screen={screen} advance={advance} /> : <StandardScreen screen={screen} advance={advance} current={current} setCurrent={setCurrent} />}
          </div>
          <div className="deck-notes"><span>{screen.branch ? 'Alternative branch' : `Screen ${String(current + 1).padStart(2, '0')}`}</span><h2>{screen.label}</h2><p>{screen.note}</p><div className="deck-controls"><button disabled={current === 0} onClick={() => setCurrent(Math.max(0,current - 1))}>← Previous</button><button disabled={current === screens.length - 1} onClick={() => setCurrent(Math.min(screens.length - 1,current + 1))}>Next →</button></div><small>Tip: use ← and → keys to present.</small></div>
        </section>
      </div>
    </main>
  );
}

function CameraScreen({ screen, advance }:{ screen:JourneyScreen; advance:()=>void }) {
  const shots = ['Meter close-up','Full meter wall','Right clearance','Left clearance','Adjacent wall','Panel context','Main disconnect'];
  const active = Math.max(0, (screen.photo ?? 1) - 1);
  const [aligned, setAligned] = useState(false);
  useEffect(() => {
    setAligned(false);
    const timer = window.setTimeout(() => setAligned(true), 900);
    return () => window.clearTimeout(timer);
  }, [screen.photo]);
  return <div className="deck-camera landscape-capture">
    <div className="capture-statusbar"><b>13:41</b><span>Base guided capture</span><i className={aligned ? 'ready' : ''}>{aligned ? '✓ Ready' : '● Finding equipment'}</i></div>
    <aside className="orientation-rail"><button aria-label="Close capture">×</button><div className="phone-tilt"><i /><span>↻</span></div><b>Hold your phone sideways</b><small>Move slowly and keep both hands steady.</small></aside>
    <section className="capture-workspace">
      <div className={`deck-viewfinder guide-photo photo-${screen.photo}`}>
        <span className="deck-light">● Good light</span><span className="deck-example-label">Live guide</span>
        <div className={`equipment-outline target-${screen.photo} ${aligned ? 'aligned' : ''}`}><i /><i /><i /><i /><span>{aligned ? '✓' : screen.icon}</span></div>
        {!aligned && <div className="scan-line" />}
        <b className={`alignment-prompt ${aligned ? 'aligned' : ''}`} aria-live="polite">{aligned ? 'Equipment aligned · hold steady' : `Place ${screen.title.toLowerCase()} inside the outline`}</b>
      </div>
      <div className="capture-instruction"><div><b>{screen.title}</b><span>{screen.body}</span></div>{screen.tip && <small>Tip · {screen.tip}</small>}</div>
    </section>
    <aside className="shot-rail"><div className="shot-rail-head"><span>Required photos</span><button onClick={advance}>Done</button></div><div className="shot-list">{shots.map((shot,index)=><div className={index < active ? 'complete' : index === active ? 'active' : ''} key={shot}><i>{index < active ? '✓' : index + 1}</i><span>{shot}{index === active && <small>{aligned ? 'Ready to capture' : 'Aligning now'}</small>}</span></div>)}</div><div className="capture-meter"><b>{active}/7</b><span><i style={{width:`${(active/7)*100}%`}} /></span></div><button className="capture-trigger" aria-label={screen.action} onClick={advance} disabled={!aligned}><i /><span>{aligned ? 'Capture' : 'Aligning…'}</span></button></aside>
  </div>;
}

function StandardScreen({ screen, advance, current, setCurrent }:{ screen:JourneyScreen; advance:()=>void; current:number; setCurrent:(value:number)=>void }) {
  const examplePhoto = screen.kind === 'find' || screen.kind === 'approved' ? 1 : screen.kind === 'detected' ? 6 : screen.label === 'Open panel lid' || screen.kind === 'retake' ? 7 : 0;
  const showAnalysisVisual = screen.kind === 'detected' || screen.kind === 'analyze';
  return <div className="phone-content"><div className={`screen-art art-${screen.kind} ${examplePhoto && !showAnalysisVisual ? `photo-example photo-${examplePhoto}` : ''} ${showAnalysisVisual ? 'analysis-visual' : ''}`}><span>{screen.icon}</span>{examplePhoto > 0 && !showAnalysisVisual && <b className="screen-example-chip">Capture example</b>}{showAnalysisVisual && <b className="screen-example-chip">Qualification overlay</b>}{screen.kind === 'analyze' && <div className="analysis-list"><i className="done">✓ Meter + panel detected</i><i className="done">✓ 200A service read</i><i>◌ Clearance needs review</i></div>}{['eligible','review','ineligible'].includes(screen.kind) && <div className="result-facts"><i><b>{screen.kind === 'ineligible' ? '100A' : '200A'}</b><small>Main service</small></i><i><b>{screen.kind === 'eligible' ? '2' : screen.kind === 'review' ? '?' : '0'}</b><small>Batteries</small></i></div>}</div><div className="phone-eyebrow">{screen.eyebrow}</div><h1>{screen.title}</h1><p>{screen.body}</p>{screen.tip && <div className="phone-tip">{screen.tip}</div>}{screen.kind === 'choice' && <div className="choice-preview"><button className="selected">{screen.action}<i>✓</i></button><button>{screen.secondary}<i /></button></div>}<button className="deck-primary" onClick={advance}>{screen.kind === 'choice' ? 'Continue' : screen.action}<span>→</span></button>{screen.secondary && screen.kind !== 'choice' && <button className="deck-secondary" onClick={advance}>{screen.secondary}</button>}{current === 17 && <button className="deck-secondary" onClick={() => setCurrent(18)}>Preview other outcomes</button>}</div>;
}
