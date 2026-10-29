import sharp from 'sharp';
export async function decodeFingerprintSource(bytes){
 if(bytes?.info&&Buffer.isBuffer(bytes.data))return bytes;
 return sharp(bytes,{limitInputPixels:5000000}).toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});
}
export async function fingerprint(bytes, region, detailed=false) {
 let image=bytes?.info&&Buffer.isBuffer(bytes.data)?sharp(bytes.data,{raw:{width:bytes.info.width,height:bytes.info.height,channels:bytes.info.channels}}):sharp(bytes,{limitInputPixels:5000000}); if(region)image=image.extract(region);
 const spatial=detailed?(await image.clone().toColourspace('srgb').resize(24,24,{fit:'fill'}).ensureAlpha().raw().toBuffer()).toString('base64'):undefined;
 const rgb=await image.toColourspace('srgb').resize(9,8,{fit:'fill'}).flatten({background:'#100d18'}).removeAlpha().raw().toBuffer();
 let bits=0n;
 const hist=Array(24).fill(0);
 for(let y=0;y<8;y++)for(let x=0;x<9;x++){
 const i=(y*9+x)*3;
 for(let c=0;c<3;c++)hist[c*8+Math.min(7,Math.floor(rgb[i+c]/32))]++;
 if(x<8){const a=rgb[i]*.299+rgb[i+1]*.587+rgb[i+2]*.114;const b=rgb[i+3]*.299+rgb[i+4]*.587+rgb[i+5]*.114;bits=(bits<<1n)|(a>b?1n:0n);}
 }
 return {hash:bits.toString(16).padStart(16,'0'),hist:hist.map(n=>n/72),...(spatial?{spatial}:{})};
}
export function distance(a,b){let n=BigInt('0x'+a.hash)^BigInt('0x'+b.hash),bits=0;while(n){bits+=Number(n&1n);n>>=1n;}
 return bits/64*.75+a.hist.reduce((sum,v,i)=>sum+Math.abs(v-b.hist[i]),0)/6*.25;
}
export function rankFingerprint(f,catalog){return catalog.map(x=>({...x,difference:distance(f,x.fingerprint)})).sort((a,b)=>a.difference-b.difference);}

// Foreground colour/layout disambiguation; transparent reference pixels are not evidence.
export function spatialDistance(query,reference){
 if(!query.spatial||!reference.spatial)return Infinity;
 const a=Buffer.from(query.spatial,'base64'),b=Buffer.from(reference.spatial,'base64');
 if(a.length!==2304||b.length!==2304)return Infinity;
 let total=0,count=0;
 for(let i=0;i<a.length;i+=4)if(b[i+3]>=200){for(let c=0;c<3;c++)total+=Math.abs(a[i+c]-b[i+c])/255;count+=3;}
 return count>=300?total/count:Infinity;
}
