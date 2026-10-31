export function isValidHomeFeatured(names, supportedNames) {
 return Array.isArray(names)&&names.length===3&&names.every(name=>typeof name==='string'&&supportedNames.includes(name))&&new Set(names).size===3;
}
export function resolveHomeFeatured(names, supportedNames, fallback) {
 return isValidHomeFeatured(names,supportedNames)?[...names]:[...fallback];
}
