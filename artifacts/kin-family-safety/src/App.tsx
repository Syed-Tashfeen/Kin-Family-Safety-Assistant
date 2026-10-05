import { useCallback, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter, Link } from 'wouter';
import { useCreateKinLiveToken } from '@workspace/api-client-react';
import { AlertTriangle, ArrowLeft, AudioLines, Check, ChevronRight, CircleHelp, Clock3, Copy, Eye, History, Languages, Mic, MicOff, Moon, MonitorUp, MoonStar, Pause, Radio, Send, Settings as SettingsIcon, Shield, ShieldCheck, Sun, Trash2, X } from 'lucide-react';

type KinAlert = { id:string; createdAt:string; severity:'high'|'medium'|'info'; title:string; summary:string; evidence:string; recommendedAction:string; screenshotDataUrl?:string; demo?:boolean };
type Language='auto'|'en'|'hi'|'bn'|'ta'|'te'|'mr'|'ur';
type KinSettings = { preferredLanguage:Language; familyName:string; familyContact:string; theme:'light'|'dark' };
type Transcript = { role:'you'|'kin'; text:string };
const SETTINGS_KEY='kin-settings-v1', ALERTS_KEY='kin-alerts-v1';
const defaults:KinSettings={preferredLanguage:'auto',familyName:'Maya',familyContact:'',theme:'light'};
const languages=[['en','English'],['hi','हिन्दी'],['bn','বাংলা'],['ta','தமிழ்'],['te','తెలుగు'],['mr','मराठी'],['ur','اردو'],['auto','Auto-detect']];
const safetySystem=(language:string)=>[
 'You are Kin, a patient, protective technology guide for parents. Explain one simple step at a time, in plain language, and allow the parent to interrupt you at any moment.',
 language==='auto'?"Detect the parent's language and reply in the same language. Follow natural code-switching and do not ask them to choose a language.":`Speak in the language selected by the parent (language code: ${language}), while still understanding mixed-language speech.`,
 'The shared screen is private. Describe only what is visible and never claim to have clicked a control or changed the device yourself.',
 'If a person, website, or pop-up asks the parent to install remote-access software, share a password or one-time code, move money, or keep a financial request secret, warn them immediately. Do not reassure them without evidence.',
 'When you see a useful screen control, call highlight_screen_element with normalized coordinates (0 to 1) and a short instruction.',
 'When you detect a likely scam or urgent risk, call raise_scam_alert immediately with severity, a concise evidence-based summary, and one safe next step. Include a normalized screen region when the suspicious item is visible.',
 'You may use Google Search grounding to verify current contact details, warnings, or claims. Clearly distinguish confirmed information from uncertainty, and never ask for or repeat a password, PIN, or one-time code.'
].join(' ');

const readLocal=<T,>(key:string,fallback:T):T=>{try{const value=localStorage.getItem(key);return value?JSON.parse(value) as T:fallback}catch{return fallback}};
function AppShell(){
 const [path,setPath]=useLocation();
 const [settings,setSettings]=useState<KinSettings>(()=>readLocal(SETTINGS_KEY,defaults));
 const [alerts,setAlerts]=useState<KinAlert[]>(()=>readLocal(ALERTS_KEY,[]));
 const [transcript,setTranscript]=useState<Transcript[]>([]);
 const [draft,setDraft]=useState('');
 const [status,setStatus]=useState<'demo'|'connecting'|'live'|'error'>('demo');
 const [sessionNotice,setSessionNotice]=useState('');
 const [listening,setListening]=useState(false);
 const [sharing,setSharing]=useState(false);
 const [currentAlert,setCurrentAlert]=useState<KinAlert|null>(null);
 const [highlight,setHighlight]=useState<{x:number;y:number;width:number;height:number;label:string}|null>(null);
 const [screenImage,setScreenImage]=useState('');
 const [message,setMessage]=useState('');
 const [expandedAlert,setExpandedAlert]=useState<string|null>(null);
 const mutation=useCreateKinLiveToken();
 const socketRef=useRef<WebSocket|null>(null), audioStream=useRef<MediaStream|null>(null), displayStream=useRef<MediaStream|null>(null), sessionExpiryRef=useRef<number|undefined>(undefined);
 const statusRef=useRef(status);statusRef.current=status;
 const contextRef=useRef<AudioContext|null>(null), processorRef=useRef<ScriptProcessorNode|null>(null), sourceRef=useRef<MediaStreamAudioSourceNode|null>(null), screenImageRef=useRef(''), outputSourceRef=useRef<AudioBufferSourceNode|null>(null);
 const audioQueue=useRef<string[]>([]), isPlaying=useRef(false), audioElement=useRef<HTMLAudioElement|null>(null), screenTimer=useRef<number|undefined>(undefined), sessionReady=useRef(false), suppressAudio=useRef(false);
 useEffect(()=>{try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings))}catch{/* keep settings available in memory if storage is blocked */}document.documentElement.classList.toggle('dark',settings.theme==='dark')},[settings]);
 useEffect(()=>{try{localStorage.setItem(ALERTS_KEY,JSON.stringify(alerts))}catch{try{localStorage.setItem(ALERTS_KEY,JSON.stringify(alerts.map(({screenshotDataUrl,...alert})=>alert)))}catch{/* local history remains available in memory if browser storage is disabled */}}},[alerts]);
 const addAlert=useCallback((alert:KinAlert)=>{setAlerts(prev=>[alert,...prev]);setCurrentAlert(alert);},[]);
 const stopSession=useCallback(()=>{
   socketRef.current?.close();socketRef.current=null;if(sessionExpiryRef.current)window.clearTimeout(sessionExpiryRef.current);sessionReady.current=false;
  processorRef.current?.disconnect();sourceRef.current?.disconnect();
  audioStream.current?.getTracks().forEach(track=>track.stop());audioStream.current=null;
   displayStream.current?.getTracks().forEach(track=>track.stop());displayStream.current=null;
   if(screenTimer.current)window.clearInterval(screenTimer.current);const video=document.querySelector<HTMLVideoElement>('#screen-source');if(video)video.srcObject=null;
   outputSourceRef.current?.stop();outputSourceRef.current=null;audioQueue.current=[];isPlaying.current=false;suppressAudio.current=false;statusRef.current='demo';
   contextRef.current?.close().catch(()=>{});contextRef.current=null;
   screenImageRef.current='';setScreenImage('');setHighlight(null);setListening(false);setSharing(false);setStatus('demo');setSessionNotice('Live session ended. Your microphone and shared screen are off.');
 },[]);
 useEffect(()=>()=>{socketRef.current?.close();audioStream.current?.getTracks().forEach(t=>t.stop());displayStream.current?.getTracks().forEach(t=>t.stop());if(screenTimer.current)clearInterval(screenTimer.current);contextRef.current?.close().catch(()=>{})},[]);
 const playNext=useCallback(()=>{if(isPlaying.current||audioQueue.current.length===0)return;const encoded=audioQueue.current.shift();if(!encoded)return;isPlaying.current=true;
  const raw=atob(encoded), bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  const ctx=contextRef.current;if(!ctx){isPlaying.current=false;return}
  const samples=new Int16Array(bytes.buffer), buffer=ctx.createBuffer(1,samples.length,24000), channel=buffer.getChannelData(0);
  for(let i=0;i<samples.length;i++)channel[i]=samples[i]/32768;
  const source=ctx.createBufferSource();outputSourceRef.current=source;source.buffer=buffer;source.connect(ctx.destination);source.onended=()=>{if(outputSourceRef.current===source)outputSourceRef.current=null;isPlaying.current=false;playNext()};source.start();
 },[]);
 const captureFrame=useCallback(()=>{const stream=displayStream.current;if(!stream)return;const video=document.querySelector<HTMLVideoElement>('#screen-source');if(!video||!video.videoWidth)return;const canvas=document.createElement('canvas');const scale=Math.min(1,1280/video.videoWidth,720/video.videoHeight);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);canvas.getContext('2d')?.drawImage(video,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',.62);screenImageRef.current=data;setScreenImage(data);const sock=socketRef.current;if(sock?.readyState===WebSocket.OPEN)sock.send(JSON.stringify({realtimeInput:{video:{mimeType:'image/jpeg',data:data.split(',')[1]}}}))},[]);
 const startSession=async()=>{
   if(!navigator.mediaDevices?.getUserMedia){setStatus('error');setSessionNotice('Live voice needs a supported browser on a secure (HTTPS) page. Text and demo mode are still ready.');return}
    setStatus('connecting');statusRef.current='connecting';setSessionNotice('Requesting a short-lived secure session…');
  try{
   const token=await mutation.mutateAsync({data:{preferredLanguage:settings.preferredLanguage}});
    const socket=new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token.token)}`);
   socketRef.current=socket;
   socket.onopen=async()=>{
    try{
      sessionReady.current=false;
       socket.send(JSON.stringify({setup:{model:`models/${token.model}`,generationConfig:{responseModalities:['AUDIO']},inputAudioTranscription:{},outputAudioTranscription:{},sessionResumption:{},systemInstruction:{parts:[{text:safetySystem(settings.preferredLanguage)}]},tools:[{googleSearch:{}},{functionDeclarations:[
      {name:'highlight_screen_element',description:'Point out a visible screen control to help the parent with the next step. Coordinates are normalized fractions of the shared screen.',parameters:{type:'OBJECT',properties:{x:{type:'NUMBER',description:'Left position as a fraction from 0 to 1.'},y:{type:'NUMBER',description:'Top position as a fraction from 0 to 1.'},width:{type:'NUMBER',description:'Width as a fraction from 0 to 1.'},height:{type:'NUMBER',description:'Height as a fraction from 0 to 1.'},label:{type:'STRING',description:'A short instruction for the user.'}},required:['x','y','width','height','label']}},
      {name:'raise_scam_alert',description:'Immediately warn the parent about a likely scam or urgent safety risk and show a safe next step.',parameters:{type:'OBJECT',properties:{severity:{type:'STRING',enum:['warning','high','critical'],description:'Risk level. Use high or critical for active scam indicators.'},title:{type:'STRING'},summary:{type:'STRING'},evidence:{type:'STRING'},recommendedAction:{type:'STRING'},x:{type:'NUMBER',description:'Optional screen highlight left position from 0 to 1.'},y:{type:'NUMBER',description:'Optional screen highlight top position from 0 to 1.'},width:{type:'NUMBER',description:'Optional screen highlight width from 0 to 1.'},height:{type:'NUMBER',description:'Optional screen highlight height from 0 to 1.'}},required:['severity','title','summary','evidence','recommendedAction']}}
     ]}]}}));
     audioStream.current=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1}});
     const ctx=new AudioContext();contextRef.current=ctx;await ctx.resume();
     const source=ctx.createMediaStreamSource(audioStream.current), processor=ctx.createScriptProcessor(4096,1,1);sourceRef.current=source;processorRef.current=processor;
       processor.onaudioprocess=(event)=>{const sock=socketRef.current;if(!sessionReady.current||sock?.readyState!==WebSocket.OPEN)return;const input=event.inputBuffer.getChannelData(0), ratio=ctx.sampleRate/16000, length=Math.floor(input.length/ratio), pcm=new Int16Array(length);let energy=0;for(let i=0;i<length;i++){const sample=input[Math.floor(i*ratio)];energy+=sample*sample;pcm[i]=Math.max(-1,Math.min(1,sample))*32767}if(Math.sqrt(energy/Math.max(1,length))>.018)suppressAudio.current=false;let binary='';new Uint8Array(pcm.buffer).forEach(v=>binary+=String.fromCharCode(v));sock.send(JSON.stringify({realtimeInput:{audio:{mimeType:'audio/pcm;rate=16000',data:btoa(binary)}}}))};
      source.connect(processor);processor.connect(ctx.destination);setListening(true);setStatus('live');statusRef.current='live';setSessionNotice(`Live with ${token.model}. Microphone is on; screen sharing is not yet enabled.`);
   }catch(error){stopSession();setStatus('demo');setSessionNotice(error instanceof Error?`Live session could not start: ${error.message} Demo mode is ready.`:'Microphone permission was not granted. Demo mode is ready.')}
   };
    socket.onmessage=(event)=>{try{const packet=JSON.parse(event.data);if(packet.setupComplete)sessionReady.current=true;const content=packet.serverContent;
     if(content?.inputTranscription?.text)setTranscript(prev=>[...prev,{role:'you',text:content.inputTranscription.text}]);
     if(content?.outputTranscription?.text)setTranscript(prev=>[...prev,{role:'kin',text:content.outputTranscription.text}]);
      const parts=content?.modelTurn?.parts??[];for(const part of parts){if(part.inlineData?.data&&!suppressAudio.current){audioQueue.current.push(part.inlineData.data);playNext()}if(part.text)setTranscript(prev=>[...prev,{role:'kin',text:part.text}])}
      const calls=[...(packet.toolCall?.functionCalls??[]),...parts.map((part:any)=>part.functionCall).filter(Boolean)];
      for(const call of calls){const {name,args,id}=call;
       if(name==='highlight_screen_element'){setHighlight(args);socket.send(JSON.stringify({toolResponse:{functionResponses:[{name,id,response:{success:true}}]}}))}
       if(name==='raise_scam_alert'){if(typeof args.x==='number'&&typeof args.y==='number')setHighlight({x:args.x,y:args.y,width:args.width??.2,height:args.height??.08,label:args.title});const record:KinAlert={id:crypto.randomUUID(),createdAt:new Date().toISOString(),severity:String(args.severity).toLowerCase().includes('high')||String(args.severity).toLowerCase()==='critical'?'high':'medium',title:args.title,summary:args.summary,evidence:args.evidence,recommendedAction:args.recommendedAction,screenshotDataUrl:screenImageRef.current||undefined};addAlert(record);socket.send(JSON.stringify({toolResponse:{functionResponses:[{name,id,response:{saved:true}}]}}))}
      }
     if(content?.interrupted){audioQueue.current=[];outputSourceRef.current?.stop();outputSourceRef.current=null;isPlaying.current=false}
   }catch{ /* ignore malformed protocol messages */ }};
    socket.onerror=()=>{setSessionNotice('The live connection failed. Ending the session…')};
   sessionExpiryRef.current=window.setTimeout(()=>{if(socketRef.current===socket){stopSession();setSessionNotice('Your secure live session has expired. Your microphone and screen are off.')}},Math.max(0,Date.parse(token.expiresAt)-Date.now()));
     socket.onclose=(event)=>{if(statusRef.current!=='demo'){const quotaUnavailable=/quota|billing|RESOURCE_EXHAUSTED/i.test(event.reason||'');stopSession();setSessionNotice(quotaUnavailable?'Gemini Live has no available quota for this API key right now. Check its quota and billing; demo mode is still available.':'Live session ended. Your microphone and shared screen are off. You can continue in demo mode.')}};
  }catch(error){setStatus('error');setSessionNotice(error instanceof Error?error.message:'Could not request a live session. You can still try the demos.')}
 };
  const shareScreen=async()=>{try{if(!navigator.mediaDevices?.getDisplayMedia)throw new Error('Screen capture is not supported in this browser.');const stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:1},audio:false});displayStream.current=stream;setSharing(true);setSessionNotice('Screen shared by your choice. It is sent only while this live session runs.');stream.getVideoTracks()[0].addEventListener('ended',()=>{displayStream.current=null;if(screenTimer.current)window.clearInterval(screenTimer.current);setSharing(false);setScreenImage('');screenImageRef.current='';setHighlight(null);setSessionNotice('Screen sharing stopped. Your microphone session can continue.')});const video=document.querySelector<HTMLVideoElement>('#screen-source');if(video){video.srcObject=stream;await video.play().catch(()=>{})}captureFrame();screenTimer.current=window.setInterval(captureFrame,1000)}catch(error){setSessionNotice(error instanceof Error?`${error.message} No screen was shared.`:'Screen permission was not granted. No screen was shared.')}}
  const sendText=(text=draft)=>{const trimmed=text.trim();if(!trimmed)return;suppressAudio.current=false;setTranscript(prev=>[...prev,{role:'you',text:trimmed}]);if(socketRef.current?.readyState===WebSocket.OPEN)socketRef.current.send(JSON.stringify({realtimeInput:{text:trimmed}}));else demoReply(trimmed);setDraft('')};
 const demoReply=(query:string)=>{const lower=query.toLowerCase();const answer=lower.includes('remote')||lower.includes('anydesk')||lower.includes('access app')?'A request to install a remote-access app is a serious warning sign, especially from an unexpected caller. Do not install it or share a code. I can help you check who contacted you.':'Good instinct to pause. Open the official app or website directly rather than following an unexpected link. If you tell me what you see, we can check it together, one step at a time.';window.setTimeout(()=>setTranscript(prev=>[...prev,{role:'kin',text:answer}]),350)};
 const demoScenario=(which:'safe'|'scam')=>{if(which==='safe'){setTranscript([{role:'you',text:'Can you help me check this delivery update?'},{role:'kin',text:'This looks like a standard delivery tracking page. Before entering anything, check that the address bar matches the delivery company’s official website. You can also open their app directly instead.'}]);setHighlight(null);setCurrentAlert(null)}else{const alert:KinAlert={id:crypto.randomUUID(),createdAt:new Date().toISOString(),severity:'high',title:'Remote-access app request',summary:'An unexpected caller is asking you to install a remote-access app and share a connection code.',evidence:'The message mentions installing AnyDesk and reading out a one-time access code to “verify your account.”',recommendedAction:'Do not install the app or share any code. End the call, then contact your bank using the number on your card.',demo:true};setTranscript([{role:'you',text:'Someone on the phone says I need a remote access app to protect my account.'},{role:'kin',text:'Let’s pause. That request is a common way to take control of a device. Do not install it or share a code. You can end the call and contact your bank using the number on your card.'}]);addAlert(alert)}};
  const interrupt=()=>{suppressAudio.current=true;audioQueue.current=[];outputSourceRef.current?.stop();outputSourceRef.current=null;isPlaying.current=false;};
  const shareAlert=async(alert:KinAlert)=>{
   const summary=`Kin safety alert: ${alert.title}\n\n${alert.summary}\n\nEvidence: ${alert.evidence}\n\nSuggested next step: ${alert.recommendedAction}`;
   try{
    const files:File[]=[];
    if(alert.screenshotDataUrl){const blob=await (await fetch(alert.screenshotDataUrl)).blob();files.push(new File([blob],'kin-screen.jpg',{type:'image/jpeg'}))}
    const canShareFiles=files.length>0&&!!navigator.canShare?.({files});
    if(navigator.share&&(!files.length||canShareFiles)){
     await navigator.share({title:'Kin safety alert',text:summary,...(canShareFiles?{files}:{})});
     setMessage('Alert shared.');
    }else{
     const fileUrl=URL.createObjectURL(new Blob([summary],{type:'text/plain'}));const a=document.createElement('a');a.href=fileUrl;a.download='kin-safety-alert.txt';a.click();URL.revokeObjectURL(fileUrl);
     if(alert.screenshotDataUrl){const shot=document.createElement('a');shot.href=alert.screenshotDataUrl;shot.download='kin-shared-screen.jpg';shot.click()}
     const encoded=encodeURIComponent(summary),contact=settings.familyContact;
     if(contact.includes('@'))window.open(`mailto:${encodeURIComponent(contact)}?subject=${encodeURIComponent('Kin safety alert')}&body=${encoded}`,'_blank');
     else window.open(`sms:${encodeURIComponent(contact)}?body=${encoded}`,'_blank');
     setMessage(alert.screenshotDataUrl?'Summary and screenshot downloaded. The draft includes the summary; attach the screenshot before sending.':'Alert summary downloaded and a message draft is ready.');
    }
   }catch{setMessage('Sharing was cancelled or unavailable. You can still copy the alert details.')}
   window.setTimeout(()=>setMessage(''),4500);
  };
 const deleteAlert=(id:string)=>{setAlerts(prev=>prev.filter(item=>item.id!==id));if(currentAlert?.id===id)setCurrentAlert(null)};
 const copyAlert=async(alert:KinAlert)=>{await navigator.clipboard?.writeText(`${alert.title}\n${alert.summary}\nEvidence: ${alert.evidence}\nNext: ${alert.recommendedAction}`);setMessage('Alert details copied.');window.setTimeout(()=>setMessage(''),2500)};
 const headerTitle=path==='/history'?'Alert history':path==='/settings'?'Your preferences':'A calmer way to stay safe online';
 return <div className="kin-shell"><div className="app-layout">
  <aside className="sidebar">
   <Link href="/" className="brand" aria-label="Kin home"><span className="brand-mark"><ShieldCheck size={22}/></span><span>kin<span className="brand-dot">.</span></span></Link>
   <p className="side-caption">FAMILY SAFETY</p>
   <nav aria-label="Main navigation">
    <Link href="/" className={`nav-item ${path==='/'?'selected':''}`} data-testid="link-home"><AudioLines size={18}/> <span>Assistant</span>{path==='/'&&<span className="nav-current">HERE</span>}</Link>
    <Link href="/history" className={`nav-item ${path==='/history'?'selected':''}`} data-testid="link-history"><History size={18}/><span>Alert history</span><span className="nav-count">{alerts.length}</span></Link>
    <Link href="/settings" className={`nav-item ${path==='/settings'?'selected':''}`} data-testid="link-settings"><SettingsIcon size={18}/><span>Preferences</span></Link>
   </nav>
   <div className="side-spacer"/>
   <div className="side-note"><span className="note-icon"><Shield size={17}/></span><div><strong>Your choice, always.</strong><p>Screen sharing is opt-in and only streamed during a live session.</p></div></div>
   <button className="profile-chip" onClick={()=>setPath('/settings')} data-testid="button-open-preferences"><span className="profile-avatar">{settings.familyName.trim().slice(0,1).toUpperCase()||'K'}</span><span><strong>{settings.familyName||'Your family'}</strong><small>Family settings</small></span><ChevronRight size={16}/></button>
  </aside>
  <main className="main-area">
   <header className="topbar"><div className="mobile-brand"><Link href="/" className="brand"><span className="brand-mark"><ShieldCheck size={20}/></span>kin<span className="brand-dot">.</span></Link></div><div className="page-heading"><span className="eyebrow">KIN / {path==='/history'?'YOUR RECORDS':path==='/settings'?'PREFERENCES':'LIVE COMPANION'}</span><h1>{headerTitle}</h1></div><div className="top-actions"><span className={`mode-pill ${status==='live'?'is-live':''}`}><i/>{status==='live'?'LIVE SESSION':status==='connecting'?'CONNECTING':status==='error'?'LIVE UNAVAILABLE':'DEMO MODE'}</span><button aria-label={`Switch to ${settings.theme==='light'?'dark':'light'} theme`} className="theme-toggle" onClick={()=>setSettings(s=>({...s,theme:s.theme==='light'?'dark':'light'}))} data-testid="button-theme-toggle">{settings.theme==='light'?<Moon size={17}/>:<Sun size={17}/>}</button></div></header>
   <div className="content-wrap">
    <Switch>
     <Route path="/">
      <div className="assistant-grid kin-reveal">
       <section className="assistant-main">
        <div className="welcome-row"><div><span className="eyebrow">HERE WHEN YOU NEED A HAND</span><h2 className="welcome-title">Hi {settings.familyName||'there'},<br/><em>let’s take it one step at a time.</em></h2><p className="welcome-copy">Ask about a message, a screen, or something that doesn’t feel right. Kin is here to look with you — never for you.</p></div><div className="orbit-art" aria-hidden="true"><div className="orbit-ring ring-one"/><div className="orbit-ring ring-two"/><div className="orbit-core"><ShieldCheck size={33}/></div><span className="orbit-spark spark-a"/><span className="orbit-spark spark-b"/></div></div>
        {status==='error'&&<div className="inline-alert error"><AlertTriangle size={18}/><span>{sessionNotice}</span><button onClick={()=>{setStatus('demo');setSessionNotice('')}} aria-label="Dismiss connection notice"><X size={16}/></button></div>}
        {status==='demo'&&sessionNotice&&<div className="inline-alert info" role="status"><CircleHelp size={17}/><span>{sessionNotice}</span><button onClick={()=>setSessionNotice('')} aria-label="Dismiss session notice"><X size={16}/></button></div>}
        {status==='live'&&<div className="live-banner"><span className="live-pulse"/><span><strong>Live session is on</strong><small>Mic {listening?'active':'off'} · Screen {sharing?'shared':'not shared'}</small></span><button className="text-action" onClick={stopSession} data-testid="button-stop-session">End session</button></div>}
        <section className="conversation-panel kin-card" aria-label="Kin conversation">
         {transcript.length===0?<div className="conversation-empty"><span className="empty-icon"><AudioLines size={22}/></span><p><strong>Your conversation starts here.</strong><br/>Try a quick scenario, or ask Kin a question below.</p></div>:<div className="transcript" aria-live="polite">{transcript.map((line,index)=><div className={`turn ${line.role}`} key={`${index}-${line.role}`}><span className="turn-label">{line.role==='you'?'YOU':'KIN'}</span><p>{line.text}</p></div>)}</div>}
         <form className="message-form" onSubmit={e=>{e.preventDefault();sendText()}}><label htmlFor="message-input" className="sr-only">Ask Kin a question</label><input id="message-input" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Ask Kin anything… (text works without a mic)" data-testid="input-message"/><button type="submit" className="send-button" aria-label="Send message" data-testid="button-send-message"><Send size={17}/></button></form>
         <div className="conversation-tools"><span><CircleHelp size={14}/> You’re in control. Ask, pause, or stop anytime.</span><div>{status==='live'&&<button className="tool-button" onClick={interrupt} data-testid="button-interrupt"><Pause size={14}/> Interrupt audio</button>}{status==='live'&&!sharing&&<button className="tool-button" onClick={shareScreen} data-testid="button-share-screen"><MonitorUp size={14}/> Share screen</button>}</div></div>
        </section>
         {screenImage&&<section className="screen-preview kin-card"><div className="preview-head"><span><Eye size={16}/> Shared screen preview</span><button onClick={()=>{displayStream.current?.getTracks().forEach(t=>t.stop());setSharing(false);setScreenImage('');setHighlight(null)}} className="text-action"><X size={15}/> Stop sharing</button></div><div className="screen-image-wrap"><img src={screenImage} alt="Latest frame from the screen you chose to share"/>{highlight&&<div className="screen-highlight" style={{left:`${highlight.x*100}%`,top:`${highlight.y*100}%`,width:`${highlight.width*100}%`,height:`${highlight.height*100}%`}}><span>{highlight.label}</span></div>}</div><p className="privacy-caption">Frames are sent to Gemini only during this live session. A screenshot is saved locally only if an alert includes it.</p><video id="screen-source" className="sr-only" muted playsInline/></section>}
        <section className="scenario-section"><div className="section-intro"><span className="eyebrow">TRY A PRACTICE ROUND</span><h3>Explore a scenario</h3><p>Practice scenarios are examples only — they are not AI detections.</p></div><div className="scenario-row"><button className="scenario-button safe-scenario" onClick={()=>demoScenario('safe')} data-testid="button-demo-safe"><span className="scenario-symbol"><ShieldCheck size={19}/></span><span><strong>A delivery update</strong><small>Check a familiar-looking link</small></span><ChevronRight size={17}/></button><button className="scenario-button risk-scenario" onClick={()=>demoScenario('scam')} data-testid="button-demo-scam"><span className="scenario-symbol"><AlertTriangle size={19}/></span><span><strong>A remote-access request</strong><small>Practice spotting pressure tactics</small></span><ChevronRight size={17}/></button></div></section>
       </section>
       <aside className="assistant-rail">
         <section className="session-card kin-card"><div className="rail-card-top"><span className="eyebrow">VOICE-LED GUIDANCE</span><span className={`session-indicator ${status==='live'?'active':''}`}><i/>{status==='live'?'LIVE':'READY'}</span></div><div className="mic-visual"><div className={`mic-orbit ${status==='live'?'listening':''}`}><span className="mic-halo"/><button className="mic-button" aria-label={status==='live'?'End live session':'Start a live voice session'} onClick={status==='live'?stopSession:startSession} data-testid="button-live-session">{status==='live'?<MicOff size={23}/>:<Mic size={23}/>}</button></div></div><h3>{status==='live'?'I’m listening.':'Talk it through.'}</h3><p>{status==='live'?'Speak naturally. You can interrupt me at any time.':'Mic audio is sent to Gemini only after permission. Text is always available.'}</p><button className={`kin-button start-live ${status==='live'?'stop-live':''}`} onClick={status==='live'?stopSession:startSession} disabled={status==='connecting'} data-testid="button-start-live">{status==='connecting'?'Connecting securely…':status==='live'?<><X size={16}/> End live session</>:<><Radio size={16}/> Start live session</>}</button>{mutation.isError&&<p role="alert" className="token-error">Could not get a live token. Check your connection or continue with demo mode.</p>}<div className="session-meta"><span><span className="meta-dot"/>{status==='live'?'Encrypted live link':'No connection yet'}</span><span>Voice, your pace</span></div></section>
         <section className="privacy-card"><span className="privacy-symbol"><Eye size={17}/></span><div><strong>Screen stays yours</strong><p>Kin can only see a screen you explicitly share. One frame per second is sent to Gemini until you stop or end the live session.</p><span className="privacy-tag">NEVER ON BY DEFAULT</span></div></section>
        <section className="recent-card"><div className="rail-section-heading"><span className="eyebrow">RECENT ALERTS</span><Link href="/history">See all <ChevronRight size={14}/></Link></div>{alerts.length?<div className="mini-alert-list">{alerts.slice(0,2).map(a=><button key={a.id} className="mini-alert" onClick={()=>setCurrentAlert(a)}><span className={`severity-mark ${a.severity}`}/><span><strong>{a.title}</strong><small>{new Date(a.createdAt).toLocaleDateString()}</small></span><ChevronRight size={15}/></button>)}</div>:<div className="mini-empty"><span className="empty-check"><Check size={14}/></span><span><strong>All quiet here.</strong><small>Alerts you save will show up here.</small></span></div>}</section>
        <div className="language-hint"><Languages size={15}/><span>Speaking <strong>{languages.find(x=>x[0]===settings.preferredLanguage)?.[1]||'English'}</strong></span><Link href="/settings">Change</Link></div>
       </aside>
      </div>
     </Route>
     <Route path="/history">
      <section className="history-page kin-reveal"><div className="history-intro"><div><span className="eyebrow">A RECORD YOU CONTROL</span><h2>Saved safety moments</h2><p>Alerts stay on this device. Share only what you choose.</p></div><span className="history-count"><strong>{alerts.length.toString().padStart(2,'0')}</strong><small>SAVED</small></span></div>
       {message&&<div className="inline-alert success" role="status"><Check size={17}/>{message}</div>}
       {!alerts.length?<div className="history-empty kin-card"><div className="empty-illustration"><History size={27}/><span><Check size={14}/></span></div><h3>No saved alerts yet</h3><p>When Kin spots a concern in a live session — or you try the remote-access practice — it will be saved here for you.</p><Link href="/" className="kin-button history-cta">Back to assistant <ChevronRight size={16}/></Link></div>:<div className="alert-list">{alerts.map(alert=><article className="alert-card kin-card" key={alert.id} data-testid={`card-alert-${alert.id}`}><div className="alert-card-top"><span className={`severity-chip ${alert.severity}`}><i/>{alert.severity==='high'?'Take care':alert.severity==='medium'?'Worth a pause':'Information'}</span><span className="alert-time"><Clock3 size={14}/>{new Date(alert.createdAt).toLocaleString()}</span></div>{alert.demo&&<div className="demo-stamp">PRACTICE SCENARIO · NOT A REAL AI DETECTION</div>}<button className="alert-title-button" onClick={()=>setExpandedAlert(expandedAlert===alert.id?null:alert.id)} aria-expanded={expandedAlert===alert.id}><h3>{alert.title}</h3><ChevronRight className={expandedAlert===alert.id?'rotate':''} size={19}/></button><p className="alert-summary">{alert.summary}</p>{expandedAlert===alert.id&&<div className="alert-details kin-reveal"><div><strong>What we noticed</strong><p>{alert.evidence}</p></div><div className="next-step"><strong>A good next step</strong><p>{alert.recommendedAction}</p></div>{alert.screenshotDataUrl&&<img className="alert-screenshot" src={alert.screenshotDataUrl} alt="Screen snapshot saved with this alert"/>}</div>}<div className="alert-actions"><button onClick={()=>shareAlert(alert)} data-testid={`button-share-alert-${alert.id}`}><Send size={15}/> Share with family</button><button onClick={()=>copyAlert(alert)} data-testid={`button-copy-alert-${alert.id}`}><Copy size={15}/> Copy details</button><button className="delete-action" onClick={()=>deleteAlert(alert.id)} aria-label={`Delete ${alert.title}`} data-testid={`button-delete-alert-${alert.id}`}><Trash2 size={15}/> Delete</button></div></article>)}</div>}
       <div className="history-footnote"><Shield size={15}/> Alert history is saved locally in this browser, not uploaded to Kin.</div>
      </section>
     </Route>
     <Route path="/settings">
      <SettingsPage settings={settings} setSettings={setSettings} alerts={alerts} setAlerts={setAlerts}/>
     </Route>
     <Route component={NotFound}/>
    </Switch>
   </div>
   <footer className="site-footer"><span>Kin is a guide, not a substitute for your judgment.</span><span>Private by design <span className="footer-dot">·</span> Made for families</span></footer>
   <nav className="mobile-nav" aria-label="Mobile navigation"><Link href="/" className={path==='/'?'active':''} data-testid="mobile-link-home"><AudioLines size={18}/><span>Assistant</span></Link><Link href="/history" className={path==='/history'?'active':''} data-testid="mobile-link-history"><History size={18}/><span>History</span></Link><Link href="/settings" className={path==='/settings'?'active':''} data-testid="mobile-link-settings"><SettingsIcon size={18}/><span>Settings</span></Link></nav>
  </main>
 </div>
 {currentAlert&&<div className="dialog-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setCurrentAlert(null)}}><section className="alert-dialog kin-card" role="dialog" aria-modal="true" aria-labelledby="alert-dialog-title"><button className="dialog-close" onClick={()=>setCurrentAlert(null)} aria-label="Close alert"><X size={18}/></button><span className={`severity-chip ${currentAlert.severity}`}><i/>{currentAlert.demo?'Practice scenario':'Saved alert'}</span><h2 id="alert-dialog-title">{currentAlert.title}</h2><p>{currentAlert.summary}</p><div className="dialog-evidence"><strong>What we noticed</strong><p>{currentAlert.evidence}</p><strong>A good next step</strong><p>{currentAlert.recommendedAction}</p></div>{currentAlert.screenshotDataUrl&&<img src={currentAlert.screenshotDataUrl} alt="Shared-screen snapshot related to this alert" className="alert-screenshot"/>}<div className="dialog-actions"><button className="kin-button start-live" onClick={()=>shareAlert(currentAlert)}><Send size={16}/> Share with family</button><button className="secondary-button" onClick={()=>copyAlert(currentAlert)}><Copy size={16}/> Copy summary</button></div></section></div>}
 <audio ref={audioElement} className="sr-only"/>{message&&path==='/'&&<div className="toast-message" role="status">{message}<button onClick={()=>setMessage('')} aria-label="Dismiss"><X size={14}/></button></div>}
 </div>
}

function SettingsPage({settings,setSettings,alerts,setAlerts}:{settings:KinSettings;setSettings:(updater:(s:KinSettings)=>KinSettings)=>void;alerts:KinAlert[];setAlerts:(updater:(a:KinAlert[])=>KinAlert[])=>void}){
 const [confirmClear,setConfirmClear]=useState(false),[saved,setSaved]=useState(false);
 const update=(key:keyof KinSettings,value:string)=>{setSettings(s=>({...s,[key]:value} as KinSettings));setSaved(true);window.setTimeout(()=>setSaved(false),1800)};
 return <section className="settings-page kin-reveal"><div className="settings-intro"><span className="eyebrow">MAKE KIN YOURS</span><h2>Preferences</h2><p>Small choices that make support feel like yours.</p></div>
  {saved&&<div className="inline-alert success" role="status"><Check size={16}/> Preferences saved on this device.</div>}
  <div className="settings-layout">
   <div className="settings-main">
    <section className="setting-group kin-card"><div className="setting-heading"><span className="setting-icon"><Languages size={18}/></span><div><h3>Language</h3><p>Choose the language Kin should speak with you.</p></div></div><label htmlFor="language-select">Preferred language</label><select id="language-select" className="setting-input" value={settings.preferredLanguage} onChange={e=>update('preferredLanguage',e.target.value)} data-testid="select-language">{languages.map(([code,label])=><option key={code} value={code}>{label}</option>)}</select><small className="field-hint">Auto-detect lets Kin follow the language you use in conversation.</small></section>
    <section className="setting-group kin-card"><div className="setting-heading"><span className="setting-icon"><ShieldCheck size={18}/></span><div><h3>Your family</h3><p>Personalize the greeting and choose who an alert can be drafted for.</p></div></div><label htmlFor="family-name">Name to greet you by</label><input id="family-name" className="setting-input" maxLength={40} value={settings.familyName} onChange={e=>update('familyName',e.target.value)} placeholder="Your name" data-testid="input-family-name"/><label htmlFor="family-contact">Family contact <span className="optional-label">OPTIONAL</span></label><input id="family-contact" className="setting-input" value={settings.familyContact} onChange={e=>update('familyContact',e.target.value)} placeholder="Phone number or email" data-testid="input-family-contact"/><small className="field-hint">Used only to prefill a message draft when you choose to share an alert. Never contacted automatically.</small></section>
    <section className="setting-group kin-card"><div className="setting-heading"><span className="setting-icon"><Sun size={18}/></span><div><h3>Appearance</h3><p>Choose the version that feels comfortable on your eyes.</p></div></div><div className="theme-options" role="group" aria-label="Appearance theme"><button className={`theme-option ${settings.theme==='light'?'chosen':''}`} onClick={()=>update('theme','light')} aria-pressed={settings.theme==='light'} data-testid="button-theme-light"><Sun size={20}/><span>Light</span>{settings.theme==='light'&&<Check size={16}/>}</button><button className={`theme-option ${settings.theme==='dark'?'chosen':''}`} onClick={()=>update('theme','dark')} aria-pressed={settings.theme==='dark'} data-testid="button-theme-dark"><MoonStar size={20}/><span>Dark</span>{settings.theme==='dark'&&<Check size={16}/>}</button></div></section>
   </div>
   <aside className="settings-aside"><section className="privacy-settings kin-card"><span className="privacy-symbol"><Shield size={18}/></span><span className="eyebrow">YOUR PRIVACY</span><h3>Nothing happens without you.</h3><ul><li><Check size={15}/> Mic permission is asked only when you start live.</li><li><Check size={15}/> Screen sharing is opt-in and streams only while live.</li><li><Check size={15}/> Saved alerts stay in this browser.</li><li><Check size={15}/> Sharing always needs your confirmation.</li></ul><p>To revoke browser permissions, use your browser’s site settings.</p></section><section className="data-settings kin-card"><h3>Your saved alerts</h3><p>{alerts.length?`${alerts.length} ${alerts.length===1?'alert':'alerts'} stored on this device.`:'No alerts stored on this device.'}</p>{!confirmClear?<button className="clear-button" onClick={()=>setConfirmClear(true)} disabled={!alerts.length} data-testid="button-clear-alerts"><Trash2 size={15}/> Clear alert history</button>:<div className="confirm-clear"><p>Delete all saved alerts from this browser?</p><button className="clear-confirm" onClick={()=>{setAlerts(()=>[]);setConfirmClear(false)}} data-testid="button-confirm-clear">Delete all</button><button onClick={()=>setConfirmClear(false)} className="cancel-clear">Keep alerts</button></div>}</section></aside>
  </div><div className="settings-back"><Link href="/"><ArrowLeft size={15}/> Back to assistant</Link></div>
 </section>
}

function App(){
 const queryClient=new QueryClient();
 return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/,'')}><ErrorBoundary><AppShell/></ErrorBoundary></WouterRouter><Toaster/></TooltipProvider></QueryClientProvider>;
}
export default App;
