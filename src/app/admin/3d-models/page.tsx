"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Box, CheckCircle2, Clock3, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/lib/supabase";

type ModelRecord = {
  id: string;
  product_name: string;
  product_sku: string | null;
  source_image_url: string | null;
  model_url: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  notes: string | null;
};

export default function ModelStudioPage() {
  const { user, session, loading: authLoading, isConfigured } = useAuth();
  const [records, setRecords] = useState<ModelRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const reload = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/3d-models", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 403 ? "This account is not authorized for the model studio." : response.status === 503 ? "The model library is not configured yet." : "Could not load models.");
      const data: { models: ModelRecord[] } = await response.json();
      setRecords(data.models);
      setConfigured(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load the model library.");
    } finally { setLoading(false); }
  }, [session?.access_token]);

  useEffect(() => { void reload(); }, [reload]);

  const active = records.find((model) => model.id === selected) ?? records[0] ?? null;
  const setStatus = async (status: "approved" | "rejected") => {
    if (!active || !session?.access_token || updating) return;
    setUpdating(active.id);
    setError("");
    try {
      const response = await fetch("/api/admin/3d-models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id: active.id, status, notes }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Unable to update model.");
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save review."); }
    finally { setUpdating(null); }
  };

  if (authLoading) return <main style={page}><p>Checking administrator access…</p></main>;
  if (!isConfigured || !supabase) return <main style={page}><h1>3D Model Studio</h1><p>Supabase authentication has not been configured.</p><Link href="/">Back to Furniture Rama</Link></main>;
  if (!user) return <main style={page}><h1>Administrator sign-in required</h1><p>Sign in using your Furniture Rama account before opening this page.</p><Link href="/">Return to Furniture Rama to sign in</Link></main>;

  return <main style={page}>
    <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap"}}>
      <div><div style={{fontSize:12,letterSpacing:2,color:"#518583",fontWeight:700}}>FURNITURE RAMA / ADMINISTRATION</div><h1 style={{fontSize:"clamp(26px,4vw,36px)",fontWeight:700,margin:"8px 0"}}>3D Model Studio</h1><p style={{color:"#647775"}}>Review saved models before they appear in the room planner.</p></div>
      <Link href="/" style={{color:"#0d777b",textDecoration:"underline"}}>← Back to room planner</Link>
    </header>
    <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:14,margin:"25px 0"}}>
      {[{label:"Total models",value:records.length,icon:<Box size={19}/>},{label:"Awaiting review",value:records.filter(x=>x.status==="pending").length,icon:<Clock3 size={19}/>},{label:"Approved",value:records.filter(x=>x.status==="approved").length,icon:<CheckCircle2 size={19}/>},{label:"Rejected",value:records.filter(x=>x.status==="rejected").length,icon:<XCircle size={19}/>}].map(item=><div key={item.label} style={panel}><div style={{color:"#0e7b7d"}}>{item.icon}</div><strong style={{fontSize:29}}>{item.value}</strong><span style={{color:"#657471",fontSize:13}}>{item.label}</span></div>)}
    </section>
    {error && <div role="alert" style={{padding:14,borderRadius:12,background:"#fff1eb",color:"#8d3b23",marginBottom:16}}>{error}</div>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:8,color:"#48615d"}}><ShieldCheck size={18}/> Admin review queue</div>
      <button type="button" onClick={()=>void reload()} disabled={loading} style={buttonSecondary}><RefreshCw size={15}/> {loading?"Refreshing":"Refresh"}</button>
    </div>
    {!configured && !loading ? <div style={panel}><h2 style={{fontSize:18}}>Configuration required</h2><p>Connect the dedicated Furniture Rama Supabase database, configure the server-only admin credentials, and apply the model-library migration before using this page.</p></div> :
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,340px),1fr))",gap:18,alignItems:"start"}}>
      <section style={panel}>
        <h2 style={{fontWeight:700,marginBottom:16}}>Product models</h2>
        {loading && <p>Loading models…</p>}
        {!loading && records.length===0 && <p style={{color:"#657471",lineHeight:1.7}}>No 3D models have been uploaded yet. Once the Tripo import pipeline is connected, generated models will appear here for approval. No credits are used on this page.</p>}
        {records.map(model=><button type="button" key={model.id} onClick={()=>{setSelected(model.id);setNotes(model.notes??"");}} style={{width:"100%",padding:14,textAlign:"left",border:"1px solid #e4e9e5",borderRadius:12,background:active?.id===model.id?"#e9f4f1":"white",marginBottom:10,cursor:"pointer",color:"#263c38"}}>
          <strong>{model.product_name}</strong><div style={{fontSize:12,color:"#657471",marginTop:5}}>{model.product_sku??"No SKU"} · {model.status}</div>
        </button>)}
      </section>
      <section style={panel}>
        <h2 style={{fontWeight:700,marginBottom:14}}>Review & approval</h2>
        {!active ? <p style={{color:"#657471"}}>Choose a product from the model library to review it.</p> :
          <div>
            <strong>{active.product_name}</strong><p style={{color:"#657471",fontSize:13,marginTop:5}}>Current status: {active.status}</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,margin:"16px 0"}}>
              <div><small>Original product photo</small>{active.source_image_url?<img src={active.source_image_url} alt={active.product_name} style={{width:"100%",objectFit:"contain",height:190,background:"#f4f5f2",borderRadius:10}}/>:<div style={placeholder}>No product photo</div>}</div>
              <div><small>3D model file</small>{active.model_url?<div style={placeholder}><Box size={30}/><a href={active.model_url} target="_blank" rel="noopener noreferrer" style={{color:"#0a7779"}}>Open saved GLB</a></div>:<div style={placeholder}>No saved GLB</div>}</div>
            </div>
            <label htmlFor="review-notes" style={{display:"block",fontWeight:600,marginBottom:6}}>Review notes</label>
            <textarea id="review-notes" value={notes} onChange={e=>setNotes(e.target.value)} maxLength={1500} rows={3} style={{width:"100%",padding:12,borderRadius:10,border:"1px solid #cad5d1",color:"#263c38"}} placeholder="Check proportions, details and texture accuracy."/>
            <div style={{display:"flex",gap:10,marginTop:15,flexWrap:"wrap"}}>
              <button type="button" disabled={!active.model_url||Boolean(updating)} onClick={()=>void setStatus("approved")} style={buttonPrimary}>Approve model</button>
              <button type="button" disabled={Boolean(updating)} onClick={()=>void setStatus("rejected")} style={buttonSecondary}>Reject model</button>
            </div>
          </div>
        }
      </section>
    </div>}
    <p style={{fontSize:12,color:"#697b77",marginTop:24}}>Generation is intentionally disabled until a Tripo API key, credits and import pipeline are configured. Only approved models should be exposed through the customer catalogue.</p>
  </main>;
}
const page:React.CSSProperties={minHeight:"100vh",maxWidth:1320,margin:"0 auto",padding:"clamp(20px,4vw,50px)",background:"#f6f8f5",color:"#213b36",fontFamily:"Montserrat, sans-serif"};
const panel:React.CSSProperties={display:"flex",flexDirection:"column",gap:8,background:"white",border:"1px solid #e3e9e5",borderRadius:17,padding:20,boxShadow:"0 5px 24px rgba(15,40,34,.04)"};
const placeholder:React.CSSProperties={height:190,background:"#f3f6f3",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8,color:"#73817b",fontSize:13};
const buttonPrimary:React.CSSProperties={background:"#0d777b",color:"white",padding:"10px 15px",borderRadius:9,border:0,cursor:"pointer",fontWeight:600};
const buttonSecondary:React.CSSProperties={display:"inline-flex",alignItems:"center",gap:6,background:"white",color:"#28534f",padding:"10px 15px",borderRadius:9,border:"1px solid #cddbd6",cursor:"pointer",fontWeight:600};
