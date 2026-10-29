import{test}from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import sharp from'sharp';import{createWorker,PSM}from'tesseract.js';import{CARD_HEADERS,uidTextWidth,recoverCardUid}from'../scanner/card-layout.ts';
const directory=process.env.NEW_BUILD_CARDS_DIRECTORY;
test('Lucilla, Lucy and Rebecca original UID headers survive adjacent character art',{skip:!directory},async()=>{
 const worker=await createWorker('eng',1,{langPath:'node_modules/@tesseract.js-data/eng/4.0.0',gzip:true,cacheMethod:'none'});
 try{await worker.setParameters({user_defined_dpi:'300',tessedit_pageseg_mode:PSM.SINGLE_LINE,tessedit_char_whitelist:'0123456789'});
 for(const file of ['Lucilla.jpeg','Lucy(1).jpeg','Rebecca.jpeg']){
 const image=await readFile(directory+'/'+file),r=CARD_HEADERS.uidDigits;const{data}=await sharp(image).extract({left:r.x,top:r.y,width:r.width,height:r.height}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const width=uidTextWidth(data,r.width,r.height);assert.ok(width<110,file);
 const uid=await recoverCardUid('',async variant=>{const scale=variant===0?3:4;const png=await sharp(image).extract({left:r.x,top:r.y,width,height:r.height}).resize(width*scale,r.height*scale,{kernel:'linear'}).greyscale().linear(1.5,-64).png().toBuffer();const{data}=await worker.recognize(png);return{text:data.text,confidence:data.confidence};});assert.equal(uid,process.env.NEW_BUILD_CARD_UID,file);
 }}finally{await worker.terminate();}
});
