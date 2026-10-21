/**
 * Tripo models queued for the FurnitureRama asset approval pipeline.
 *
 * A Tripo Studio page URL is not a downloadable GLB. Keep submissions pending
 * until an actual model file has been uploaded, validated and approved.
 * Never load Studio HTML as a Three.js asset.
 */
export type TripoModelSubmission = {
  id: string;
  title: string;
  category: "chairs" | "sofas" | "tables" | "decor";
  source: "tripo";
  sourceUrl: string;
  description: string;
  status: "awaiting_file" | "pending_review" | "approved" | "rejected";
  assetPath: string | null;
};

export const tripoModelSubmissions: readonly TripoModelSubmission[] = [
  {
    id: "d01c9ab7-8b93-481f-8c33-93a9f4bc78af",
    title: "Ergonomic Black Mesh Office Chair",
    category: "chairs",
    source: "tripo",
    sourceUrl:
      "https://studio.tripo3d.ai/3d-model/d01c9ab7-8b93-481f-8c33-93a9f4bc78af?invite_code=1T4E42",
    description: "Black mesh office chair with headrest, adjustable arms and chrome base.",
    status: "awaiting_file",
    assetPath: null,
  },
];
