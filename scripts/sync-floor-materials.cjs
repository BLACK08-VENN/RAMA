/* Sync approved CC0 ambientCG materials ahead of Next.js build.
 * Downloads 1K JPG maps only and keeps previously cached files if offline.
 * The room continues using its current procedural finish if any map is absent.
 */
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const exec = promisify(execFile);
const materials = ["WoodFloor051","Tiles140","WoodFloor070","WoodFloor052","Porcelain001","Marble025","Porcelain002","Grass004","Bricks025"];
const maps = ["Color","NormalGL","Roughness"];
const root = path.join(process.cwd(), "public", "materials", "ambientcg");

async function sync(id) {
  const dest = path.join(root,id);
  await fs.mkdir(dest,{recursive:true});
  const filenames = maps.map(map=>path.join(dest,map+".jpg"));
  try {
    await Promise.all(filenames.map(async file=>fs.access(file)));
    console.log("Material already cached:",id);
    return;
  } catch {}
  const uri = "https://ambientcg.com/get?file="+id+"_1K-JPG.zip";
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(),25000);
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),"rama-pbr-"));
  try {
    const response=await fetch(uri,{redirect:"follow",signal:controller.signal,headers:{"User-Agent":"FurnitureRama/1.0 (CC0 materials sync)"}});
    if(!response.ok)throw Error("HTTP "+response.status);
    const buffer=Buffer.from(await response.arrayBuffer());
    if(buffer.length<1000||buffer.length>35_000_000)throw Error("unexpected zip size");
    const zip=path.join(temp,id+".zip");
    await fs.writeFile(zip,buffer);
    const listing=await exec("unzip",["-Z1",zip],{maxBuffer:1024*1024});
    const members=listing.stdout.split(/\r?\n/).filter(Boolean);
    const targets=maps.map(map=>{
      const name=members.find(member=>member.endsWith("_"+map+".jpg") && !member.includes(".."));
      if(!name)throw Error(map+" not in archive");
      return name;
    });
    const out=await fs.mkdtemp(path.join(temp,"extract-"));
    for(let n=0;n<targets.length;n++){
      const bytes=await exec("unzip",["-p",zip,targets[n]],{encoding:"buffer",maxBuffer:10_000_000});
      await fs.writeFile(path.join(out,maps[n]+".jpg"),bytes.stdout);
    }
    for(const map of maps) await fs.copyFile(path.join(out,map+".jpg"),path.join(dest,map+".jpg"));
    console.log("Material synced:",id);
  } finally {
    clearTimeout(timeout);
    await fs.rm(temp,{recursive:true,force:true});
  }
}
// Poly Haven CC0 textured walls, selected from the user's links.
// Three unique assets: the duplicate beige_wall_001 link is included only once.
const polyWalls = ["plastered_wall_05", "beige_wall_001", "white_stucco"];
async function syncPolyWall(id) {
  const dest = path.join(root, id);
  await fs.mkdir(dest, { recursive: true });
  const parts = [["Color", "diff"], ["NormalGL", "nor_gl"], ["Roughness", "rough"]];
  for (const [local, remote] of parts) {
    const file = path.join(dest, local + ".jpg");
    try { await fs.access(file); continue; } catch {}
    const url = "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/" + id + "/" + id + "_" + remote + "_1k.jpg";
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Error(id + " " + remote + " HTTP " + response.status);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length < 1000 || data.length > 6_000_000) throw Error(id + " invalid JPEG");
    await fs.writeFile(file, data);
  }
  console.log("Poly Haven wall material synced:", id);
}
(async()=>{
  await fs.mkdir(root,{recursive:true});
  for (const id of polyWalls) {
    try { await syncPolyWall(id); } catch (e) { console.warn("Poly Haven wall material unavailable:", id, String(e.message || e)); }
  }
  for(const id of materials){
    try{await sync(id)}catch(e){console.warn("Material unavailable; using existing safe finish",id,String(e.message||e));}
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
