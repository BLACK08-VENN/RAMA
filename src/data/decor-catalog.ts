import type { PlannerProduct } from "./products";

export type DecorGroup = "Floor plants" | "Hanging plants" | "Table plants" | "Wall art" | "Mirrors" | "Rugs" | "Vases";
export type DecorSpec = {
  group: DecorGroup;
  mount: "floor" | "ceiling" | "table" | "wall";
  width: number;
  depth: number;
  height: number;
  shape?: "rectangle" | "round" | "oval" | "arch" | "hexagon";
  style?: "leafy" | "palm" | "snake" | "trailing" | "succulent" | "fern" | "abstract" | "botanical" | "landscape" | "woven" | "geometric";
  color: string;
};
function entry(id: string, name: string, kind: PlannerProduct["kind"], spec: DecorSpec): PlannerProduct {
  const dimensions = kind === "rug"
    ? (spec.shape === "round" ? "Ø " + Math.round(spec.width * 100) + " cm" : Math.round(spec.width * 100) + " × " + Math.round(spec.depth * 100) + " cm")
    : Math.round(spec.width * 100) + " × " + Math.round(spec.height * 100) + " cm";
  return { id, name, kind, category: "Décor", decorative: true, price: 0, productUrl: "", image: "/decor/" + id + ".svg", dimensions, accent: spec.color, decor: spec };
}
export const decorProducts: PlannerProduct[] = [
  entry("decor-floor-olive", "Olive green floor plant", "plant", {group:"Floor plants",mount:"floor",width:.65,depth:.65,height:1.5,style:"leafy",color:"#71805a"}),
  entry("decor-floor-palm-compact", "Compact palm", "plant", {group:"Floor plants",mount:"floor",width:.8,depth:.8,height:1.25,style:"palm",color:"#3e735d"}),
  entry("decor-hanging-pothos-large", "Full trailing basket", "plant", {group:"Hanging plants",mount:"ceiling",width:.85,depth:.85,height:1.35,style:"trailing",color:"#3c7457"}),
  entry("decor-table-fern", "Mini fern planter", "plant", {group:"Table plants",mount:"table",width:.35,depth:.35,height:.4,style:"fern",color:"#69915a"}),
  entry("decor-art-sunset", "Warm sunset horizon", "wall-art", {group:"Wall art",mount:"wall",width:1.2,depth:.025,height:.75,style:"landscape",color:"#cb9776"}),
  entry("decor-art-blue", "Indigo geometric canvas", "wall-art", {group:"Wall art",mount:"wall",width:.6,depth:.025,height:.8,style:"geometric",color:"#55758a"}),
  entry("decor-mirror-oval-large", "Tall bronze oval mirror", "mirror", {group:"Mirrors",mount:"wall",width:.9,depth:.018,height:1.4,shape:"oval",color:"#92765a"}),
  entry("decor-mirror-round-small", "Petite black round mirror", "mirror", {group:"Mirrors",mount:"wall",width:.5,depth:.018,height:.5,shape:"round",color:"#3c4340"}),
  entry("decor-rug-charcoal", "Charcoal geometric rug · 300 × 200", "rug", {group:"Rugs",mount:"floor",width:3,depth:2,height:.015,shape:"rectangle",style:"geometric",color:"#737c7b"}),
  entry("decor-rug-ochre-round", "Ochre round rug · Ø 250", "rug", {group:"Rugs",mount:"floor",width:2.5,depth:2.5,height:.015,shape:"round",style:"woven",color:"#c3a368"}),

  entry("decor-tall-plant", "Fiddle leaf floor plant", "plant", {group:"Floor plants",mount:"floor",width:.8,depth:.8,height:1.7,style:"leafy",color:"#426b43"}),
  entry("decor-small-plant", "Terracotta fern", "plant", {group:"Floor plants",mount:"floor",width:.7,depth:.7,height:1.05,style:"fern",color:"#61814b"}),
  entry("decor-floor-palm", "Areca palm", "plant", {group:"Floor plants",mount:"floor",width:1.1,depth:1.1,height:1.85,style:"palm",color:"#587c44"}),
  entry("decor-snake-plant", "Snake plant", "plant", {group:"Floor plants",mount:"floor",width:.45,depth:.45,height:.95,style:"snake",color:"#567450"}),
  entry("decor-hanging-pothos", "Trailing pothos", "plant", {group:"Hanging plants",mount:"ceiling",width:.65,depth:.65,height:1.1,style:"trailing",color:"#507547"}),
  entry("decor-hanging-fern", "Hanging fern basket", "plant", {group:"Hanging plants",mount:"ceiling",width:.75,depth:.75,height:.95,style:"fern",color:"#64864b"}),
  entry("decor-table-succulent", "Tabletop succulent", "plant", {group:"Table plants",mount:"table",width:.24,depth:.24,height:.28,style:"succulent",color:"#8aab82"}),
  entry("decor-table-leafy", "Mini leafy plant", "plant", {group:"Table plants",mount:"table",width:.32,depth:.32,height:.45,style:"leafy",color:"#4d714b"}),
  entry("decor-art-small", "Botanical study · small", "wall-art", {group:"Wall art",mount:"wall",width:.4,depth:.025,height:.55,style:"botanical",color:"#819473"}),
  entry("decor-art-medium", "Abstract earth · medium", "wall-art", {group:"Wall art",mount:"wall",width:.8,depth:.025,height:1.1,style:"abstract",color:"#bc8867"}),
  entry("decor-art-large", "Quiet horizon · large", "wall-art", {group:"Wall art",mount:"wall",width:1.5,depth:.025,height:.9,style:"landscape",color:"#7d9b98"}),
  entry("decor-art-square", "Geometric canvas · square", "wall-art", {group:"Wall art",mount:"wall",width:1,depth:.025,height:1,style:"geometric",color:"#a38a69"}),
  entry("decor-art-woven", "Woven wall hanging", "wall-art", {group:"Wall art",mount:"wall",width:.65,depth:.025,height:.95,style:"woven",color:"#c5b290"}),
  entry("decor-mirror-round", "Thin brass round mirror", "mirror", {group:"Mirrors",mount:"wall",width:.8,depth:.018,height:.8,shape:"round",color:"#ae945e"}),
  entry("decor-mirror-oval", "Slim oval mirror", "mirror", {group:"Mirrors",mount:"wall",width:.6,depth:.018,height:1.05,shape:"oval",color:"#635f55"}),
  entry("decor-mirror-arch", "Arched wall mirror", "mirror", {group:"Mirrors",mount:"wall",width:.75,depth:.018,height:1.2,shape:"arch",color:"#b49a67"}),
  entry("decor-mirror-rectangle", "Minimal rectangular mirror", "mirror", {group:"Mirrors",mount:"wall",width:.65,depth:.018,height:.95,shape:"rectangle",color:"#414b49"}),
  entry("decor-mirror-hexagon", "Hexagonal brass mirror", "mirror", {group:"Mirrors",mount:"wall",width:.7,depth:.018,height:.7,shape:"hexagon",color:"#b49a67"}),
  entry("decor-woven-rug", "Ivory woven rug · 240 × 160", "rug", {group:"Rugs",mount:"floor",width:2.4,depth:1.6,height:.015,shape:"rectangle",style:"woven",color:"#e5ded0"}),
  entry("decor-rug-small", "Sand rug · 180 × 120", "rug", {group:"Rugs",mount:"floor",width:1.8,depth:1.2,height:.015,shape:"rectangle",style:"woven",color:"#cbb692"}),
  entry("decor-rug-large", "Ivory rug · 300 × 200", "rug", {group:"Rugs",mount:"floor",width:3,depth:2,height:.015,shape:"rectangle",style:"woven",color:"#e5ded0"}),
  entry("decor-rug-xl", "Oatmeal rug · 400 × 300", "rug", {group:"Rugs",mount:"floor",width:4,depth:3,height:.015,shape:"rectangle",style:"woven",color:"#bdaa8d"}),
  entry("decor-rug-geometric", "Earth geometric rug · 300 × 200", "rug", {group:"Rugs",mount:"floor",width:3,depth:2,height:.015,shape:"rectangle",style:"geometric",color:"#ad8466"}),
  entry("decor-rug-runner", "Hall runner · 300 × 80", "rug", {group:"Rugs",mount:"floor",width:.8,depth:3,height:.015,shape:"rectangle",style:"geometric",color:"#83968b"}),
  entry("decor-round-rug", "Natural round rug · Ø 200", "rug", {group:"Rugs",mount:"floor",width:2,depth:2,height:.015,shape:"round",style:"woven",color:"#c8ad82"}),
  entry("decor-rug-round-small", "Sage round rug · Ø 150", "rug", {group:"Rugs",mount:"floor",width:1.5,depth:1.5,height:.015,shape:"round",style:"woven",color:"#a7b4a0"}),
  entry("decor-rug-round-large", "Natural round rug · Ø 300", "rug", {group:"Rugs",mount:"floor",width:3,depth:3,height:.015,shape:"round",style:"woven",color:"#c8ad82"}),
  entry("decor-ceramic-vase", "Ceramic vase & dried stems", "vase", {group:"Vases",mount:"floor",width:.4,depth:.4,height:1.3,color:"#d8c7ae"}),
];
