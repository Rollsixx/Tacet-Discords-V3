// Native pruning is enabled only for Vercel's tested Linux x64 glibc runtime.
if(process.env.VERCEL==='1'){
 const glibc=process.report.getReport().header.glibcVersionRuntime;
 if(process.platform!=='linux'||process.arch!=='x64'||!glibc)throw Error('Native function pruning requires Linux x64 glibc. Review tracing exclusions before targeting another platform.');
}
