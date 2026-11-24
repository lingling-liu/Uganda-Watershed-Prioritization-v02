import {useEffect,useRef,useState} from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {toPng} from 'html-to-image';
import {Download,Layers,Maximize2,LocateFixed} from 'lucide-react';
import {Ranked,fmt,tierBoundary} from './engine';
export default function MapView({geo,wmz,rows,selected,onSelect,tierLimit,totalCount,onExportMetadata}:{geo:any;wmz:any;rows:Ranked[];selected:number[];onSelect:(id:number)=>void;tierLimit:number;totalCount:number;onExportMetadata:()=>void}){
 const host=useRef<HTMLDivElement>(null),card=useRef<HTMLDivElement>(null),map=useRef<maplibregl.Map|null>(null),click=useRef(onSelect);click.current=onSelect;
 const extent=useRef<maplibregl.LngLatBounds|null>(null);
 const locationMarker=useRef<maplibregl.Marker|null>(null),locationPending=useRef(false);
 const [basemap,setBasemap]=useState<'existing'|'osm'>('osm'),[locating,setLocating]=useState(false),[locationNotice,setLocationNotice]=useState('');
 const [watershedOpacity,setWatershedOpacity]=useState(0.88);
 const [ready,setReady]=useState(false),[boundaries,setBoundaries]=useState(true),[polygons,setPolygons]=useState(true),[error,setError]=useState('');
 useEffect(()=>{if(!host.current)return;let m:maplibregl.Map;try{m=new maplibregl.Map({container:host.current,style:{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#edf2ed'}}]},center:[32.3,1.4],zoom:6,canvasContextAttributes:{preserveDrawingBuffer:true},attributionControl:false});}catch(e){setError('WebGL is unavailable in this browser. The complete ranking table remains available.');return;}
 map.current=m;m.addControl(new maplibregl.NavigationControl(),'top-right');m.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:'Supplied catchments'}));
 m.on('load',()=>{
  const bounds=new maplibregl.LngLatBounds();const add=(c:any)=>{if(typeof c[0]==='number')bounds.extend([c[0],c[1]]);else c.forEach(add)};geo.features.forEach((f:any)=>add(f.geometry.coordinates));extent.current=bounds;m.fitBounds(bounds,{padding:38,duration:0});
  m.addSource('watersheds',{type:'geojson',data:geo,promoteId:'Lev12_ID'});m.addSource('wmz',{type:'geojson',data:wmz});
  m.addLayer({id:'watersheds',type:'fill',source:'watersheds',paint:{'fill-color':['case',['==',['feature-state','included'],true],['case',['==',['feature-state','scored'],true],['interpolate',['linear'],['coalesce',['feature-state','score'],0],0,'#d9e7d3',0.25,'#abc8a0',0.5,'#6f9d73',0.75,'#367453',1,'#124733'],'#a9b0b6'],'#dce2e1'],'fill-opacity':0.88}});
  m.addLayer({id:'watershed-lines',type:'line',source:'watersheds',paint:{'line-color':'#f5f7ed','line-width':0.45}});
  m.addLayer({id:'top',type:'line',source:'watersheds',paint:{'line-color':'#dbad4c','line-width':['case',['==',['feature-state','priority'],true],1.4,0]}});
  m.addLayer({id:'wmz',type:'line',source:'wmz',paint:{'line-color':'#294f68','line-width':1.8,'line-dasharray':[3,2]}});
  m.addLayer({id:'selected',type:'line',source:'watersheds',paint:{'line-color':'#db5b30','line-width':['case',['==',['feature-state','selected'],true],3,0]}});
  m.on('click','watersheds',e=>{const id=Number(e.features?.[0]?.properties?.Lev12_ID);if(id)click.current(id)});m.on('mouseenter','watersheds',()=>m.getCanvas().style.cursor='pointer');m.on('mouseleave','watersheds',()=>m.getCanvas().style.cursor='');setReady(true);m.on('resize',()=>{if(extent.current)m.fitBounds(extent.current,{padding:38,duration:0})});
 });return()=>{setReady(false);locationMarker.current?.remove();locationMarker.current=null;locationPending.current=false;m.remove();map.current=null};},[geo,wmz]);
 useEffect(()=>{
  const m=map.current;if(!m||!ready)return;
  if(basemap==='osm'&&!m.getSource('osm-basemap')){
   // Load only tiles in the visible viewport; retain the map instance and all feature state.
   m.addSource('osm-basemap',{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19});
   m.addLayer({id:'osm-basemap',type:'raster',source:'osm-basemap'},'watersheds');
  }
  if(m.getLayer('osm-basemap'))m.setLayoutProperty('osm-basemap','visibility',basemap==='osm'?'visible':'none');
 },[basemap,ready]);
 function locate(){
  const m=map.current;if(!m||!ready||locationPending.current)return;
  if(!window.isSecureContext){setLocationNotice('Location requires HTTPS or localhost. Open the secure website and try again.');return;}
  if(!navigator.geolocation){setLocationNotice('Location is unavailable in this browser. You can still navigate the map manually.');return;}
  locationPending.current=true;setLocating(true);setLocationNotice('');
  // One-time request only: no watchPosition, persistence, analytics or location upload.
  navigator.geolocation.getCurrentPosition(position=>{
   if(map.current!==m)return;
   locationPending.current=false;setLocating(false);
   const {longitude,latitude}=position.coords;
   if(!Number.isFinite(longitude)||!Number.isFinite(latitude)){setLocationNotice('Your device returned an unavailable position. Please try again.');return;}
   locationMarker.current?.remove();
   const dot=document.createElement('div');dot.setAttribute('aria-label','Your current location');dot.setAttribute('role','img');dot.dataset.userLocation='true';
   Object.assign(dot.style,{width:'16px',height:'16px',borderRadius:'50%',background:'#1a73e8',border:'3px solid white',boxShadow:'0 0 0 4px rgba(26,115,232,.18)',pointerEvents:'none'});
   locationMarker.current=new maplibregl.Marker({element:dot}).setLngLat([longitude,latitude]).addTo(m);
   m.flyTo({center:[longitude,latitude],zoom:Math.max(m.getZoom(),13),duration:900});
   setLocationNotice('Location shown. This is a one-time position, not continuous tracking.');
  },reason=>{
   if(map.current!==m)return;
   locationPending.current=false;setLocating(false);
   setLocationNotice(reason.code===1?'Location permission was denied. Allow location in your browser settings to try again.':reason.code===3?'Location request timed out. Move to an open area or try again.':'Your device could not determine its location. Check location services or try again.');
  },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
 }
 useEffect(()=>{const m=map.current;if(!m||!ready)return;const index=new Map(rows.map(r=>[r.id,r]));for(const f of geo.features){const id=f.properties.Lev12_ID,r=index.get(id);m.setFeatureState({source:'watersheds',id},{included:!!r,scored:r?.score!=null,score:r?.score??0,priority:!!r?.rank&&r.rank<=tierBoundary(totalCount,tierLimit||5),selected:selected.includes(id)});}},[rows,selected,ready,geo,tierLimit,totalCount]);
 useEffect(()=>{const m=map.current;if(m&&ready&&m.getLayer('watersheds'))m.setPaintProperty('watersheds','fill-opacity',watershedOpacity)},[watershedOpacity,ready]);
 useEffect(()=>{if(!ready)return;map.current?.setLayoutProperty('wmz','visibility',boundaries?'visible':'none');for(const id of ['watersheds','watershed-lines','top','selected'])map.current?.setLayoutProperty(id,'visibility',polygons?'visible':'none')},[boundaries,polygons,ready]);
 useEffect(()=>{const last=selected.at(-1);if(!ready||!last)return;const f=geo.features.find((f:any)=>f.properties.Lev12_ID===last);if(!f)return;const coords=(f.geometry.coordinates as any[]).flat(f.geometry.type==='MultiPolygon'?2:1) as number[][];const b=new maplibregl.LngLatBounds();for(const xy of coords)b.extend([xy[0],xy[1]]);map.current?.fitBounds(b,{padding:90,maxZoom:10,duration:700});},[selected,ready,geo]);
 async function download(){try{map.current?.triggerRepaint();await new Promise(r=>setTimeout(r,150));const url=await toPng(card.current!,{pixelRatio:2});const a=document.createElement('a');a.href=url;a.download='Uganda-priority-map.png';a.click();onExportMetadata()}catch{setError('Map image export could not complete. Try your browser’s print/save function.')}}
 return <><div className="map-card" ref={card}><div className="map-toolbar"><span><span className="dot"/>LIVE PRIORITY MAP</span><div><button title="Reset map extent" onClick={()=>extent.current&&map.current?.fitBounds(extent.current,{padding:38,duration:500})}><Maximize2 size={15}/>Reset view</button><button onClick={download}><Download size={15}/>PNG</button></div></div><div className="map" ref={host}/><div className="map-overlay"><strong>Uganda · Level 12 watersheds</strong><span>{fmt(rows.length,0)} in current view · gold outlines: top {tierLimit||5}%</span></div><div className="map-legend"><div><strong>Priority score</strong><span>Lower <i/> Higher</span><small>0.00 ───────────────── 1.00</small></div><div className="legend-note"><span><b className="swatch excluded"/>Outside filters</span><span><b className="swatch missing"/>Not scored</span></div></div><button disabled={!ready||locating} title="Find your current location once" onClick={locate} style={{position:'absolute',left:14,top:116,zIndex:2,padding:'7px 9px',fontSize:10}}><LocateFixed size={14}/>{locating?'Locating…':'Locate Me'}</button><details className="layer-control"><summary><Layers size={15}/>Layers</summary><label style={{flexDirection:'column',alignItems:'stretch'}}>Basemap<select aria-label="Basemap" value={basemap} onChange={e=>setBasemap(e.target.value as 'existing'|'osm')}><option value="existing">Existing basemap</option><option value="osm">OpenStreetMap</option></select></label><label><input type="checkbox" checked={polygons} onChange={e=>setPolygons(e.target.checked)}/>Watersheds</label><label style={{flexDirection:'column',alignItems:'stretch',gap:4}}> <span>Watershed opacity: <output htmlFor="watershed-opacity">{Math.round(watershedOpacity*100)}%</output></span><input id="watershed-opacity" aria-label="Watershed opacity" type="range" min="0" max="100" step="1" value={Math.round(watershedOpacity*100)} onChange={e=>setWatershedOpacity(Number(e.target.value)/100)} style={{width:150,height:18,padding:0,accentColor:'#236247'}}/></label><label><input type="checkbox" checked={boundaries} onChange={e=>setBoundaries(e.target.checked)}/>WMZ boundaries</label></details>{basemap==='osm'&&<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" style={{position:'absolute',left:9,bottom:2,zIndex:2,background:'rgba(255,255,255,.95)',padding:'1px 4px',fontSize:10,color:'#245b78'}}>© OpenStreetMap contributors</a>}{error&&<p role="alert" className="warning">{error}</p>}</div>{locationNotice&&<p role="status" style={{fontSize:11,padding:'9px 12px',background:'#fffefa',borderTop:'1px solid #dce3d5'}}>{locationNotice}</p>}</>
}
