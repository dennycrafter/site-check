'use client';

import { ChangeEvent, useMemo, useRef, useState } from 'react';

type Screen = 'ops' | 'case' | 'intro' | 'details' | 'capture' | 'electrical' | 'review' | 'result';
type Answer = 'yes' | 'no' | '';

const photoSteps = [
  { id: 'meter', title: 'Electric meter', short: 'Meter close-up', instruction: 'Get close enough for the meter number to be sharp and readable.', tip: 'Keep the full gray meter box in frame.', icon: '◎' },
  { id: 'surroundings', title: 'Wall around the meter', short: 'Meter wall', instruction: 'Take about 10 steps back and capture the entire wall around the meter.', tip: 'Wide is better—we need to see available space.', icon: '⌗' },
  { id: 'right', title: 'Area right of the meter', short: 'Right side', instruction: 'From 10 steps away, capture the wall and open area to the right.', tip: 'Include fences, windows, AC units, and gas meters.', icon: '→' },
  { id: 'left', title: 'Area left of the meter', short: 'Left side', instruction: 'From 10 steps away, capture the wall and open area to the left.', tip: 'Include the ground and the nearest corner.', icon: '←' },
  { id: 'adjacent', title: 'Adjacent wall', short: 'Around the corner', instruction: 'Capture the closest side of the house from corner to corner.', tip: 'Show as much open ground as possible.', icon: '⌞' },
  { id: 'panel', title: 'Main breaker panel', short: 'Breaker panel', instruction: 'Open the panel door and photograph the full panel straight on.', tip: 'Never remove the screwed-on inner cover.', icon: '▤' },
  { id: 'disconnect', title: 'Main disconnect', short: 'Main breaker rating', instruction: 'Get a focused close-up of the number on the main switch.', tip: 'Look for 100, 125, 150, or 200.', icon: '⌁' },
];

export default function Home() {
  const [screen, setScreen] = useState<Screen>('ops');
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photos, setPhotos] = useState<Record<string, { name: string; url: string; status: 'checking' | 'pass' | 'retake'; message?: string }>>({});
  const [zip, setZip] = useState('');
  const [utility, setUtility] = useState('');
  const [solar, setSolar] = useState<Answer>('');
  const [battery, setBattery] = useState<Answer>('');
  const [breaker, setBreaker] = useState('');
  const [obstructions, setObstructions] = useState<Answer>('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [batchState, setBatchState] = useState<'idle' | 'running' | 'done'>('idle');
  const [caseDecision, setCaseDecision] = useState<'review' | 'approved' | 'retake' | 'failed'>('review');
  const fileRef = useRef<HTMLInputElement>(null);

  const captured = Object.values(photos).filter((photo) => photo.status === 'pass').length;
  const currentPhoto = photoSteps[photoIndex];
  const detailsReady = /^\d{5}$/.test(zip) && utility && solar && battery;
  const electricalReady = breaker && obstructions;
  const completion = useMemo(() => {
    if (screen === 'ops' || screen === 'intro') return 0;
    if (screen === 'details') return 10;
    if (screen === 'capture') return 20 + Math.round((captured / photoSteps.length) * 55);
    if (screen === 'electrical') return 80;
    if (screen === 'review') return 92;
    return 100;
  }, [screen, captured]);

  const goBack = () => {
    if (screen === 'details') setScreen('intro');
    else if (screen === 'capture') photoIndex > 0 ? setPhotoIndex(photoIndex - 1) : setScreen('details');
    else if (screen === 'electrical') { setScreen('capture'); setPhotoIndex(photoSteps.length - 1); }
    else if (screen === 'review') setScreen('electrical');
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const old = photos[currentPhoto.id];
    if (old?.url.startsWith('blob:')) URL.revokeObjectURL(old.url);
    const id = currentPhoto.id;
    const nextPhotoUrl = URL.createObjectURL(file);
    setPhotos({ ...photos, [id]: { name: file.name, url: nextPhotoUrl, status: 'checking' } });
    window.setTimeout(() => {
      const needsRetake = /dark|blurry|closed|wrong/i.test(file.name);
      setPhotos((current) => ({ ...current, [id]: { ...current[id], status: needsRetake ? 'retake' : 'pass', message: needsRetake ? (/closed/i.test(file.name) ? 'Lift the panel lid and try again.' : /dark/i.test(file.name) ? 'This photo is too dark. Move into daylight.' : 'Hold steady and keep the full subject in frame.') : 'Sharp, bright, and the right subject.' } }));
    }, 900);
    event.target.value = '';
  };

  const nextPhoto = () => {
    if (photoIndex < photoSteps.length - 1) setPhotoIndex(photoIndex + 1);
    else setScreen('electrical');
  };

  const addDemoPhotos = () => {
    const seeded = Object.fromEntries(photoSteps.map((photo) => [photo.id, { name: `${photo.id}.jpg`, url: '', status: 'pass' as const, message: 'Sharp, bright, and the right subject.' }]));
    setPhotos(seeded);
    setPhotoIndex(0);
    setScreen('capture');
  };

  const potentiallyEligible = battery !== 'yes' && Number(breaker) >= 100 && !(solar === 'yes' && Number(breaker) < 200);
  const runBatch = () => {
    setBatchState('running');
    window.setTimeout(() => setBatchState('done'), 2200);
  };

  return (
    <main className={`app-shell screen-${screen}`}>
      <header className="app-header">
        <button className="brand" aria-label="Base photo qualification home" onClick={() => setScreen('ops')}>
          <span className="base-wordmark">BASE</span><span>Photo <em>Qualification</em></span>
        </button>
        {screen !== 'ops' && screen !== 'intro' && screen !== 'result' && (
          <div className="progress-wrap" aria-label={`${completion}% complete`}>
            <span>{completion}% complete</span><div className="progress"><i style={{ width: `${completion}%` }} /></div>
          </div>
        )}
        <div className="header-actions"><button className="customer-view" type="button" onClick={() => { if (screen === 'ops' || screen === 'case') window.location.href = '/customer-deck'; else setScreen('ops'); }}>{screen === 'ops' || screen === 'case' ? 'View customer deck' : 'Team workspace'}</button><button className="help-button" type="button" onClick={() => setHelpOpen(true)}>Help</button></div>
      </header>

      {screen === 'ops' && (
        <section className="ops-page">
          <div className="ops-hero">
            <div><div className="step-kicker">Qualification operations</div><h2>Good morning, Maya.</h2><p>Homes are being checked as photos arrive. Your team only needs to review the uncertain ones.</p></div>
            <div className="ops-actions"><button className="secondary" onClick={() => setScreen('intro')}>Customer demo</button><button className="primary" onClick={runBatch} disabled={batchState === 'running'}>{batchState === 'running' ? 'Checking 12 homes…' : batchState === 'done' ? '12 checks complete' : 'Run parallel check'} <span>{batchState === 'running' ? '•••' : '→'}</span></button></div>
          </div>
          {batchState !== 'idle' && <div className={`batch-banner ${batchState}`}><span className="batch-pulse" /><div><b>{batchState === 'running' ? 'Running 12 photo checks in parallel' : 'Batch complete in 4.2 seconds'}</b><small>{batchState === 'running' ? 'Setup detection · quality · OCR · fixed rules' : '8 passed · 1 failed · 2 routed to review · 1 retake requested'}</small></div><code>{batchState === 'running' ? 'PROCESSING' : 'NO JOBS DROPPED'}</code></div>}
          <div className="ops-metrics">
            <article><span>In review</span><strong>8</strong><small>3 need attention</small></article>
            <article><span>Auto-decided today</span><strong>84%</strong><small className="up">↑ 6% this week</small></article>
            <article><span>Median check</span><strong>3.8s</strong><small>photo to verdict</small></article>
            <article><span>Retakes avoided</span><strong>31</strong><small>this week</small></article>
          </div>
          <div className="ops-panel">
            <div className="panel-head"><div><h3>Qualification queue</h3><span>Live · updated just now</span></div><div className="queue-tabs"><button className="active">All <b>24</b></button><button>Review <b>3</b></button><button>Retake <b>5</b></button></div></div>
            <div className="queue-table">
              <div className="queue-row table-labels"><span>Home</span><span>Setup</span><span>Checks</span><span>Decision</span><span>Processed</span><span /></div>
              <div className="queue-row"><span><i className="home-chip">ML</i><b>Martinez residence</b><small>Austin · #BQ-2918</small></span><span><b>Meter + exterior panel</b><small>7 photos</small></span><span><span className="check-stack"><i /><i /><i /><i /></span><small>4/4 passed</small></span><span><mark className="status pass">Pass · 2 batteries</mark></span><span><b>3.2 seconds</b><small>10:42 AM</small></span><button className="row-arrow">→</button></div>
              <div className="queue-row attention"><span><i className="home-chip amber">JW</i><b>Wilson residence</b><small>Dallas · #BQ-2917</small></span><span><b>Garage panel</b><small>8 photos</small></span><span><span className="check-stack"><i /><i /><i className="warn" /><i /></span><small>1 uncertain</small></span><span><mark className="status review">Needs review</mark></span><span><b>4.1 seconds</b><small>10:39 AM</small></span><button className="row-arrow" onClick={() => { setCaseDecision('review'); setScreen('case'); }} aria-label="Open Wilson residence">→</button></div>
              <div className="queue-row"><span><i className="home-chip rose">RC</i><b>Chen residence</b><small>Houston · #BQ-2916</small></span><span><b>All-in-one panel</b><small>6 photos</small></span><span><span className="check-stack"><i /><i className="bad" /><i /><i /></span><small>1 failed</small></span><span><mark className="status fail">Fail · clearance</mark></span><span><b>3.6 seconds</b><small>10:31 AM</small></span><button className="row-arrow">→</button></div>
              <div className="queue-row"><span><i className="home-chip blue">AK</i><b>King residence</b><small>Round Rock · #BQ-2915</small></span><span><b>Meter + exterior panel</b><small>5 of 7 photos</small></span><span><span className="check-stack"><i /><i /><i /><i className="warn" /></span><small>Photo quality</small></span><span><mark className="status retake">Retake requested</mark></span><span><b>2.9 seconds</b><small>10:26 AM</small></span><button className="row-arrow">→</button></div>
            </div>
          </div>
          <div className="insight-strip"><div className="insight-label"><span>↗</span><div><b>Operational insight</b><small>Based on the last 148 submissions</small></div></div><p><strong>42% of retakes</strong> are caused by closed panel lids—your most common avoidable delay.</p><button onClick={() => setScreen('intro')}>See customer prompt →</button></div>
        </section>
      )}

      {screen === 'case' && (
        <section className="case-page">
          <button className="back" onClick={() => setScreen('ops')}>← Qualification queue</button>
          <div className="case-heading"><div><div className="step-kicker">#BQ-2917 · Dallas, TX</div><h2>Wilson residence</h2><p>Submitted today at 10:39 AM · processed in <b>4.1 seconds</b></p></div><div className={`case-state ${caseDecision}`}><span>{caseDecision === 'review' ? 'Needs review' : caseDecision === 'approved' ? 'Approved · 1 battery' : caseDecision === 'retake' ? 'Retake requested' : 'Does not qualify'}</span><small>{caseDecision === 'review' ? '1 rule is uncertain' : 'Decision updated just now'}</small></div></div>
          <div className="case-grid">
            <aside className="photo-rail">
              <div className="rail-head"><h3>Submission</h3><span>8 photos</span></div>
              {['Meter close-up','Meter wall','Right side','Left side','Adjacent wall','Panel open','Main disconnect','Garage context'].map((label, index) => <button key={label} className={index === 2 ? 'flagged' : index === 0 ? 'selected' : ''}><div className={`mini-photo p${index}`}><span>{index === 5 ? '▤' : index === 6 ? '200' : '⌂'}</span></div><span><b>{label}</b><small>{index === 2 ? 'Clearance uncertain' : index === 5 ? 'Lid open · clear' : 'Quality passed'}</small></span><i>{index === 2 ? '!' : '✓'}</i></button>)}
            </aside>
            <div className="case-main">
              <section className="decision-card">
                <div className="decision-top"><div><span className="status review">Human review</span><h3>Likely fits 1 battery</h3><p>The electrical setup passes. Available space to the right of the meter is close to the required clearance, so the rules engine did not guess.</p></div><div className="confidence"><strong>82%</strong><span>decision confidence</span></div></div>
                <div className="rule-grid">
                  <article><span className="rule-icon pass">✓</span><div><b>Wiring strength</b><small>Main disconnect read as 200A</small></div><em>Pass · 98%</em></article>
                  <article><span className="rule-icon pass">✓</span><div><b>Equipment location</b><small>Meter and panel on compatible walls</small></div><em>Pass · 94%</em></article>
                  <article className="uncertain"><span className="rule-icon review">!</span><div><b>Battery clearance</b><small>Gas meter may be within 3 feet</small></div><em>Review · 67%</em></article>
                  <article><span className="rule-icon pass">✓</span><div><b>Photo quality</b><small>8 of 8 photos readable</small></div><em>Pass · 99%</em></article>
                </div>
              </section>
              <section className="pipeline-card">
                <div className="section-title"><div><h3>Decision pipeline</h3><span>AI reads photos. Fixed rules decide. Uncertainty routes here.</span></div><code>4.1s TOTAL</code></div>
                <div className="pipeline">
                  <article><span>01</span><div><b>Setup detected</b><small>Garage panel + exterior meter</small></div><em>0.8s · 96%</em></article>
                  <article><span>02</span><div><b>Photo quality checked</b><small>Sharp, bright, correct subject, lid open</small></div><em>0.6s · 99%</em></article>
                  <article><span>03</span><div><b>Amp number read</b><small>OCR extracted “200” from main switch</small></div><em>1.1s · 98%</em></article>
                  <article className="routed"><span>04</span><div><b>Rules evaluated</b><small>3 pass · 1 uncertain → human queue</small></div><em>1.6s · 82%</em></article>
                </div>
                <div className="console-log"><div><span>10:39:14.082</span> setup_type=<b>garage_panel</b> confidence=0.96</div><div><span>10:39:15.794</span> main_disconnect=<b>200A</b> confidence=0.98</div><div><span>10:39:17.301</span> clearance_right=<b>uncertain</b> estimated=2.8–3.4ft</div><div><span>10:39:17.304</span> route=<b>human_review</b> reason=distance_threshold</div></div>
              </section>
              <section className="case-actions"><div><b>Resolve this home</b><span>Your correction is recorded for rule tuning.</span></div><button className="secondary danger" onClick={() => setCaseDecision('failed')}>Fail home</button><button className="secondary" onClick={() => setCaseDecision('retake')}>Request one retake</button><button className="primary" onClick={() => setCaseDecision('approved')}>Approve 1 battery <span>✓</span></button></section>
            </div>
          </div>
        </section>
      )}

      {screen === 'intro' && (
        <div className="intro-layout">
          <section className="welcome">
            <div className="eyebrow"><span className="live-dot" /> Home eligibility check</div>
            <h1>Let’s find the right spot for your battery.</h1>
            <p className="lede">A few guided photos help our engineers understand your electrical setup and find a safe, code-compliant installation location.</p>
            <div className="time-card"><span className="time-icon">◷</span><div><strong>About 5 minutes</strong><span>Have access to your electric meter and breaker panel.</span></div></div>
            <div className="intro-actions"><button className="primary" type="button" onClick={() => setScreen('details')}>Start home check <span>→</span></button><button className="text-button" onClick={addDemoPhotos}>Preview demo</button></div>
            <p className="privacy">Your photos are securely shared with Base’s engineering team.</p>
          </section>
          <aside className="preview-card" aria-hidden="true">
            <div className="meter-art"><span className="meter-ring"><b>04281</b></span><i /></div><div className="scan-line" />
            <span className="preview-label">Guided capture</span><p>We’ll show you exactly what to photograph.</p>
          </aside>
        </div>
      )}

      {screen === 'details' && (
        <section className="form-page narrow">
          <button className="back" onClick={goBack}>← Back</button>
          <div className="step-kicker">Step 1 of 4 · Home details</div>
          <h2>First, tell us about your home.</h2>
          <p className="section-lede">This helps us apply the right local electrical and utility requirements.</p>
          <div className="field-grid">
            <label className="field"><span>ZIP code</span><input inputMode="numeric" maxLength={5} placeholder="78704" value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))} /><small>{zip && !/^\d{5}$/.test(zip) ? 'Enter a 5-digit ZIP code.' : 'Where the battery would be installed.'}</small></label>
            <label className="field"><span>Electric utility</span><select value={utility} onChange={(e) => setUtility(e.target.value)}><option value="">Select your utility</option><option>Oncor</option><option>CenterPoint</option><option>Austin Energy</option><option>CoServ</option><option>GVEC</option><option>Farmers Electric</option><option>Other / not sure</option></select><small>Shown on your electric bill.</small></label>
          </div>
          <Question title="Do you have rooftop solar?" value={solar} onChange={setSolar} note="Solar homes typically require a 200A panel." />
          <Question title="Do you already have a home battery?" value={battery} onChange={setBattery} note="Existing Powerwall, Enphase, or similar systems may not be compatible." />
          <button className="primary continue" disabled={!detailsReady} onClick={() => setScreen('capture')}>Continue to photos <span>→</span></button>
        </section>
      )}

      {screen === 'capture' && (
        <section className="capture-page">
          <div className="capture-copy">
            <button className="back" onClick={goBack}>← Back</button>
            <div className="step-kicker">Step 2 of 4 · Photo {photoIndex + 1} of {photoSteps.length}</div>
            <h2>{currentPhoto.title}</h2>
            <p className="section-lede">{currentPhoto.instruction}</p>
            <div className="tip"><b>Photo tip</b><span>{currentPhoto.tip}</span></div>
            <div className="photo-dots" aria-label="Photo progress">{photoSteps.map((photo, index) => <button key={photo.id} aria-label={`Go to ${photo.title}`} className={photos[photo.id]?.status === 'pass' ? 'done' : photos[photo.id]?.status === 'retake' ? 'needs-retake' : index === photoIndex ? 'active' : ''} onClick={() => setPhotoIndex(index)}>{photos[photo.id]?.status === 'pass' ? '✓' : photos[photo.id]?.status === 'retake' ? '!' : index + 1}</button>)}</div>
          </div>
          <div className={`camera-card ${photos[currentPhoto.id] ? 'has-photo' : ''}`}>
            {photos[currentPhoto.id]?.url ? <img src={photos[currentPhoto.id].url} alt={`Captured ${currentPhoto.title}`} /> : <div className="camera-scene"><div className="guide-box"><span className="guide-icon">{currentPhoto.icon}</span><b>Align {currentPhoto.short.toLowerCase()} here</b></div><div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" /></div>}
            {photos[currentPhoto.id] && <div className={`captured-badge ${photos[currentPhoto.id].status}`}>{photos[currentPhoto.id].status === 'checking' ? '◌ Checking photo…' : photos[currentPhoto.id].status === 'retake' ? `! ${photos[currentPhoto.id].message}` : `✓ ${photos[currentPhoto.id].message}`}</div>}
            <input ref={fileRef} className="file-input" type="file" accept="image/*" capture="environment" onChange={handleFile} />
            <div className="camera-actions"><button className="capture-button" onClick={() => fileRef.current?.click()}><span>●</span>{photos[currentPhoto.id] ? 'Retake photo' : 'Take photo'}</button>{photos[currentPhoto.id]?.status === 'pass' && <button className="primary next-photo" onClick={nextPhoto}>{photoIndex === photoSteps.length - 1 ? 'Electrical check' : 'Use photo'} <span>→</span></button>}</div>
          </div>
        </section>
      )}

      {screen === 'electrical' && (
        <section className="form-page narrow">
          <button className="back" onClick={goBack}>← Back</button>
          <div className="step-kicker">Step 3 of 4 · Electrical check</div>
          <h2>A couple of final checks.</h2>
          <p className="section-lede">Don’t worry if you’re unsure—an engineer will verify everything in your photos.</p>
          <fieldset className="question"><legend>What number is printed on your main breaker?</legend><div className="rating-grid">{['100','125','150','200','Not sure'].map((item) => <button type="button" key={item} className={breaker === item ? 'selected' : ''} onClick={() => setBreaker(item)}>{item}{item !== 'Not sure' && <small>amps</small>}</button>)}</div></fieldset>
          <Question title="Are there major obstructions within 3 feet of the meter wall?" value={obstructions} onChange={setObstructions} note="Examples: gas meter, AC unit, fence, window, or large shrubs." />
          <div className="safety-note"><span>i</span><p><b>Safety first</b> Never remove the panel’s screwed-on inner cover or touch wiring. We only need the main switch number.</p></div>
          <button className="primary continue" disabled={!electricalReady} onClick={() => setScreen('review')}>Review home check <span>→</span></button>
        </section>
      )}

      {screen === 'review' && (
        <section className="review-page">
          <button className="back" onClick={goBack}>← Back</button>
          <div className="review-head"><div><div className="step-kicker">Step 4 of 4 · Review</div><h2>Everything look right?</h2><p className="section-lede">Your photos will be reviewed by a Base engineer—not approved automatically.</p></div><div className="review-count"><strong>{captured}/{photoSteps.length}</strong><span>photos ready</span></div></div>
          <div className="review-grid">{photoSteps.map((photo, index) => <button className="review-card" key={photo.id} onClick={() => { setPhotoIndex(index); setScreen('capture'); }}><div className="thumb">{photos[photo.id]?.url ? <img src={photos[photo.id].url} alt="" /> : <span>{photo.icon}</span>}<i>{photos[photo.id]?.status === 'pass' ? '✓' : photos[photo.id]?.status === 'retake' ? '!' : '+'}</i></div><span>{photo.short}</span><small>{photos[photo.id]?.status === 'pass' ? 'Ready' : photos[photo.id]?.status === 'retake' ? 'Retake needed' : 'Add photo'}</small></button>)}</div>
          <div className="summary-strip"><div><span>Utility</span><b>{utility || 'Demo utility'}</b></div><div><span>Main breaker</span><b>{breaker || 'Not sure'}</b></div><div><span>Solar</span><b>{solar === 'yes' ? 'Yes' : solar === 'no' ? 'No' : 'Not provided'}</b></div><button onClick={() => setScreen('details')}>Edit</button></div>
          <label className="consent"><input type="checkbox" defaultChecked /><span>I confirm these photos show my home and may be reviewed to assess installation eligibility.</span></label>
          <button className="primary submit" disabled={captured < photoSteps.length} onClick={() => setScreen('result')}>Submit for review <span>→</span></button>
        </section>
      )}

      {screen === 'result' && (
        <section className="result-page">
          <div className={`result-orb ${potentiallyEligible ? '' : 'caution'}`}><span>{potentiallyEligible ? '✓' : '!'}</span></div>
          <div className="eyebrow centered"><span className="live-dot" /> Home check received</div>
          <h2>{potentiallyEligible ? 'Your home looks like a potential fit.' : 'Your setup needs a closer look.'}</h2>
          <p>{potentiallyEligible ? 'A Base engineer will review your photos and confirm the electrical and spacing requirements. Most reviews are completed within two business days.' : 'One or more answers may require a different configuration or may not meet current installation requirements. A Base engineer will verify your submission.'}</p>
          <div className="result-details"><div><span>Reference</span><b>BH-{zip || '78704'}-28F</b></div><div><span>Status</span><b>Engineering review</b></div><div><span>What’s next</span><b>We’ll contact you</b></div></div>
          <div className="result-actions"><button className="primary" onClick={() => window.print()}>Save confirmation <span>↗</span></button><button className="text-button" onClick={() => { setScreen('intro'); setPhotos({}); setPhotoIndex(0); }}>Start another check</button></div>
        </section>
      )}

      {helpOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setHelpOpen(false)}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setHelpOpen(false)}>×</button><div className="help-icon">?</div><h3 id="help-title">We’re here to help.</h3><p>Having trouble finding your meter or main breaker? You can continue with what you know—our team will follow up if another photo is needed.</p><a href="tel:+18882022220">Call (888) 202-2220</a><button className="secondary" onClick={() => setHelpOpen(false)}>Back to home check</button></section></div>}
    </main>
  );
}

function Question({ title, value, onChange, note }: { title: string; value: Answer; onChange: (value: Answer) => void; note: string }) {
  return <fieldset className="question"><legend>{title}</legend><div className="option-row"><button type="button" className={value === 'yes' ? 'selected' : ''} onClick={() => onChange('yes')}><span>Yes</span><i>✓</i></button><button type="button" className={value === 'no' ? 'selected' : ''} onClick={() => onChange('no')}><span>No</span><i>✓</i></button></div><small>{note}</small></fieldset>;
}
