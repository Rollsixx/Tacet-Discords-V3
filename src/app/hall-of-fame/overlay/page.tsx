import BroadcastOverlay from "@/components/hall-of-fame-overlay";

export default async function Page({searchParams}:{searchParams:Promise<{slug?:string;layout?:string}>}){
 const params=await searchParams;
 return <BroadcastOverlay slug={params.slug||""} layout={params.layout==="landscape"?"landscape":"vertical"}/>;
}
