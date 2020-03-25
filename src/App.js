import React,{useRef,useState,useEffect} from 'react';
import './App.css';
import Tone from 'tone';
import ear from './images/ear.svg';
import firebase from 'firebase/app';
import 'firebase/analytics';
import firebaseConfig from './firebaseConfig/firebaseConfig';


firebase.initializeApp(firebaseConfig);

let isMobile = window.innerWidth<769;

const ease =t => t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1;

const resumeAudio =()=>{
  if (Tone.context.state !== 'running') {
    Tone.context.resume();
    if(Tone.context.state === 'interrupted'){
      window.location.reload();
    }
  }
}


let timer;

var waveform = new Tone.Analyser('waveform',512);
var feedbackDelay = new Tone.FeedbackDelay(20, 1).connect(waveform).toMaster();
let panner = new Tone.Panner(0.5).connect(feedbackDelay);
let pitchShifter = new Tone.PitchShift().connect(panner);
feedbackDelay.delayTime.maxDelay = 40;
feedbackDelay.delayTime.value = 10;



let mic;
let canvasCtx;



function App() {
  const canvas = useRef(null);
  // eslint-disable-next-line
  const [isExternal,setIsExternal] = useState(false);
  const [micAccess,setMicAccess] = useState(false);
  const [isListening,setIsListening] = useState(false);
  const [pan,setPan] = useState(0.5);
  const [length,setLength] = useState(10);
  const [resetPressed,setResetPressed] = useState(false);
  const [pitchShifterState,setPitchShifterState] = useState('OFF');
  const [pitchAmount,setPitchAmount] = useState('LOW');
  

  

  useEffect(()=>{
    feedbackDelay.delayTime.maxDelay = 20;
    feedbackDelay.delayTime.value = length;
  },[length]);


  const checkHeadphones=()=>{
    Tone.UserMedia.enumerateDevices().then(function(devices){      
      if(devices[0].label.search('External')>-1){
        setIsExternal(true);
      }else{
        setIsExternal(false);
      }
    });
  }

  const onTouch=()=>{
    mic.mute = false;
    setIsListening(true);
    Tone.Master.mute=true;  
    document.getElementById('pan').value = 50;
    setPan(0.5);
    panner.pan.value = 0.5;  
    timer = Date.now();
  }
  const onRelease=()=>{
    mic.mute = true;
    setIsListening(false);
    Tone.Master.mute=false;
    firebase.analytics().logEvent('pressed for',{timer: ((Date.now()-timer)/1000).toFixed(1)});
    console.log();
    
  }

  useEffect(()=>{
    mic = new Tone.UserMedia().fan(pitchShifter,waveform);
    mic.open().then(function(){
      //promise resolves when input is available
      mic.mute = true;
      setMicAccess(true);
    });
    
    setTimeout(()=>{
      handleReset();
      feedbackDelay.delayTime.value = 4;
      setLength(4);
      setResetPressed(false);
    },1000);
    canvasCtx = canvas.current.getContext("2d");  
    checkHeadphones();
    navigator.mediaDevices.addEventListener('devicechange', () => {
      checkHeadphones();
    });
    setInterval(()=>{
      draw();
    },40);
    resumeAudio();
    let slider = document.getElementsByClassName('slider')[0];
    slider.ontouchstart = (e)=>{
      Tone.Master.mute = true;
    };
    slider.ontouchend = (e)=>{
      Tone.Master.mute = false;
    };

    

    window.addEventListener('mousemove',onMouseMove);
    document.addEventListener('gesturestart', (e)=>preventZoom(e));
    document.addEventListener('gesturechange', (e)=>preventZoom(e));
    document.addEventListener('gestureend', (e)=>preventZoom(e));
    document.addEventListener('keydown',handleKeyDown);
    document.addEventListener('keyup',handleKeyUp);
    return ()=>{
      window.removeEventListener('mousemove',onMouseMove);
      document.removeEventListener('gestureend',(e)=>preventZoom(e));
      document.removeEventListener('gesturechange', (e)=>preventZoom(e));
      document.removeEventListener('gestureend', (e)=>preventZoom(e));
      document.removeEventListener('keydown',handleKeyDown);
      document.removeEventListener('keyup',handleKeyUp);
    }

    // eslint-disable-next-line
  },[]);

  const onMove=(e)=>{
    let x= e.touches[0].clientX;
    x = (x)/(window.innerWidth);
    x = ease(x);
    document.getElementById('pan').value = x*100;
    setPan(x);
    panner.pan.value = x*2 - 1;
  }

  const onMouseMove=(e)=>{
    let x= e.clientX;    
    x = (x)/(window.innerWidth);
    x = ease(x);
    document.getElementById('pan').value = x*100;
    setPan(x);
    panner.pan.value = x*2 - 1;
  }


  const handleReset=()=>{
    setResetPressed(true);
    feedbackDelay.dispose();
    feedbackDelay = new Tone.FeedbackDelay(20, 1).connect(waveform).toMaster();
    feedbackDelay.delayTime.maxDelay = 20;
    feedbackDelay.delayTime.value = length;
    setLength(length);
    panner.connect(feedbackDelay);
    firebase.analytics().logEvent('pressed reset');
  }

  const preventZoom =e=>{
    e.preventDefault();
    document.body.style.zoom = 0.999999;
  }


  

  function draw() {
    // requestAnimationFrame(draw);
    let width = canvasCtx.canvas.width;
    let height = canvasCtx.canvas.height;
    var waveArray = waveform.getValue();
    canvasCtx.strokeStyle = "white";

    canvasCtx.lineWidth = 5;
    canvasCtx.clearRect(0, 0, width, height);
    canvasCtx.beginPath();
    canvasCtx.moveTo(0,height/2);

    for (var i = 0; i <= waveArray.length; i++) {
      let x= (i/waveArray.length)*(width + 30);
      canvasCtx.lineTo(x, height/2+waveArray[i]*128);
    }
    canvasCtx.stroke();
  }

  const handleEffectChange=(id)=>{
    let state = document.getElementById(id).checked;
    
    switch (id){
      case 'pitch-amount':    
        if(state){
          setPitchAmount('HIGH');
          pitchShifter.pitch = 5;
          firebase.analytics().logEvent('effect high');
        } else {
          setPitchAmount('LOW');
          pitchShifter.pitch = -5;
          firebase.analytics().logEvent('effect low');
        }
        
        break;
      default:
        if(state){
          setPitchShifterState('ON');
          pitchShifter.wet.value = 1;
          firebase.analytics().logEvent('effect on');
        } else {
          setPitchShifterState('OFF');
          pitchShifter.wet.value = 0;
          firebase.analytics().logEvent('effect off');
        }
        break;
    }
    
  }


  const handleKeyDown=e=>{  
    if(e.key===' '&&!e.repeat){
      onTouch();
      firebase.analytics().logEvent('used spacebar');
    }  
  }

  const handleKeyUp=e=>{
    if(e.key===' '){
      onRelease()
    }    
  }
  
  return (
    <div className="App" onMouseUp={isMobile?null:onRelease} onClick={resumeAudio} >
      <div style={{position:'absolute',left:10,top:10,width:'90vw'}}>
        <p style={{fontSize:'3vmin',textAlign:'left'}}>{micAccess?'Microphone enabled!':`Microphone is not enabled! Try to refresh the page`}</p>
        
      </div>
      <div style={{position:'absolute',right:20,top:10,width:'90vw'}}>
        <p style={{fontSize:'2vmin',textAlign:'right'}}>by <a style={{color:'white'}} href='http://omrinuri.com'>omrinuri</a></p>
      </div>
      <div className='mute-spacer'/>
      
      <div style={{display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',backgroundColor:'black',borderRadius:'20px',top:200,width:isMobile?'70vw':'50vw',margin:'0 10vmin',height:'8vh'}}>
        <canvas ref={canvas}  style={{width:'100%',height:'100%'}} width={1000*2} height={90*2} id='oscilloscope'/>
      </div>
      <h4 style={{marginTop:'5vmin'}}>{isListening?'Listening...':'Press to record/overdub'}</h4>
      <div className='overdub-container'>
        <div className="slidecontainer2">        
          <input style={{opacity:isListening?1:0}}   type="range" min="1" max="100" defaultValue="50" className="slider2" id="pan"/>
        </div>
        <div style={{opacity:isListening?1:0}} className='row ears'>
          <img  className='leftear'  src={ear}  width={(1-pan)*30+20} alt="leftear"/>
          <div className='spacer'/>
          <img className='rightear' src={ear} width={pan*30+20} alt="rightear"/>
        </div>
        <div  className={`overdub-button ${isListening?'pressed':null}`}
        onTouchStart={isMobile?onTouch:null}
        onTouchEnd={isMobile?onRelease:null}
        onTouchMove={isMobile?onMove:null}
        onMouseDown={isMobile?null:onTouch}
        
        style={{backgroundColor:isListening?'gray':'#e84545'}}/>
        <div  className='overdub-reset column center'
        onTouchStart={isMobile?handleReset:null}
        onMouseDown={isMobile?null:handleReset}
        onTouchEnd={e=>isMobile?setResetPressed(false):null}
        onMouseUp={e=>isMobile?null:setResetPressed(false)}
        style={{backgroundColor:resetPressed?'gray':'rgb(86, 96, 146)'}}>RESET</div>
      </div>
      <div className='column center' style={{width:isMobile?'100vw':'80vw',backgroundColor: isMobile?null:'#53354a',borderRadius:10,marginTop:isMobile?null:'5vmin'}}> 
          <div className='column center' style={{backgroundColor:'#53354a',borderRadius:'10px',padding:'5vmin',width: isMobile?'60vw':'30vw',marginTop:isMobile?'5vmin':null,height:'8vmin'}}>
            <div className="slidecontainer">        
              <input onChange={e=>setLength(document.getElementById('time').value/100*8)} type="range" min="1" max="100" defaultValue="4" className="slider" id="time"/>  
            </div>
            <p style={{marginTop:'1vmin'}}>{length.toFixed(1)} seconds</p>
          </div>
          {isMobile?null:<div style={{backgroundColor:'black',width:2,height:'90%'}}/>}
          <div className='column center' style={{backgroundColor:'#53354a',borderRadius:'10px',padding:'5vmin',width:isMobile?'60vw':'30vw',marginTop:isMobile?'5vmin':0}}>
            <div className='row center' style={{marginBottom: isMobile?'5vmin':0,width:'50vw'}}>
              <h3 style={{marginRight:"5vmin"}}>EFFECT</h3>
              <label className="switch">
                <input id='pitch-state' onChange={e=>handleEffectChange('pitch-state')} type="checkbox"/>
                <span className="slider-switch round"></span>
              </label>
              <h5 className='effect-state'>{pitchShifterState}</h5>
            </div>
            <div className='row center' style={{opacity:pitchShifterState==='ON'?1:0.4}}>
              <label className="switch">
                <input id='pitch-amount' onChange={e=>handleEffectChange('pitch-amount')} type="checkbox"/>
                <span className="slider-switch round"></span>
              </label>
              <h5 className='effect-state'>{pitchAmount}</h5>
            </div>
          </div>
        </div>   
    </div>
  );
}

export default App;
