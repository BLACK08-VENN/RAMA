export type ProductCategory = "Seating" | "Tables" | "Storage" | "Bedroom";

export type ProductModel = {
  url: string;
  width: number;
  depth: number;
  height: number;
};

export type PlannerProduct = {
  id: string;
  openCartProductId: number;
  productUrl: string;
  name: string;
  category: ProductCategory;
  price: number;
  image: string;
  dimensions: string;
  accent: string;
  model?: ProductModel;
};

export const products: PlannerProduct[] = [
  {
    id: "delton-sofa",
    openCartProductId: 979,
    productUrl: "https://furniturerama.co.ke/delton-single-sofa-bed-black",
    name: "Delton Single Sofa Bed",
    category: "Seating",
    price: 35000,
    image: "/delton-sofa.jpg",
    dimensions: "W 98 × D 88 × H 82 cm",
    accent: "#292827",
    model: {
      url: "/models/delton-sofa.glb",
      width: 0.98,
      depth: 0.88,
      height: 0.82,
    },
  },
  {
    id: "austin-dining",
    openCartProductId: 806,
    productUrl: "https://furniturerama.co.ke/austin-5-piece-set-dining-table",
    name: "Austin 5 Piece Dining Set",
    category: "Tables",
    price: 74900,
    image: "/austin-dining.jpg",
    dimensions: "Table W 120 × D 80 cm",
    accent: "#3d2d24",
  },
  {
    id: "forte-chair",
    openCartProductId: 847,
    productUrl: "https://furniturerama.co.ke/forte-visitors-chair",
    name: "Forte Visitors Chair",
    category: "Seating",
    price: 18500,
    image: "/forte-chair.jpg",
    dimensions: "W 58 × D 61 × H 94 cm",
    accent: "#202326",
  },
  {
    id: "file-cabinet",
    openCartProductId: 906,
    productUrl: "https://furniturerama.co.ke/2-drawer-fire-resistant-file-cabinet",
    name: "2 Drawer Fire Resistant Cabinet",
    category: "Storage",
    price: 82480,
    image: "/file-cabinet.jpg",
    dimensions: "W 53 × D 68 × H 72 cm",
    accent: "#8a8f92",
  },
];

export const productModels: Record<string, ProductModel> = Object.fromEntries(
  products.flatMap((product) => (product.model ? [[product.id, product.model]] : [])),
);

export const formatKes = (price: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(price);
