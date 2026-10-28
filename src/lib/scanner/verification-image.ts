// Prepare once BEFORE recognition. The exact same File is later uploaded.
export const MAX_VERIFICATION_BYTES=1_000_000;
export async function prepareVerificationImage(file:File):Promise<File>{
 if(file.size<=MAX_VERIFICATION_BYTES)return file;
 const bitmap=await createImageBitmap(file);
 try{
  if(bitmap.width!==1920||bitmap.height!==1080)throw new Error('Use an original 1920 × 1080 build card.');
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const context=canvas.getContext('2d');if(!context)throw new Error('Unable to prepare screenshot verification.');
  context.fillStyle='#100d18';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0);
  for(const quality of [.95,.9,.85,.8,.7,.6,.5,.4,.35]){
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Unable to prepare screenshot verification.')),'image/jpeg',quality));
   if(blob.size<=MAX_VERIFICATION_BYTES)return new File([blob],file.name,{type:'image/jpeg',lastModified:file.lastModified});
  }
  throw new Error('Screenshot cannot fit the verification upload limit. Export a smaller original JPEG and scan it again.');
 }finally{bitmap.close();}
}
export async function verificationImageData(file:File):Promise<string>{
 if(file.size>MAX_VERIFICATION_BYTES)throw new Error('Prepare and scan this screenshot again before uploading.');
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Unable to read screenshot evidence.'));reader.readAsDataURL(file);});
}
