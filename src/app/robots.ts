import type {MetadataRoute} from "next";

function siteOrigin(){
 const configured=process.env.APP_ORIGIN;
 if(configured)return configured.replace(/\/$/,"");
 const deployment=process.env.VERCEL_URL;
 return deployment?`https://${deployment}`:"http://localhost:3000";
}

export default function robots():MetadataRoute.Robots{
 const origin=siteOrigin();
 return {
  rules:{userAgent:"*",allow:"/",disallow:["/BlackShores","/api/"]},
  sitemap:`${origin}/sitemap.xml`,
 };
}
