'use strict';
(() => {
  document.getElementById('year').textContent = new Date().getFullYear();
  const domains = {
    ai: { labels: ['LangGraph', 'MCP', 'RAG & memory'], description: 'Agents, retrieval, memory, and tools. Connected with intent.', channel: 0 },
    frontend: { labels: ['React & Next.js', 'TypeScript', 'Microfrontends'], description: 'Thoughtful interfaces. Scalable architecture. Human experience.', channel: 1 },
    cloud: { labels: ['AWS', 'Kubernetes', 'FastAPI'], description: 'Cloud architecture, observable services, and reliable delivery.', channel: 2 }
  };
  const scene = document.getElementById('scene');
  const canvas = document.getElementById('circuit-canvas');
  const ctx = canvas.getContext('2d');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const motion = document.getElementById('motion');
  let domain = domains.ai;
  let paused = reducedMotion.matches;
  let width = innerWidth, height = innerHeight, dpr = 1;
  let frame = 0, lastTime = 0, elapsed = 0, lastPaint = 0;
  let scrollPosition = scrollY;
  let anchor = { x: width * .75, y: height * .5 };
  let pointer = { x: 0, y: 0 }, tilt = { x: 0, y: 0 };
  let manual = { x: 0, y: 0 }, drag = null;
  let burst = 0;
  const TAU = Math.PI * 2;
  const traces = [];
  const components = [];
  const channelStrength = [1, .22, .22];
  // The board is built from routed 45-degree traces, vias, ICs and pins.
  // Its coordinates are projected in 3D; it is not a repeating background image.
  for (let side = 0; side < 4; side++) {
    for (let lane = 0; lane < 9; lane++) {
      const offset = (lane - 4) * .27;
      const reach = 3.5 + ((lane * 7 + side * 3) % 9) * .72;
      const bend = ((lane + side) % 2 ? 1 : -1) * (.55 + lane * .11);
      const points = [[offset, -1.56, .045], [offset, -2.0 - (lane % 3) * .17, .045], [offset + bend, -2.65 - (lane % 3) * .17, .045], [offset + bend, -reach, .045]];
      if (lane % 2 === 0) points.push([offset + bend + (lane % 3 - 1) * .65, -reach - .65, .045]);
      const angle = side * Math.PI / 2;
      const route = points.map(([x, y, z]) => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle), z]);
      const lengths = [0];
      for (let i = 1; i < route.length; i++) lengths.push(lengths[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
      traces.push({ points: route, lengths, length: lengths.at(-1), channel: (lane + side) % 3, phase: (lane * .127 + side * .19) % 1, speed: .045 + (lane % 3) * .009 });
    }
  }
  // Satellite hardware extends past the hero into the surrounding circuit field.
  components.push({ x: -4.05, y: -3.3, w: 1.22, h: .78, z: .14, type: 'ic' });
  components.push({ x: 3.8, y: 2.5, w: .9, h: 1.5, z: .16, type: 'ic' });
  components.push({ x: -5.7, y: 2.1, w: .7, h: .42, z: .16, type: 'resistor' });
  components.push({ x: 2.4, y: -4.35, w: .55, h: .55, z: .5, type: 'capacitor' });
  components.push({ x: 3.2, y: -4.35, w: .55, h: .55, z: .5, type: 'capacitor' });
  components.push({ x: -2.6, y: 4.6, w: 1.5, h: .6, z: .12, type: 'ic' });

  let camera;
  function setCamera() {
    const mobile = width < 761;
    const scale = mobile ? Math.min(width * .245, 110) : Math.min(width * .10, height * .19, 155);
    camera = {
      scale,
      x: anchor.x + tilt.x * (mobile ? 4 : 17) + Math.min(1, scrollPosition / Math.max(height, 1)) * width * (mobile ? .30 : .16),
      y: Math.max(height * .28, anchor.y - scrollPosition * .82) + tilt.y * 10,
      angle: -.32 + tilt.x * .075 + manual.x,
      pitch: .84 + tilt.y * .07 + manual.y,
      depth: 12,
      opacity: 1 - Math.min(1, scrollPosition / Math.max(height, 1)) * .66
    };
  }
  function project([x, y, z = 0]) {
    const ca = Math.cos(camera.angle), sa = Math.sin(camera.angle);
    const rx = x * ca - y * sa, ry = x * sa + y * ca;
    const py = ry * Math.cos(camera.pitch) - z * Math.sin(camera.pitch);
    const depth = ry * Math.sin(camera.pitch) + z * Math.cos(camera.pitch);
    const perspective = camera.depth / (camera.depth + depth);
    return { x: camera.x + rx * camera.scale * perspective, y: camera.y + py * camera.scale * perspective, scale: perspective };
  }
  function line(points, color, lineWidth = 1, glow = 0) {
    ctx.beginPath();
    points.forEach((point, i) => {
      const p = project(point);
      if (!i) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth;
    ctx.shadowColor = color; ctx.shadowBlur = glow;
    ctx.stroke(); ctx.shadowBlur = 0;
  }
  function polygon(points, fill, stroke = null, lineWidth = 1) {
    ctx.beginPath();
    points.forEach((point, i) => {
      const p = project(point);
      if (!i) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }
  function rect(x, y, w, h, z, fill, stroke) {
    polygon([[x-w/2,y-h/2,z],[x+w/2,y-h/2,z],[x+w/2,y+h/2,z],[x-w/2,y+h/2,z]],fill,stroke);
  }
  function box(x, y, w, h, bottom, top, face = '#0b2d50', edge = '#2b76a6') {
    const a = x-w/2, b = x+w/2, c = y-h/2, d = y+h/2;
    polygon([[a,d,bottom],[b,d,bottom],[b,d,top],[a,d,top]], '#061426', '#133d60');
    polygon([[b,c,bottom],[b,d,bottom],[b,d,top],[b,c,top]], '#09203b', '#1a4e76');
    polygon([[a,c,bottom],[a,d,bottom],[a,d,top],[a,c,top]], '#06182b', '#17415e');
    rect(x,y,w,h,top,face,edge);
  }
  function ring(x, y, z, radius, color, lineWidth = 1) {
    const points = [];
    for (let i = 0; i <= 32; i++) {
      const t = i/32*TAU;
      points.push([x+Math.cos(t)*radius,y+Math.sin(t)*radius,z]);
    }
    line(points,color,lineWidth);
  }
  function glow(point, radius, strength = 1) {
    const p = project(point), r = radius * p.scale;
    const gradient = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);
    gradient.addColorStop(0,`rgba(205,246,255,${.95*strength})`);
    gradient.addColorStop(.16,`rgba(62,205,255,${.65*strength})`);
    gradient.addColorStop(1,'rgba(10,122,255,0)');
    ctx.fillStyle=gradient; ctx.beginPath();ctx.arc(p.x,p.y,r,0,TAU);ctx.fill();
  }
  function pointOnRoute(trace, progress) {
    const distance = trace.length * progress;
    for (let i=1;i<trace.points.length;i++) {
      if (trace.lengths[i] >= distance) {
        const amount=(distance-trace.lengths[i-1])/(trace.lengths[i]-trace.lengths[i-1]);
        return trace.points[i-1].map((value,j)=>value+(trace.points[i][j]-value)*amount);
      }
    }
    return trace.points.at(-1);
  }
  function drawTrace(trace) {
    const strength = channelStrength[trace.channel];
    line(trace.points, `rgba(25,93,151,${.33+strength*.25})`, 4.0);
    line(trace.points, `rgba(46,153,228,${.20+strength*.41})`, .9);
    const end=trace.points.at(-1);
    ring(end[0],end[1],end[2],.055,`rgba(102,199,255,${.35+strength*.4})`,1.05);
    // A second via at the bend makes the routing look manufactured.
    const bend=trace.points[2];
    ring(bend[0],bend[1],bend[2],.028,'rgba(66,144,194,.52)',.7);
    const travel = (elapsed*trace.speed + trace.phase + burst*.22) % 1;
    if (strength > .24) {
      const tail = pointOnRoute(trace,Math.max(0,travel-.08));
      const head = pointOnRoute(trace,travel);
      line([tail,head],`rgba(92,219,255,${strength*.86})`,1.6,8);
      glow(head,8,strength*.85);
    }
  }
  function drawSatellite(component) {
    const {x,y,w,h,z,type}=component;
    if (type==='capacitor') {
      const segments=20;
      for (let i=0;i<segments;i++) {
        const a=i/segments*TAU,b=(i+1)/segments*TAU;
        polygon([[x+Math.cos(a)*w/2,y+Math.sin(a)*h/2,.03],[x+Math.cos(b)*w/2,y+Math.sin(b)*h/2,.03],[x+Math.cos(b)*w/2,y+Math.sin(b)*h/2,z],[x+Math.cos(a)*w/2,y+Math.sin(a)*h/2,z]],i<10?'#0b2d4d':'#071b31');
      }
      const points=Array.from({length:33},(_,i)=>[x+Math.cos(i/32*TAU)*w/2,y+Math.sin(i/32*TAU)*h/2,z]);
      polygon(points,'#164667','#3789b3');
      line([[x-.13,y,z+.01],[x+.13,y,z+.01]],'#7bdcff',1.5);
      line([[x,y-.13,z+.01],[x,y+.13,z+.01]],'#7bdcff',1.5);
      return;
    }
    box(x,y,w,h,0,z,type==='resistor'?'#0f3950':'#0a213c','#225c83');
    for(let i=-2;i<=2;i++) {
      const px=x+i*w/6;
      rect(px,y-h/2-.08,.065,.15,.04,'#2e6181','#487e9d');
      rect(px,y+h/2+.08,.065,.15,.04,'#2e6181','#487e9d');
    }
    line([[x-w*.28,y,z+.01],[x+w*.28,y,z+.01]],'#326e94',.8);
    if(type==='ic') for(let i=0;i<3;i++) rect(x-.25+i*.25,y-.12,.11,.055,z+.01,'#3376a4');
  }
  function drawProcessor() {
    const floating=.62 + Math.sin(elapsed*.8)*.035;
    // Grounded socket, bright plated pins, ceramic package and raised glass die.
    box(0,0,3.18,3.18,-.11,.025,'#081b30','#1a4b74');
    for(let side=0;side<4;side++) {
      const angle=side*Math.PI/2;
      for(let pin=-4;pin<=4;pin++) {
        const x=pin*.27,y=1.48;
        const px=x*Math.cos(angle)-y*Math.sin(angle),py=x*Math.sin(angle)+y*Math.cos(angle);
        rect(px,py,side%2?.36:.10,side%2?.10:.36,.09,'#4b86a7','#9bdbef');
      }
    }
    box(0,0,2.8,2.8,.04,.22,'#0d2a4b','#3475a6');
    rect(0,0,2.55,2.55,.225,'#09233f','#1f5f8d');
    for(let i=-5;i<=5;i++) {
      line([[-1.22,i*.2,.23],[1.22,i*.2,.23]],'rgba(49,112,164,.19)',.5);
      line([[i*.2,-1.22,.23],[i*.2,1.22,.23]],'rgba(49,112,164,.19)',.5);
    }
    // Four signal bridges rise from the socket into the glass processor.
    for(let side=0;side<4;side++) {
      const angle=side*Math.PI/2;
      const rotate=([x,y,z])=>[x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle),z];
      for(let lane=-2;lane<=2;lane++) {
        line([[lane*.14,-1.2,.23],[lane*.14,-.94,.23],[lane*.14,-.77,floating]].map(rotate),'rgba(74,176,243,.60)',.9);
      }
    }
    box(0,0,1.68,1.68,.33,floating,'#0d4070','#62c9ff');
    rect(0,0,1.48,1.48,floating+.004,'#103857','#2a87b6');
    rect(0,0,1.22,1.22,floating+.008,'#0c2a4b','#2f6e9c');
    const z=floating+.02;
    line([[-.49,.22,z],[-.49,-.22,z],[-.28,.01,z],[-.07,-.22,z],[-.07,.22,z]],'#c4f2ff',2.6,8);
    line([[.14,-.22,z],[.14,.22,z]],'#c4f2ff',2.6,8);
    line([[.45,-.22,z],[.14,.02,z],[.47,.22,z]],'#c4f2ff',2.6,8);
    // Steady status light, without flashes or strobing.
    glow([.97,1.03,.245],11,.8);
    for(let i=0;i<3;i++) rect(-.8+i*.17,1.07,.075,.045,.245,i===domain.channel?'#91edff':'#235a7d');
    ring(-1.34,-1.34,.24,.04,'#96cce3',1);
  }
  function drawBackground() {
    // Unconnected pads and quiet engineering lines anchor the circuit in space.
    ctx.globalAlpha=camera.opacity*.45;
    for(let x=-10;x<=7;x+=.75) for(let y=-7;y<=7;y+=.75) {
      if(Math.abs(x)<1.8&&Math.abs(y)<1.8) continue;
      const p=project([x,y,-.035]);
      if(p.x<0||p.y<0||p.x>width||p.y>height) continue;
      ctx.fillStyle='#236096';ctx.fillRect(p.x,p.y,1.2,1.2);
    }
    const branches=[
      [[-9,-4,.01],[-6.4,-4,.01],[-5.4,-3,.01],[-5.4,1.1,.01],[-4.5,2,.01]],
      [[-8,4,.01],[-5.6,4,.01],[-4.6,5,.01],[-.7,5,.01]],
      [[3,-7,.01],[3,-5.5,.01],[4.6,-3.9,.01],[7,-3.9,.01]],
      [[4.8,7,.01],[4.8,4.8,.01],[6.1,3.5,.01],[8,3.5,.01]]
    ];
    branches.forEach(p=>line(p,'#245477',1));
    // A coil and resistor are recognizable circuit motifs, not generic stars.
    const coil=[];
    for(let i=0;i<=90;i++) coil.push([-5.8+i/90*1.7,3.1+Math.sin(i/90*Math.PI*10)*.15,.025]);
    line(coil,'#438db8',1.1);
    const resistor=[[-4.1,-2.1,.02],[-3.9,-2.1,.02]];
    for(let i=0;i<6;i++) resistor.push([-3.85+i*.11,-2.1+(i%2?.15:-.15),.02]);
    resistor.push([-3.1,-2.1,.02]);line(resistor,'#438db8',1.1);
    ctx.globalAlpha=1;
  }
  function draw(time) {
    frame=0;
    if(document.hidden) return;
    const active=!paused;
    // Full-screen drawing is capped at 30fps; stopped motion has no render loop.
    if(active&&time-lastPaint<32) { requestDraw();return; }
    const dt=lastTime?Math.min((time-lastTime)/1000,.08):0;
    lastTime=time;lastPaint=time;
    if(active) elapsed+=dt;
    const response=reducedMotion.matches||paused?1:Math.min(1,dt*5);
    tilt.x+=(pointer.x-tilt.x)*response;
    tilt.y+=(pointer.y-tilt.y)*response;
    channelStrength.forEach((value,index)=>{channelStrength[index]+=(index===domain.channel?1-value:.16-value)*response;});
    setCamera();
    ctx.clearRect(0,0,width,height);
    const g=ctx.createRadialGradient(camera.x,camera.y,0,camera.x,camera.y,Math.max(width*.6,550));
    g.addColorStop(0,'rgba(6,79,151,.20)');g.addColorStop(.4,'rgba(5,46,97,.13)');g.addColorStop(1,'rgba(2,10,24,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
    drawBackground();
    ctx.globalAlpha=camera.opacity;
    traces.forEach(drawTrace);
    // Hardware recedes from reading areas while the live wiring continues.
    ctx.globalAlpha *= 1 - Math.min(1, scrollPosition / Math.max(height, 1)) * .83;
    components.filter(c=>c.y<0).forEach(drawSatellite);
    drawProcessor();
    components.filter(c=>c.y>=0).forEach(drawSatellite);
    ctx.globalAlpha=1;
    if(active) requestDraw();
  }
  function requestDraw() {if(!frame&&ctx&&!document.hidden) frame=requestAnimationFrame(draw);}
  function measure() {
    width=innerWidth;height=innerHeight;
    const b=scene.getBoundingClientRect();
    anchor={x:b.left+b.width*.51,y:b.top+scrollY+b.height*.50};
    dpr=Math.min(devicePixelRatio||1,width<761?1.5:2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);lastTime=0;requestDraw();
  }
  function updateMotion() {
    motion.setAttribute('aria-pressed',String(paused));
    motion.setAttribute('aria-label',paused?'Resume circuit motion':'Pause circuit motion');
    motion.querySelector('span').textContent=paused?'Resume motion':'Pause motion';
    motion.querySelector('path').setAttribute('d',paused?'M8 5l11 7-11 7Z':'M8 5v14M16 5v14');
    lastTime=0;requestDraw();
  }
  document.querySelectorAll('[data-domain]').forEach(button=>button.addEventListener('click',()=>{
    if(button.getAttribute('aria-pressed')==='true') return;
    document.querySelectorAll('[data-domain]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    domain=domains[button.dataset.domain];
    document.body.dataset.circuit=button.dataset.domain;
    ['label-a','label-b','label-c'].forEach((id,i)=>{document.getElementById(id).textContent=domain.labels[i];});
    document.getElementById('scene-description').textContent=domain.description;
    if(paused||reducedMotion.matches) channelStrength.forEach((_,i)=>{channelStrength[i]=i===domain.channel?1:.16;});
    burst+=.31;requestDraw();
  }));
  motion.addEventListener('click',()=>{paused=!paused;updateMotion();});
  reducedMotion.addEventListener('change',event=>{paused=event.matches;pointer={x:0,y:0};tilt={x:0,y:0};updateMotion();});
  scene.addEventListener('keydown',event=>{
    if(event.target!==scene||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    if(event.key==='ArrowLeft') manual.x-=.075;
    if(event.key==='ArrowRight') manual.x+=.075;
    if(event.key==='ArrowUp') manual.y=Math.max(-.25,manual.y-.045);
    if(event.key==='ArrowDown') manual.y=Math.min(.3,manual.y+.045);
    requestDraw();
  });
  scene.addEventListener('pointerdown',event=>{
    if(event.pointerType==='touch') return;
    drag={x:event.clientX,y:event.clientY};scene.setPointerCapture(event.pointerId);
  });
  window.addEventListener('pointermove',event=>{
    if(drag) {
      manual.x+=(event.clientX-drag.x)*.003;
      manual.y=Math.max(-.25,Math.min(.3,manual.y+(event.clientY-drag.y)*.002));
      drag={x:event.clientX,y:event.clientY};requestDraw();return;
    }
    if(paused||reducedMotion.matches||event.pointerType==='touch') return;
    pointer={x:(event.clientX/width-.5)*2,y:(event.clientY/height-.5)*2};requestDraw();
  },{passive:true});
  ['pointerup','pointercancel','lostpointercapture'].forEach(name=>scene.addEventListener(name,()=>{drag=null;}));
  document.documentElement.addEventListener('pointerleave',()=>{pointer={x:0,y:0};requestDraw();});
  window.addEventListener('scroll',()=>{scrollPosition=scrollY;requestDraw();},{passive:true});
  document.querySelectorAll('.project-row,.lab-project,.village-feature,.discipline').forEach(element=>{
    element.addEventListener('pointerenter',()=>{if(!paused&&!reducedMotion.matches) {burst+=.12;requestDraw();}});
  });
  if(ctx) {
    window.addEventListener('resize',measure,{passive:true});
    new ResizeObserver(measure).observe(scene);
    document.addEventListener('visibilitychange',()=>{lastTime=0;if(!document.hidden) requestDraw();});
    document.body.dataset.circuit='ai';updateMotion();measure();
  } else {
    document.body.classList.add('no-circuit-canvas');
    motion.parentElement.hidden=true;
  }
  const lab = document.getElementById('hackathon-lab');
  document.getElementById('close-lab').addEventListener('click', () => {
    const summary = lab.querySelector('summary');
    lab.open = false;
    summary.focus({ preventScroll: true });
    summary.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  });
  const projects = {
    screen: { title: 'ScreenStitcher', description: 'A browser extension for capturing multiple screen regions and composing them into a single, shareable PDF.', details: ['Capture the regions that matter across multiple screenshots.', 'Combine captures into one PDF for sharing and reference.'] },
    traffic: { title: 'TrafficLens', description: 'A developer-focused browser extension for inspecting Fetch and XHR network activity.', details: ['Track pending and completed network requests during frontend development.', 'Understand application traffic without losing the context of the page.'] },
  };
  const dialog = document.getElementById('project-dialog');
  document.querySelectorAll('[data-project]').forEach(button => button.addEventListener('click', () => {
    const project = projects[button.dataset.project];
    document.getElementById('dialog-title').textContent = project.title;
    document.getElementById('dialog-description').textContent = project.description;
    const list = document.createElement('ul');
    project.details.forEach(detail => { const item = document.createElement('li'); item.textContent = detail; list.append(item); });
    document.getElementById('dialog-details').replaceChildren(list);
    dialog.showModal(); document.body.classList.add('dialog-open');
  }));
  const close = () => dialog.close();
  document.getElementById('close-dialog').addEventListener('click', close);
  document.getElementById('dialog-done').addEventListener('click', close);
  dialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  dialog.addEventListener('click', event => { if (event.target !== dialog) return; const b = dialog.getBoundingClientRect(); if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) close(); });
})();
