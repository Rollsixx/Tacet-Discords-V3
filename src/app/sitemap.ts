import type {MetadataRoute} from "next";

function siteOrigin(){
 const configured=process.env.APP_ORIGIN;
 if(configured)return configured.replace(/\/$/,"");
 const productionDomain=process.env.VERCEL_PROJECT_PRODUCTION_URL;
 if(productionDomain)return `https://${productionDomain}`;
 const deployment=process.env.VERCEL_URL;
 return deployment?`https://${deployment}`:"http://localhost:3000";
}

export default function sitemap():MetadataRoute.Sitemap{
 const origin=siteOrigin();
 return ["/","/hall-of-fame","/leaderboards","/profiles","/import","/privacy","/terms"].map(path=>({
  url:`${origin}${path}`,
  changeFrequency:path==="/privacy"||path==="/terms"?"yearly":"weekly",
  priority:path==="/" ? 1 : path==="/hall-of-fame"||path==="/leaderboards" ? 0.8 : 0.6,
 }));
}
